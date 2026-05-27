"""Shared FastAPI dependencies."""

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

SESSION_COOKIE_NAME = "session_id"
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.cache import get_session_user_id, set_session_cache


async def get_user_from_session_id(session: AsyncSession, session_id: str | None):
    if not session_id:
        return None

    cached_user_id = await get_session_user_id(session_id)
    if cached_user_id:
        user = await UserRepository.get_by_id(session=session, obj_id=cached_user_id)
        if user:
            return user

    user_session = await UserSessionRepository.get_active_by_session_id(
        session=session,
        session_id=session_id,
    )
    if not user_session:
        return None

    await set_session_cache(session_id, user_session.user_id)
    return await UserRepository.get_by_id(session=session, obj_id=user_session.user_id)


async def get_ws_current_user(websocket: WebSocket, db: AsyncSession):
    session_id = websocket.cookies.get(SESSION_COOKIE_NAME)
    return await get_user_from_session_id(db, session_id)
