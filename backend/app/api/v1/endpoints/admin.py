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
from app.schemas.admin import (
    AdminCategoriesListResponse,
    AdminCategoryCreate,
    AdminCategoryRead,
    AdminCategoryUpdate,
    AdminDashboardStats,
    AdminListMeta,
    AdminListingRead,
    AdminListingsListResponse,
    AdminListingStatusUpdate,
    AdminUserRoleUpdate,
    AdminUsersListResponse,
)
from app.schemas.user import UserRead

router = APIRouter(prefix="/admin", tags=["admin"])


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

    await UserRepository.delete(session=db, obj=user)


@router.get("/listings", response_model=AdminListingsListResponse)
async def get_listings(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    is_active: bool | None = Query(default=None),
    user_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
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
