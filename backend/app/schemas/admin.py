from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole
from app.schemas.user import UserRead


class AdminDashboardStats(BaseModel):
    users_total: int
    admins_total: int
    listings_total: int
    active_listings_total: int
    categories_total: int


class AdminListMeta(BaseModel):
    total: int
    limit: int
    offset: int


class AdminListingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    price: Decimal | None
    image_url: str | None
    user_id: int
    category_id: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime | None


class AdminCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class AdminUsersListResponse(BaseModel):
    meta: AdminListMeta
    items: list[UserRead]


class AdminListingsListResponse(BaseModel):
    meta: AdminListMeta
    items: list[AdminListingRead]


class AdminCategoriesListResponse(BaseModel):
    meta: AdminListMeta
    items: list[AdminCategoryRead]


class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminListingStatusUpdate(BaseModel):
    is_active: bool


class AdminCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)

    @field_validator("name", "slug", mode="before")
    @classmethod
    def trim_strings(cls, v):
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Поле не может быть пустым")
            return trimmed
        return v


class AdminCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("name", "slug", mode="before")
    @classmethod
    def trim_strings(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Поле не может быть пустым")
            return trimmed
        return v
