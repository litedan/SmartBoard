from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_session import UserSession
from app.repositories.base_repository import BaseRepository


class UserSessionRepository(BaseRepository[UserSession]):
    model = UserSession

    @classmethod
    async def get_active_by_session_id(
        cls,
        session: AsyncSession,
        session_id: str,
    ) -> UserSession | None:
        stmt = (
            select(UserSession)
            .where(
                UserSession.session_id == session_id,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > datetime.utcnow(),
            )
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()
