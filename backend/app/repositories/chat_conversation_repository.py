from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_conversation import ChatConversation
from app.repositories.base_repository import BaseRepository


class ChatConversationRepository(BaseRepository[ChatConversation]):
    model = ChatConversation

    @classmethod
    async def find_by_listing_and_participants(
        cls,
        session: AsyncSession,
        listing_id: int,
        buyer_id: int,
        seller_id: int,
    ) -> ChatConversation | None:
        stmt = select(ChatConversation).where(
            ChatConversation.listing_id == listing_id,
            ChatConversation.buyer_id == buyer_id,
            ChatConversation.seller_id == seller_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def list_for_user(
        cls,
        session: AsyncSession,
        user_id: int,
    ) -> list[ChatConversation]:
        stmt = (
            select(ChatConversation)
            .where(or_(ChatConversation.buyer_id == user_id, ChatConversation.seller_id == user_id))
            .order_by(ChatConversation.updated_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_for_user(
        cls,
        session: AsyncSession,
        conversation_id: int,
        user_id: int,
    ) -> ChatConversation | None:
        stmt = select(ChatConversation).where(
            ChatConversation.id == conversation_id,
            or_(ChatConversation.buyer_id == user_id, ChatConversation.seller_id == user_id),
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()
