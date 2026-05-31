from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import SESSION_COOKIE_NAME
from app.api.v1.endpoints.auth import get_current_user_from_session
from app.db.session import get_db
from app.models.category import Category
from app.models.favorite import Favorite
from app.models.listing import Listing
from app.models.user import User
from app.repositories.category_repository import CategoryRepository
from app.repositories.favorite_repository import FavoriteRepository
from app.repositories.listing_repository import ListingRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.schemas.ad import AdListMeta, AdListResponse, AdRead, CategoryRead
from app.services.cache import get_categories_cache, invalidate_ads_cache, set_categories_cache

router = APIRouter(prefix="/ads", tags=["ads"])
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
LISTINGS_DIR = Path(__file__).resolve().parents[3] / "static" / "listings"
MODERATION_APPROVED = "approved"
MODERATION_PENDING = "pending"


def _parse_decimal(value: str | None, field_name: str) -> Decimal | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    try:
        parsed = Decimal(normalized)
    except InvalidOperation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Некорректный формат поля {field_name}")
    return parsed


def _parse_bool(value: str | None, field_name: str) -> bool | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"", "null"}:
        return None
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Некорректный формат поля {field_name}")


def _parse_int(value: str | None, field_name: str) -> int | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    try:
        parsed = int(normalized)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Некорректный формат поля {field_name}")
    return parsed


