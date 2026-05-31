import logging

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user_from_session
from app.db.session import get_db
from app.models.category import Category
from app.models.listing import Listing
from app.models.user import User, UserRole
from app.repositories.category_repository import CategoryRepository
from app.repositories.listing_repository import ListingRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.schemas.admin import (
    AdminCategoriesListResponse,
    AdminCategoryCreate,
    AdminCategoryRead,
    AdminReportsListResponse,
    AdminReportRead,
    AdminReportStatusUpdate,
    AdminCategoryUpdate,
    AdminDashboardStats,
    AdminListMeta,
    AdminListingRead,
    AdminListingsListResponse,
    AdminListingModerationUpdate,
    AdminListingStatusUpdate,
    AdminUserRoleUpdate,
    AdminUsersListResponse,
)
from app.schemas.user import UserRead
from app.services.cache import (
    REPORT_STATUS_BLOCKED,
    REPORT_STATUS_PENDING,
    REPORT_STATUS_REJECTED,
    ReportAlreadyResolvedError,
    delete_session_cache,
    get_reports,
    invalidate_ads_cache,
    invalidate_categories_cache,
    update_report_status,
)

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger("smartboard.admin")
MODERATION_APPROVED = "approved"
MODERATION_REJECTED = "rejected"
MODERATION_PENDING = "pending"


