from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    @classmethod
    async def get_by_email(cls, session: AsyncSession, email: str) -> User | None:
        return await cls.find_one_or_none(session=session, email=email)

    @classmethod
    async def search_by_name(
        cls,
        session: AsyncSession,
        query: str,
        limit: int = 20,
    ) -> list[User]:
        stmt = (
            select(User)
            .where(
                or_(
                    User.name.ilike(f"%{query}%"),
                    User.last_name.ilike(f"%{query}%"),
                )
            )
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