def _map_listing_to_ad_read(
    listing: Listing,
    category_name: str | None = None,
    author_name: str | None = None,
    author_phone: str | None = None,
    author_avatar_url: str | None = None,
    author_created_at: datetime | None = None,
    is_favorite: bool = False,
) -> AdRead:
    return AdRead(
        id=listing.id,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        image_url=listing.image_url,
        user_id=listing.user_id,
        category_id=listing.category_id,
        quantity_total=listing.quantity_total or 1,
        quantity_available=listing.quantity_available if listing.quantity_available is not None else (listing.quantity_total or 1),
        category_name=category_name,
        author_name=author_name,
        author_phone=author_phone,
        author_avatar_url=author_avatar_url,
        author_created_at=author_created_at,
        is_favorite=is_favorite,
        is_active=listing.is_active,
        moderation_status=getattr(listing, "moderation_status", None),
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


async def _get_optional_current_user(
    db: AsyncSession,
    session_id: str | None,
) -> User | None:
    if not session_id:
        return None

    from app.services.cache import get_session_user_id, set_session_cache

    cached_user_id = await get_session_user_id(session_id)
    if cached_user_id:
        user = await UserRepository.get_by_id(session=db, obj_id=cached_user_id)
        if user:
            return user

    user_session = await UserSessionRepository.get_active_by_session_id(session=db, session_id=session_id)
    if not user_session:
        return None

    await set_session_cache(session_id, user_session.user_id)
    return await UserRepository.get_by_id(session=db, obj_id=user_session.user_id)


async def _get_favorite_ids(
    db: AsyncSession,
    user_id: int,
    listing_ids: list[int],
) -> set[int]:
    if not listing_ids:
        return set()

    stmt = select(Favorite.listing_id).where(
        Favorite.user_id == user_id,
        Favorite.listing_id.in_(listing_ids),
    )
    result = await db.execute(stmt)
    return set(result.scalars().all())


@router.get("", response_model=AdListResponse)
async def get_ads(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    query: str | None = Query(default=None),
    category_id: int | None = Query(default=None, ge=1),
    price_min: Decimal | None = Query(default=None, ge=0),
    price_max: Decimal | None = Query(default=None, ge=0),
    user_id: int | None = Query(default=None, ge=1),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    optional_user = await _get_optional_current_user(db=db, session_id=session_id)

    base_filters = [Listing.is_active.is_(True), Listing.moderation_status == MODERATION_APPROVED]
    if optional_user is not None:
        base_filters.append(Listing.user_id != optional_user.id)

    stmt = (
        select(Listing, Category.name, User.name, User.last_name, User.phone, User.avatar_url)
        .join(Category, Listing.category_id == Category.id, isouter=True)
        .join(User, Listing.user_id == User.id)
        .where(*base_filters)
    )
    count_stmt = select(func.count()).select_from(Listing).where(*base_filters)

    if query and query.strip():
        term = f"%{query.strip()}%"
        condition = or_(Listing.title.ilike(term), Listing.description.ilike(term))
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    if category_id is not None:
        condition = Listing.category_id == category_id
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    if price_min is not None:
        condition = Listing.price >= price_min
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    if price_max is not None:
        condition = Listing.price <= price_max
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    if user_id is not None:
        condition = Listing.user_id == user_id
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    if created_from is not None:
        condition = Listing.created_at >= created_from
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    if created_to is not None:
        condition = Listing.created_at <= created_to
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    stmt = stmt.order_by(Listing.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()
    total = await db.scalar(count_stmt)

    listing_ids = [row[0].id for row in rows]
    favorite_ids = await _get_favorite_ids(db=db, user_id=optional_user.id, listing_ids=listing_ids) if optional_user else set()

    items = [
        _map_listing_to_ad_read(
            listing=row[0],
            category_name=row[1],
            author_name=" ".join(part for part in [row[2], row[3]] if part).strip() or None,
            author_phone=row[4],
            author_avatar_url=row[5],
            is_favorite=row[0].id in favorite_ids,
        )
        for row in rows
    ]

    return AdListResponse(meta=AdListMeta(total=total or 0, limit=limit, offset=offset), items=items)


@router.get("/categories", response_model=list[CategoryRead])
async def get_categories(db: AsyncSession = Depends(get_db)):
    cached = await get_categories_cache()
    if cached is not None:
        return [CategoryRead.model_validate(item) for item in cached]

    categories = await CategoryRepository.get_all_sorted(session=db)
    payload = [CategoryRead.model_validate(category).model_dump(mode="json") for category in categories]
    await set_categories_cache(payload)
    return [CategoryRead.model_validate(item) for item in payload]


@router.get("/my", response_model=AdListResponse)
async def get_my_ads(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    stmt = (
        select(Listing, Category.name)
        .join(Category, Listing.category_id == Category.id, isouter=True)
        .where(Listing.user_id == current_user.id)
    )
    count_stmt = select(func.count()).select_from(Listing).where(Listing.user_id == current_user.id)

    if is_active is not None:
        condition = Listing.is_active.is_(is_active)
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    stmt = stmt.order_by(Listing.created_at.desc()).offset(offset).limit(limit)

    rows = (await db.execute(stmt)).all()
    total = await db.scalar(count_stmt)

    items = [
        _map_listing_to_ad_read(
            listing=row[0],
            category_name=row[1],
            author_name=f"{current_user.name} {current_user.last_name}".strip() or None,
            author_phone=current_user.phone,
            author_avatar_url=current_user.avatar_url,
            is_favorite=False,
        )
        for row in rows
    ]

    return AdListResponse(meta=AdListMeta(total=total or 0, limit=limit, offset=offset), items=items)


@router.get("/favorites/me", response_model=AdListResponse)
async def get_my_favorites(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    stmt = (
        select(Listing, Category.name, User.name, User.last_name, User.phone, User.avatar_url)
        .join(Favorite, Favorite.listing_id == Listing.id)
        .join(Category, Listing.category_id == Category.id, isouter=True)
        .join(User, Listing.user_id == User.id)
        .where(Favorite.user_id == current_user.id, Listing.is_active.is_(True))
        .order_by(Favorite.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    count_stmt = (
        select(func.count())
        .select_from(Favorite)
        .join(Listing, Listing.id == Favorite.listing_id)
        .where(Favorite.user_id == current_user.id, Listing.is_active.is_(True))
    )

    rows = (await db.execute(stmt)).all()
    total = await db.scalar(count_stmt)

    items = [
        _map_listing_to_ad_read(
            listing=row[0],
            category_name=row[1],
            author_name=" ".join(part for part in [row[2], row[3]] if part).strip() or None,
            author_phone=row[4],
            author_avatar_url=row[5],
            is_favorite=True,
        )
        for row in rows
    ]

    return AdListResponse(meta=AdListMeta(total=total or 0, limit=limit, offset=offset), items=items)


@router.get("/users/{user_id}/listings", response_model=AdListResponse)
async def get_user_public_listings(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    user = await UserRepository.get_by_id(session=db, obj_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    stmt = (
        select(Listing, Category.name)
        .join(Category, Listing.category_id == Category.id, isouter=True)
        .where(
            Listing.user_id == user_id,
            Listing.is_active.is_(True),
            Listing.moderation_status == MODERATION_APPROVED,
        )
        .order_by(Listing.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    count_stmt = (
        select(func.count())
        .select_from(Listing)
        .where(
            Listing.user_id == user_id,
            Listing.is_active.is_(True),
            Listing.moderation_status == MODERATION_APPROVED,
        )
    )

    rows = (await db.execute(stmt)).all()
    total = await db.scalar(count_stmt)

    author_name = f"{user.name} {user.last_name}".strip() or None
    items = [
        _map_listing_to_ad_read(
            listing=row[0],
            category_name=row[1],
            author_name=author_name,
            author_phone=user.phone,
            author_avatar_url=user.avatar_url,
            is_favorite=False,
        )
        for row in rows
    ]

    return AdListResponse(meta=AdListMeta(total=total or 0, limit=limit, offset=offset), items=items)


@router.get("/{ad_id}/similar", response_model=AdListResponse)
async def get_similar_ads(
    ad_id: int,
    limit: int = Query(default=12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=ad_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    optional_user = await _get_optional_current_user(db=db, session_id=session_id)
    base_filters = [
        Listing.is_active.is_(True),
        Listing.moderation_status == MODERATION_APPROVED,
        Listing.id != ad_id,
    ]
    if optional_user is not None:
        base_filters.append(Listing.user_id != optional_user.id)

    stmt = (
        select(Listing, Category.name, User.name, User.last_name, User.phone, User.avatar_url)
        .join(Category, Listing.category_id == Category.id, isouter=True)
        .join(User, Listing.user_id == User.id)
        .where(*base_filters)
    )
    count_stmt = select(func.count()).select_from(Listing).where(*base_filters)

    if listing.category_id is not None:
        category_filter = Listing.category_id == listing.category_id
        stmt = stmt.where(category_filter)
        count_stmt = count_stmt.where(category_filter)

    stmt = stmt.order_by(Listing.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).all()
    total = await db.scalar(count_stmt)

    listing_ids = [row[0].id for row in rows]
    favorite_ids = await _get_favorite_ids(db=db, user_id=optional_user.id, listing_ids=listing_ids) if optional_user else set()

    items = [
        _map_listing_to_ad_read(
            listing=row[0],
            category_name=row[1],
            author_name=" ".join(part for part in [row[2], row[3]] if part).strip() or None,
            author_phone=row[4],
            author_avatar_url=row[5],
            is_favorite=row[0].id in favorite_ids,
        )
        for row in rows
    ]
    return AdListResponse(meta=AdListMeta(total=total or 0, limit=limit, offset=0), items=items)


@router.get("/{ad_id}", response_model=AdRead)
async def get_ad_by_id(
    ad_id: int,
    db: AsyncSession = Depends(get_db),
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    stmt = (
        select(
            Listing,
            Category.name,
            User.name,
            User.last_name,
            User.phone,
            User.avatar_url,
            User.created_at,
        )
        .join(Category, Listing.category_id == Category.id, isouter=True)
        .join(User, Listing.user_id == User.id)
        .where(Listing.id == ad_id)
    )
    row = (await db.execute(stmt)).first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    listing: Listing = row[0]
    optional_user = await _get_optional_current_user(db=db, session_id=session_id)

    can_see_inactive = bool(optional_user and optional_user.id == listing.user_id)
    can_see_unapproved = can_see_inactive
    if listing.moderation_status != MODERATION_APPROVED and not can_see_unapproved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if not listing.is_active and not can_see_inactive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    is_favorite = False
    if optional_user:
        favorite = await FavoriteRepository.find_by_user_and_listing(
            session=db,
            user_id=optional_user.id,
            listing_id=listing.id,
        )
        is_favorite = favorite is not None

    return _map_listing_to_ad_read(
        listing=listing,
        category_name=row[1],
        author_name=" ".join(part for part in [row[2], row[3]] if part).strip() or None,
        author_phone=row[4],
        author_avatar_url=row[5],
        author_created_at=row[6],
        is_favorite=is_favorite,
    )


@router.post("", response_model=AdRead, status_code=status.HTTP_201_CREATED)
async def create_ad(
    title: str = Form(...),
    description: str = Form(...),
    price: str | None = Form(default=None),
    category_id: int | None = Form(default=None),
    quantity_total: str | None = Form(default="1"),
    image: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    normalized_title = title.strip()
    normalized_description = description.strip()

    if len(normalized_title) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заголовок должен быть не менее 3 символов")
    if len(normalized_description) < 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Описание должно быть не менее 5 символов")

    parsed_price = _parse_decimal(price, "price")
    if parsed_price is not None and parsed_price < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Цена не может быть отрицательной")
    parsed_quantity_total = _parse_int(quantity_total, "quantity_total")
    quantity_total_value = parsed_quantity_total or 1
    if quantity_total_value < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Количество должно быть не менее 1")
    quantity_available_value = quantity_total_value

    category = None
    if category_id is not None:
        category = await CategoryRepository.get_by_id(session=db, obj_id=category_id)
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    image_url: str | None = None
    if image is not None:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Разрешены только JPG, PNG и WEBP")

        content = await image.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пустой")
        if len(content) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Размер фото не должен превышать 8MB")

        LISTINGS_DIR.mkdir(parents=True, exist_ok=True)
        extension = ALLOWED_IMAGE_TYPES[image.content_type]
        filename = f"listing_{current_user.id}_{uuid4().hex}{extension}"
        file_path = LISTINGS_DIR / filename
        file_path.write_bytes(content)
        image_url = f"/media/listings/{filename}"

    listing = await ListingRepository.create(
        session=db,
        title=normalized_title,
        description=normalized_description,
        price=parsed_price,
        image_url=image_url,
        category_id=category_id,
        quantity_total=quantity_total_value,
        quantity_available=quantity_available_value,
        user_id=current_user.id,
        is_active=False,
        moderation_status=MODERATION_PENDING,
    )
    await invalidate_ads_cache()

    return _map_listing_to_ad_read(
        listing=listing,
        category_name=category.name if category else None,
        author_name=f"{current_user.name} {current_user.last_name}".strip() or None,
        author_phone=current_user.phone,
        author_avatar_url=current_user.avatar_url,
        is_favorite=False,
    )


@router.patch("/{ad_id}", response_model=AdRead)
async def update_ad(
    ad_id: int,
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    price: str | None = Form(default=None),
    category_id: str | None = Form(default=None),
    quantity_total: str | None = Form(default=None),
    quantity_available: str | None = Form(default=None),
    is_active: str | None = Form(default=None),
    remove_image: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=ad_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if listing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет прав на редактирование")

    update_data: dict = {}

    if title is not None:
        normalized_title = title.strip()
        if len(normalized_title) < 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заголовок должен быть не менее 3 символов")
        update_data["title"] = normalized_title

    if description is not None:
        normalized_description = description.strip()
        if len(normalized_description) < 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Описание должно быть не менее 5 символов")
        update_data["description"] = normalized_description

    if price is not None:
        parsed_price = _parse_decimal(price, "price")
        if parsed_price is not None and parsed_price < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Цена не может быть отрицательной")
        update_data["price"] = parsed_price

    if category_id is not None:
        normalized_category = category_id.strip()
        if not normalized_category:
            update_data["category_id"] = None
        else:
            try:
                parsed_category_id = int(normalized_category)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректная категория")
            category = await CategoryRepository.get_by_id(session=db, obj_id=parsed_category_id)
            if not category:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")
            update_data["category_id"] = parsed_category_id

    parsed_quantity_total = _parse_int(quantity_total, "quantity_total")
    if parsed_quantity_total is not None:
        if parsed_quantity_total < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Количество должно быть не менее 1")
        update_data["quantity_total"] = parsed_quantity_total

    parsed_quantity_available = _parse_int(quantity_available, "quantity_available")
    if parsed_quantity_available is not None:
        if parsed_quantity_available < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Остаток не может быть отрицательным")
        update_data["quantity_available"] = parsed_quantity_available

    parsed_active = _parse_bool(is_active, "is_active")

    parsed_remove_image = _parse_bool(remove_image, "remove_image")
    if parsed_remove_image:
        update_data["image_url"] = None

    if image is not None:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Разрешены только JPG, PNG и WEBP")
        content = await image.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пустой")
        if len(content) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Размер фото не должен превышать 8MB")

        LISTINGS_DIR.mkdir(parents=True, exist_ok=True)
        extension = ALLOWED_IMAGE_TYPES[image.content_type]
        filename = f"listing_{current_user.id}_{uuid4().hex}{extension}"
        file_path = LISTINGS_DIR / filename
        file_path.write_bytes(content)
        update_data["image_url"] = f"/media/listings/{filename}"

    next_total = update_data.get("quantity_total", listing.quantity_total or 1)
    next_available = update_data.get(
        "quantity_available",
        listing.quantity_available if listing.quantity_available is not None else (listing.quantity_total or 1),
    )
    if next_available > next_total:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Остаток не может быть больше общего количества")

    if next_available == 0:
        update_data["is_active"] = False
    elif parsed_active is not None:
        update_data["is_active"] = parsed_active

    if not update_data:
        category_name = listing.category.name if listing.category else None
        return _map_listing_to_ad_read(
            listing=listing,
            category_name=category_name,
            author_name=f"{current_user.name} {current_user.last_name}".strip() or None,
            author_phone=current_user.phone,
            author_avatar_url=current_user.avatar_url,
            is_favorite=False,
        )

    updated = await ListingRepository.update(session=db, obj=listing, **update_data)
    await invalidate_ads_cache()

    category_name = None
    if updated.category_id:
        category_obj = await CategoryRepository.get_by_id(session=db, obj_id=updated.category_id)
        category_name = category_obj.name if category_obj else None

    return _map_listing_to_ad_read(
        listing=updated,
        category_name=category_name,
        author_name=f"{current_user.name} {current_user.last_name}".strip() or None,
        author_phone=current_user.phone,
        author_avatar_url=current_user.avatar_url,
        is_favorite=False,
    )


@router.delete("/{ad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ad(
    ad_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=ad_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")
    if listing.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет прав на удаление")

    await ListingRepository.delete(session=db, obj=listing)
    await invalidate_ads_cache()


@router.post("/{ad_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def add_to_favorite(
    ad_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=ad_id)
    if not listing or not listing.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    existing = await FavoriteRepository.find_by_user_and_listing(
        session=db,
        user_id=current_user.id,
        listing_id=ad_id,
    )
    if existing:
        return

    await FavoriteRepository.create(session=db, user_id=current_user.id, listing_id=ad_id)


@router.delete("/{ad_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_favorite(
    ad_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    favorite = await FavoriteRepository.find_by_user_and_listing(
        session=db,
        user_id=current_user.id,
        listing_id=ad_id,
    )
    if not favorite:
        return

    await FavoriteRepository.delete(session=db, obj=favorite)