async def require_admin(
    current_user: User = Depends(get_current_user_from_session),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    return current_user


@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    users_total = await db.scalar(select(func.count()).select_from(User))
    admins_total = await db.scalar(
        select(func.count()).select_from(User).where(User.role == UserRole.ADMIN)
    )
    listings_total = await db.scalar(select(func.count()).select_from(Listing))
    active_listings_total = await db.scalar(
        select(func.count()).select_from(Listing).where(Listing.is_active.is_(True))
    )
    categories_total = await db.scalar(select(func.count()).select_from(Category))

    return AdminDashboardStats(
        users_total=users_total or 0,
        admins_total=admins_total or 0,
        listings_total=listings_total or 0,
        active_listings_total=active_listings_total or 0,
        categories_total=categories_total or 0,
    )


@router.get("/users", response_model=AdminUsersListResponse)
async def get_users(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    query: str | None = Query(default=None, min_length=1),
    role: UserRole | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = []

    if query:
        cleaned_query = query.strip()
        if cleaned_query:
            term = f"%{cleaned_query}%"
            filters.append(
                or_(
                    User.email.ilike(term),
                    User.name.ilike(term),
                    User.last_name.ilike(term),
                )
            )

    if role is not None:
        filters.append(User.role == role)

    stmt = select(User)
    count_stmt = select(func.count()).select_from(User)

    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)

    users_result = await db.execute(stmt)
    users = list(users_result.scalars().all())
    total = await db.scalar(count_stmt)

    return AdminUsersListResponse(
        meta=AdminListMeta(total=total or 0, limit=limit, offset=offset),
        items=[UserRead.model_validate(user) for user in users],
    )


@router.patch("/users/{user_id}/role", response_model=UserRead)
async def update_user_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = await UserRepository.get_by_id(session=db, obj_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if current_admin.id == user.id and payload.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя снять роль администратора с самого себя",
        )

    updated_user = await UserRepository.update(session=db, obj=user, role=payload.role)
    return UserRead.model_validate(updated_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = await UserRepository.get_by_id(session=db, obj_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if current_admin.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить самого себя",
        )

    sessions = await UserSessionRepository.find_all(session=db, user_id=user.id)
    for session_obj in sessions:
        await delete_session_cache(session_obj.session_id)

    await UserRepository.delete(session=db, obj=user)
    logger.info("User deleted by admin: admin_id=%s user_id=%s sessions_revoked=%s", current_admin.id, user.id, len(sessions))


@router.get("/listings", response_model=AdminListingsListResponse)
async def get_listings(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    is_active: bool | None = Query(default=None),
    user_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    moderation_status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    filters = []
    if is_active is not None:
        filters.append(Listing.is_active.is_(is_active))
    if user_id is not None:
        filters.append(Listing.user_id == user_id)
    if category_id is not None:
        filters.append(Listing.category_id == category_id)
    if moderation_status is not None and moderation_status.strip():
        filters.append(Listing.moderation_status == moderation_status.strip().lower())

    stmt = select(Listing)
    count_stmt = select(func.count()).select_from(Listing)

    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    stmt = stmt.order_by(Listing.created_at.desc()).offset(offset).limit(limit)

    listings_result = await db.execute(stmt)
    listings = list(listings_result.scalars().all())
    total = await db.scalar(count_stmt)

    return AdminListingsListResponse(
        meta=AdminListMeta(total=total or 0, limit=limit, offset=offset),
        items=[AdminListingRead.model_validate(listing) for listing in listings],
    )


@router.patch("/listings/{listing_id}/status", response_model=AdminListingRead)
async def update_listing_status(
    listing_id: int,
    payload: AdminListingStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=listing_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    updated_listing = await ListingRepository.update(
        session=db,
        obj=listing,
        is_active=payload.is_active,
    )
    return AdminListingRead.model_validate(updated_listing)


@router.patch("/listings/{listing_id}/moderation", response_model=AdminListingRead)
async def update_listing_moderation(
    listing_id: int,
    payload: AdminListingModerationUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=listing_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    if listing.user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя модерировать собственные объявления")

    next_status = payload.moderation_status.strip().lower()
    if next_status not in {MODERATION_APPROVED, MODERATION_REJECTED, MODERATION_PENDING}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный статус модерации")

    update_data: dict = {"moderation_status": next_status, "moderated_at": datetime.utcnow()}

    # При одобрении включаем объявление, если оно имеет остаток.
    if next_status == MODERATION_APPROVED and listing.quantity_available and listing.quantity_available > 0:
        update_data["is_active"] = True

    updated_listing = await ListingRepository.update(session=db, obj=listing, **update_data)
    return AdminListingRead.model_validate(updated_listing)


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=listing_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    await ListingRepository.delete(session=db, obj=listing)


@router.get("/categories", response_model=AdminCategoriesListResponse)
async def get_categories(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    total = await db.scalar(select(func.count()).select_from(Category))
    stmt = select(Category).order_by(Category.name.asc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    categories = list(result.scalars().all())

    return AdminCategoriesListResponse(
        meta=AdminListMeta(total=total or 0, limit=limit, offset=offset),
        items=[AdminCategoryRead.model_validate(category) for category in categories],
    )


@router.post("/categories", response_model=AdminCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: AdminCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        category = await CategoryRepository.create(
            session=db,
            name=payload.name,
            slug=payload.slug,
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Категория с таким именем или slug уже существует",
        )
    await invalidate_categories_cache()

    return AdminCategoryRead.model_validate(category)


@router.patch("/categories/{category_id}", response_model=AdminCategoryRead)
async def update_category(
    category_id: int,
    payload: AdminCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    category = await CategoryRepository.get_by_id(session=db, obj_id=category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет данных для обновления",
        )

    try:
        updated_category = await CategoryRepository.update(
            session=db,
            obj=category,
            **update_data,
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Категория с таким именем или slug уже существует",
        )
    await invalidate_categories_cache()

    return AdminCategoryRead.model_validate(updated_category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    category = await CategoryRepository.get_by_id(session=db, obj_id=category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    await CategoryRepository.delete(session=db, obj=category)
    await invalidate_categories_cache()


@router.get("/reports", response_model=AdminReportsListResponse)
async def get_reports_list(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    items, total = await get_reports(limit=limit, offset=offset)
    listing_ids = {item.get("listing_id") for item in items if item.get("listing_id")}
    listings_by_id: dict[int, Listing] = {}
    if listing_ids:
        listings_result = await db.execute(select(Listing).where(Listing.id.in_(listing_ids)))
        listings_by_id = {listing.id: listing for listing in listings_result.scalars().all()}

    parsed_items: list[AdminReportRead] = []
    for item in items:
        try:
            listing_id = item.get("listing_id")
            listing = listings_by_id.get(listing_id) if listing_id else None
            parsed_items.append(
                AdminReportRead.model_validate(
                    {
                        **item,
                        "status": item.get("status") or REPORT_STATUS_PENDING,
                        "listing_title": listing.title if listing else None,
                        "listing_image_url": listing.image_url if listing else None,
                    }
                )
            )
        except Exception:
            continue

    return AdminReportsListResponse(
        meta=AdminListMeta(total=total or 0, limit=limit, offset=offset),
        items=parsed_items,
    )


@router.patch("/reports/{report_id}/status", response_model=AdminReportRead)
async def resolve_report(
    report_id: str,
    payload: AdminReportStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    next_status = payload.status.strip().lower()
    if next_status not in {REPORT_STATUS_REJECTED, REPORT_STATUS_BLOCKED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный статус жалобы")

    try:
        updated_item = await update_report_status(report_id=report_id, new_status=next_status)
    except ReportAlreadyResolvedError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Жалоба не найдена или уже обработана")

    listing_id = updated_item.get("listing_id")
    listing = await ListingRepository.get_by_id(session=db, obj_id=listing_id) if listing_id else None

    if next_status == REPORT_STATUS_BLOCKED and listing:
        if listing.user_id == current_admin.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя блокировать собственное объявление по жалобе",
            )
        await ListingRepository.update(
            session=db,
            obj=listing,
            is_active=False,
            moderation_status=MODERATION_REJECTED,
            moderated_at=datetime.utcnow(),
        )
        await invalidate_ads_cache()

    return AdminReportRead.model_validate(
        {
            **updated_item,
            "status": updated_item.get("status") or REPORT_STATUS_PENDING,
            "listing_title": listing.title if listing else None,
            "listing_image_url": listing.image_url if listing else None,
        }
    )
