from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AdListMeta(BaseModel):
    total: int
    limit: int
    offset: int


class AdBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
    price: Decimal | None = Field(default=None, ge=0)
    category_id: int | None = Field(default=None, ge=1)
    quantity_total: int = Field(default=1, ge=1)

    @field_validator("title", "description", mode="before")
    @classmethod
    def trim_required_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str):
        if len(v.strip()) < 3:
            raise ValueError("Заголовок должен быть не менее 3 символов")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str):
        if len(v.strip()) < 5:
            raise ValueError("Описание должно быть не менее 5 символов")
        return v


class AdCreate(AdBase):
    pass


class AdRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    price: Decimal | None
    image_url: str | None
    user_id: int
    category_id: int | None
    quantity_total: int
    quantity_available: int
    category_name: str | None = None
    author_name: str | None = None
    author_phone: str | None = None
    author_avatar_url: str | None = None
    is_favorite: bool = False
    is_active: bool
    created_at: datetime
    updated_at: datetime | None


class AdListResponse(BaseModel):
    meta: AdListMeta
    items: list[AdRead]


class AdUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=5, max_length=5000)
    price: Decimal | None = Field(default=None, ge=0)
    category_id: int | None = Field(default=None, ge=1)
    quantity_total: int | None = Field(default=None, ge=1)
    quantity_available: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
