from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatParticipant(BaseModel):
    id: int
    name: str
    last_name: str
    avatar_url: str | None = None


class ChatConversationRead(BaseModel):
    id: int
    listing_id: int
    listing_title: str
    listing_image_url: str | None = None
    other_user: ChatParticipant
    last_message_text: str | None = None
    last_message_at: datetime | None = None
    last_message_sender_id: int | None = None
    unread_count: int = 0
    updated_at: datetime


class ChatConversationListResponse(BaseModel):
    items: list[ChatConversationRead]


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    text: str
    is_read: bool
    created_at: datetime


class ChatMessageListResponse(BaseModel):
    items: list[ChatMessageRead]
    total: int
    limit: int
    offset: int


class ChatMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def trim_text(cls, value: str):
        stripped = value.strip()
        if not stripped:
            raise ValueError("Сообщение не может быть пустым")
        return stripped


class ChatReadUpdateResponse(BaseModel):
    updated: int
