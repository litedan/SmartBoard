"""Shared FastAPI dependencies."""

import logging
from datetime import datetime

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

SESSION_COOKIE_NAME = "session_id"
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.services.cache import delete_session_cache, get_session_user_id, set_session_cache, touch_session_cache

logger = logging.getLogger("smartboard.auth")


async def get_user_from_session_id(session: AsyncSession, session_id: str | None):
    if not session_id:
        return None

    cached_user_id = await get_session_user_id(session_id)
    if cached_user_id:
        user = await UserRepository.get_by_id(session=session, obj_id=cached_user_id)
        if user:
            await touch_session_cache(session_id)
            logger.debug("Authenticated via session cache: user_id=%s", user.id)
            return user
        logger.info("Cached session points to missing user: session_id=%s user_id=%s", session_id, cached_user_id)
        await delete_session_cache(session_id)

    user_session = await UserSessionRepository.get_active_by_session_id(
        session=session,
        session_id=session_id,
    )
    if not user_session:
        logger.info("Session not active: session_id=%s", session_id)
        return None

    user = await UserRepository.get_by_id(session=session, obj_id=user_session.user_id)
    if not user:
        logger.info("Session points to deleted user: session_id=%s user_id=%s", session_id, user_session.user_id)
        await delete_session_cache(session_id)
        await UserSessionRepository.update(
            session=session,
            obj=user_session,
            revoked_at=datetime.utcnow(),
        )
        return None

    await set_session_cache(session_id, user_session.user_id)
    logger.debug("Session restored from database: session_id=%s user_id=%s", session_id, user_session.user_id)
    return user


async def get_ws_current_user(websocket: WebSocket, db: AsyncSession):
    session_id = websocket.cookies.get(SESSION_COOKIE_NAME)
    return await get_user_from_session_id(db, session_id)
