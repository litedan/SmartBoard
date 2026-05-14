from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.favorite import Favorite
from app.repositories.base_repository import BaseRepository


class FavoriteRepository(BaseRepository[Favorite]):
    model = Favorite

    @classmethod
    async def find_by_user_and_listing(
        cls,
        session: AsyncSession,
        user_id: int,
        listing_id: int,
    ) -> Favorite | None:
        return await cls.find_one_or_none(
            session=session,
            user_id=user_id,
            listing_id=listing_id,
        )

    @classmethod
    async def get_user_favorites(
        cls,
        session: AsyncSession,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Favorite]:
        stmt = (
            select(Favorite)
            .where(Favorite.user_id == user_id)
            .order_by(Favorite.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
