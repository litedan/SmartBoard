from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.repositories.base_repository import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    model = Category

    @classmethod
    async def get_by_slug(cls, session: AsyncSession, slug: str) -> Category | None:
        return await cls.find_one_or_none(session=session, slug=slug)

    @classmethod
    async def get_all_sorted(cls, session: AsyncSession) -> list[Category]:
        stmt = select(Category).order_by(Category.name.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())
