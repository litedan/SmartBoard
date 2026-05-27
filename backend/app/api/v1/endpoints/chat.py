from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_ws_current_user
from app.api.v1.endpoints.auth import get_current_user_from_session
from app.db.session import SessionLocal, get_db
from app.models.chat_message import ChatMessage
from app.models.listing import Listing
from app.models.user import User
from app.repositories.chat_conversation_repository import ChatConversationRepository
from app.repositories.chat_message_repository import ChatMessageRepository
from app.repositories.listing_repository import ListingRepository
from app.schemas.chat import (
    ChatConversationListResponse,
    ChatConversationRead,
    ChatMessageCreate,
    ChatMessageListResponse,
    ChatMessageRead,
    ChatParticipant,
    ChatReadUpdateResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)

    async def send_json(self, user_id: int, payload: dict) -> bool:
        websocket = self.active_connections.get(user_id)
        if not websocket:
            return False
        try:
            await websocket.send_json(payload)
            return True
        except Exception:
            self.disconnect(user_id)
            return False


manager = ConnectionManager()


@router.post("/conversations/by-listing/{listing_id}", response_model=ChatConversationRead)
async def create_or_get_conversation_by_listing(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=listing_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    if listing.user_id == current_user.id:
        conversations = await ChatConversationRepository.list_for_listing_as_seller(
            session=db,
            listing_id=listing.id,
            seller_id=current_user.id,
        )
        if not conversations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пока никто не написал по этому объявлению",
            )
        conversation = conversations[0]
        other_user = await db.get(User, conversation.buyer_id)
        if not other_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Покупатель не найден")
    else:
        conversation = await ChatConversationRepository.find_by_listing_and_participants(
            session=db,
            listing_id=listing.id,
            buyer_id=current_user.id,
            seller_id=listing.user_id,
        )

        if not conversation:
            conversation = await ChatConversationRepository.create(
                session=db,
                listing_id=listing.id,
                buyer_id=current_user.id,
                seller_id=listing.user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

        other_user = await db.get(User, conversation.seller_id)
        if not other_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Продавец не найден")

    return ChatConversationRead(
        id=conversation.id,
        listing_id=listing.id,
        listing_title=listing.title,
        listing_image_url=listing.image_url,
        other_user=ChatParticipant(
            id=other_user.id,
            name=other_user.name,
            last_name=other_user.last_name,
            avatar_url=other_user.avatar_url,
        ),
        updated_at=conversation.updated_at,
    )


@router.get("/conversations", response_model=ChatConversationListResponse)
async def get_my_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    conversations = await ChatConversationRepository.list_for_user(session=db, user_id=current_user.id)
    if not conversations:
        return ChatConversationListResponse(items=[])

    conversation_ids = [conversation.id for conversation in conversations]
    listing_ids = [conversation.listing_id for conversation in conversations]
    other_user_ids = [
        conversation.seller_id if conversation.buyer_id == current_user.id else conversation.buyer_id
        for conversation in conversations
    ]

    listing_rows = (
        await db.execute(select(Listing.id, Listing.title, Listing.image_url).where(Listing.id.in_(listing_ids)))
    ).all()
    listing_map = {row[0]: {"title": row[1], "image_url": row[2]} for row in listing_rows}

    user_rows = (
        await db.execute(select(User).where(User.id.in_(list(set(other_user_ids)))))
    ).scalars().all()
    user_map = {user.id: user for user in user_rows}

    unread_map = await ChatMessageRepository.count_unread_by_conversation_ids(
        session=db,
        conversation_ids=conversation_ids,
        user_id=current_user.id,
    )
    last_message_map = await ChatMessageRepository.get_last_messages_map(
        session=db,
        conversation_ids=conversation_ids,
    )

    items: list[ChatConversationRead] = []
    for conversation in conversations:
        listing_data = listing_map.get(conversation.listing_id)
        if not listing_data:
            continue

        other_user_id = conversation.seller_id if conversation.buyer_id == current_user.id else conversation.buyer_id
        other_user = user_map.get(other_user_id)
        if not other_user:
            continue

        last_message = last_message_map.get(conversation.id)
        items.append(
            ChatConversationRead(
                id=conversation.id,
                listing_id=conversation.listing_id,
                listing_title=listing_data["title"],
                listing_image_url=listing_data["image_url"],
                other_user=ChatParticipant(
                    id=other_user.id,
                    name=other_user.name,
                    last_name=other_user.last_name,
                    avatar_url=other_user.avatar_url,
                ),
                last_message_text=last_message.text if last_message else None,
                last_message_at=last_message.created_at if last_message else None,
                last_message_sender_id=last_message.sender_id if last_message else None,
                unread_count=unread_map.get(conversation.id, 0),
                updated_at=conversation.updated_at,
            )
        )

    return ChatConversationListResponse(items=items)


@router.get("/conversations/{conversation_id}/messages", response_model=ChatMessageListResponse)
async def get_conversation_messages(
    conversation_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    conversation = await ChatConversationRepository.get_for_user(
        session=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Диалог не найден")

    messages = await ChatMessageRepository.list_for_conversation(
        session=db,
        conversation_id=conversation.id,
        limit=limit,
        offset=offset,
    )
    total = await db.scalar(
        select(func.count(ChatMessage.id)).where(ChatMessage.conversation_id == conversation.id)
    )
    return ChatMessageListResponse(
        items=[ChatMessageRead.model_validate(message) for message in messages],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.post("/conversations/{conversation_id}/read", response_model=ChatReadUpdateResponse)
async def mark_conversation_read(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    conversation = await ChatConversationRepository.get_for_user(
        session=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Диалог не найден")

    updated = await ChatMessageRepository.mark_as_read(
        session=db,
        conversation_id=conversation.id,
        user_id=current_user.id,
    )
    return ChatReadUpdateResponse(updated=updated)


@router.websocket("/conversations/{conversation_id}/messages")
async def websocket_endpoint(websocket: WebSocket, conversation_id: int):
    async with SessionLocal() as db:
        current_user = await get_ws_current_user(websocket, db)
        if not current_user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        conversation = await ChatConversationRepository.get_for_user(
            session=db,
            conversation_id=conversation_id,
            user_id=current_user.id,
        )
        if not conversation:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await ChatMessageRepository.mark_as_read(
            session=db,
            conversation_id=conversation_id,
            user_id=current_user.id,
        )

        other_user_id = (
            conversation.seller_id if conversation.buyer_id == current_user.id else conversation.buyer_id
        )

    await manager.connect(current_user.id, websocket)

    try:
        while True:
            try:
                payload = await websocket.receive_json()
                message_create = ChatMessageCreate.model_validate(payload)
            except ValidationError as exc:
                await websocket.send_json({"type": "error", "message": str(exc.errors()[0]["msg"])})
                continue
            except ValueError:
                await websocket.send_json({"type": "error", "message": "Некорректный JSON"})
                continue

            async with SessionLocal() as db:
                conversation = await ChatConversationRepository.get_for_user(
                    session=db,
                    conversation_id=conversation_id,
                    user_id=current_user.id,
                )
                if not conversation:
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    break

                message = await ChatMessageRepository.create(
                    session=db,
                    conversation_id=conversation.id,
                    sender_id=current_user.id,
                    text=message_create.text,
                    is_read=False,
                    created_at=datetime.utcnow(),
                )

                await ChatConversationRepository.update(
                    session=db,
                    obj=conversation,
                    updated_at=message.created_at,
                )

                message_read = ChatMessageRead.model_validate(message)
                envelope = {"type": "message", "data": message_read.model_dump(mode="json")}

            await manager.send_json(current_user.id, envelope)
            await manager.send_json(other_user_id, envelope)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(current_user.id)
