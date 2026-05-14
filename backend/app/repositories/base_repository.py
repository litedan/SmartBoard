from __future__ import annotations

from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    model: type[ModelType] | None = None

    @classmethod
    def _get_model(cls) -> type[ModelType]:
        if cls.model is None:
            raise ValueError(f"`model` is not set for {cls.__name__}")
        return cls.model

    @classmethod
    async def find_one_or_none(
        cls,
        session: AsyncSession,
        **filters: Any,
    ) -> ModelType | None:
        model = cls._get_model()
        query = select(model).filter_by(**filters)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    @classmethod
    async def find_all(
        cls,
        session: AsyncSession,
        limit: int | None = None,
        offset: int | None = None,
        **filters: Any,
    ) -> list[ModelType]:
        model = cls._get_model()
        query = select(model).filter_by(**filters)
        if offset:
            query = query.offset(offset)
        if limit:
            query = query.limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all())

    @classmethod
    async def get_by_id(cls, session: AsyncSession, obj_id: int) -> ModelType | None:
        return await cls.find_one_or_none(session=session, id=obj_id)

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        commit: bool = True,
        **data: Any,
    ) -> ModelType:
        model = cls._get_model()
        obj = model(**data)
        session.add(obj)

        if commit:
            await session.commit()
            await session.refresh(obj)
        else:
            await session.flush()
        return obj

    @classmethod
    async def update(
        cls,
        session: AsyncSession,
        obj: ModelType,
        commit: bool = True,
        **data: Any,
    ) -> ModelType:
        for field, value in data.items():
            setattr(obj, field, value)

        session.add(obj)

        if commit:
            await session.commit()
            await session.refresh(obj)
        else:
            await session.flush()
        return obj

    @classmethod
    async def delete(
        cls,
        session: AsyncSession,
        obj: ModelType,
        commit: bool = True,
    ) -> None:
        await session.delete(obj)
        if commit:
            await session.commit()
        else:
            await session.flush()
