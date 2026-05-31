# backend/app/api/deps.py
from fastapi import Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.session import get_db
from app.models.user import User
from app.services.cache import get_session_user_id


async def get_current_user_from_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Получить текущего пользователя из сессии (Redis).
    Используется для защиты эндпоинтов, требующих авторизации.
    """
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="Не авторизован. Отсутствует session_id в cookie."
        )
    
    # Получаем user_id из Redis
    user_id = await get_session_user_id(session_id)
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Сессия истекла или недействительна. Войдите заново."
        )
    
    # Получаем пользователя из базы данных
    user = await db.get(User, user_id)
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден"
        )
    
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Получить текущего пользователя (опционально).
    Не вызывает ошибку, если пользователь не авторизован.
    Используется для эндпоинтов, где авторизация не обязательна.
    """
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        return None
    
    user_id = await get_session_user_id(session_id)
    
    if not user_id:
        return None
    
    user = await db.get(User, user_id)
    return user


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Получить текущего администратора.
    Выбрасывает 403, если пользователь не админ.
    """
    user = await get_current_user_from_session(request, db)
    
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Доступ запрещён. Требуются права администратора."
        )
    
    return user