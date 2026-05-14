from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import Listing
from app.repositories.base_repository import BaseRepository


class ListingRepository(BaseRepository[Listing]):
    model = Listing

    @classmethod
    async def get_active(
        cls,
        session: AsyncSession,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Listing]:
        stmt = (
            select(Listing)
            .where(Listing.is_active.is_(True))
            .order_by(Listing.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_user_listings(
        cls,
        session: AsyncSession,
        user_id: int,
        only_active: bool = False,
    ) -> list[Listing]:
        stmt = select(Listing).where(Listing.user_id == user_id).order_by(Listing.created_at.desc())
        if only_active:
            stmt = stmt.where(Listing.is_active.is_(True))

        result = await session.execute(stmt)
        return list(result.scalars().all())
