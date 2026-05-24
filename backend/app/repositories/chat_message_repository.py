from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage
from app.repositories.base_repository import BaseRepository


class ChatMessageRepository(BaseRepository[ChatMessage]):
    model = ChatMessage

    @classmethod
    async def list_for_conversation(
        cls,
        session: AsyncSession,
        conversation_id: int,
        limit: int,
        offset: int,
    ) -> list[ChatMessage]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def count_unread_by_conversation_ids(
        cls,
        session: AsyncSession,
        conversation_ids: list[int],
        user_id: int,
    ) -> dict[int, int]:
        if not conversation_ids:
            return {}

        stmt = (
            select(ChatMessage.conversation_id, func.count(ChatMessage.id))
            .where(
                ChatMessage.conversation_id.in_(conversation_ids),
                ChatMessage.sender_id != user_id,
                ChatMessage.is_read.is_(False),
            )
            .group_by(ChatMessage.conversation_id)
        )
        rows = (await session.execute(stmt)).all()
        return {conversation_id: unread_count for conversation_id, unread_count in rows}

    @classmethod
    async def mark_as_read(
        cls,
        session: AsyncSession,
        conversation_id: int,
        user_id: int,
    ) -> int:
        stmt = (
            update(ChatMessage)
            .where(
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.sender_id != user_id,
                ChatMessage.is_read.is_(False),
            )
            .values(is_read=True)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount or 0

    @classmethod
    async def get_last_messages_map(
        cls,
        session: AsyncSession,
        conversation_ids: list[int],
    ) -> dict[int, ChatMessage]:
        if not conversation_ids:
            return {}

        stmt = (
            select(ChatMessage)
            .where(ChatMessage.conversation_id.in_(conversation_ids))
            .order_by(ChatMessage.created_at.desc())
        )
        rows = list((await session.execute(stmt)).scalars().all())

        last_messages: dict[int, ChatMessage] = {}
        for message in rows:
            if message.conversation_id not in last_messages:
                last_messages[message.conversation_id] = message
        return last_messages
