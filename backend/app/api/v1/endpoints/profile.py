from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user_from_session
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.listing import Listing
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserProfileUpdate, UserPublicProfileResponse, UserPublicRead, UserRead

router = APIRouter(prefix="/profile", tags=["profile"])

ALLOWED_AVATAR_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
AVATARS_DIR = Path(__file__).resolve().parents[3] / "static" / "avatars"


def _extract_old_avatar_path(avatar_url: str | None) -> Path | None:
    if not avatar_url:
        return None
    media_prefix = "/media/"
    if not avatar_url.startswith(media_prefix):
        return None
    relative_path = avatar_url[len(media_prefix) :]
    old_path = (Path(__file__).resolve().parents[3] / "static" / relative_path).resolve()
    static_root = (Path(__file__).resolve().parents[3] / "static").resolve()
    if static_root not in old_path.parents:
        return None
    return old_path


@router.get("/me", response_model=UserRead)
async def get_my_profile(current_user: User = Depends(get_current_user_from_session)):
    return UserRead.model_validate(current_user)


@router.get("/users/{user_id}", response_model=UserPublicProfileResponse)
async def get_public_profile(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await UserRepository.get_by_id(session=db, obj_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    total = await db.scalar(
        select(func.count()).select_from(Listing).where(
            Listing.user_id == user_id,
            Listing.is_active.is_(True),
        )
    )
    return UserPublicProfileResponse(
        user=UserPublicRead.model_validate(user),
        active_listings_total=total or 0,
    )


@router.patch("/me", response_model=UserRead)
async def update_my_profile(
    user_data: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    update_payload: dict = {}

    if user_data.email is not None and user_data.email != current_user.email:
        existing_user = await UserRepository.get_by_email(session=db, email=user_data.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким email уже существует",
            )
        update_payload["email"] = user_data.email

    if user_data.name is not None:
        update_payload["name"] = user_data.name
    if user_data.last_name is not None:
        update_payload["last_name"] = user_data.last_name
    if user_data.phone is not None:
        update_payload["phone"] = user_data.phone

    if user_data.current_password is not None or user_data.new_password is not None:
        if not user_data.current_password or not user_data.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для смены пароля передайте текущий и новый пароль",
            )
        if not verify_password(user_data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Текущий пароль указан неверно",
            )
        update_payload["hashed_password"] = hash_password(user_data.new_password)

    if not update_payload:
        return UserRead.model_validate(current_user)

    updated_user = await UserRepository.update(
        session=db,
        obj=current_user,
        **update_payload,
    )
    return UserRead.model_validate(updated_user)


@router.post("/me/avatar", response_model=UserRead)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только JPG, PNG и WEBP",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл пустой",
        )
    if len(content) > MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Размер файла не должен превышать 5MB",
        )

    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    extension = ALLOWED_AVATAR_TYPES[file.content_type]
    filename = f"user_{current_user.id}_{uuid4().hex}{extension}"
    file_path = AVATARS_DIR / filename
    file_path.write_bytes(content)

    old_avatar_path = _extract_old_avatar_path(current_user.avatar_url)
    if old_avatar_path and old_avatar_path.exists() and old_avatar_path.is_file():
        old_avatar_path.unlink(missing_ok=True)

    updated_user = await UserRepository.update(
        session=db,
        obj=current_user,
        avatar_url=f"/media/avatars/{filename}",
    )
    return UserRead.model_validate(updated_user)
