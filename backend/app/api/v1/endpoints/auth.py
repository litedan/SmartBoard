from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.schemas.user import UserCreate, UserLogin, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_COOKIE_NAME = "session_id"
SESSION_TTL_DAYS = 7
SESSION_MAX_AGE_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60


async def get_current_user_from_session(
    db: AsyncSession = Depends(get_db),
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Не авторизован")

    user_session = await UserSessionRepository.get_active_by_session_id(
        session=db,
        session_id=session_id,
    )
    if not user_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия недействительна")

    user = await UserRepository.get_by_id(session=db, obj_id=user_session.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

    return user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing_user = await UserRepository.get_by_email(session=db, email=user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    user = await UserRepository.create(
        session=db,
        email=user_data.email,
        name=user_data.name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        hashed_password=hash_password(user_data.password),
    )

    return UserRead.model_validate(user)


@router.post("/login", response_model=UserRead)
async def login_user(
    credentials: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await UserRepository.get_by_email(session=db, email=credentials.email)
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    session_id = uuid4().hex
    expires_at = datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS)

    await UserSessionRepository.create(
        session=db,
        session_id=session_id,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        expires_at=expires_at,
    )

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=SESSION_MAX_AGE_SECONDS,
        path="/",
    )

    return UserRead.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(
    response: Response,
    db: AsyncSession = Depends(get_db),
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    if session_id:
        user_session = await UserSessionRepository.find_one_or_none(session=db, session_id=session_id)
        if user_session and user_session.revoked_at is None:
            await UserSessionRepository.update(
                session=db,
                obj=user_session,
                revoked_at=datetime.utcnow(),
            )

    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"msg": "Вы вышли"}


@router.get("/me", response_model=UserRead)
async def get_me(current_user=Depends(get_current_user_from_session)):
    return UserRead.model_validate(current_user)
