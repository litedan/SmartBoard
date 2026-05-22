from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    last_name: str
    password: str = Field(..., min_length=6, max_length=100, description="Пароль")
    phone: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Пароль должен быть не менее 6 символов")
        return v

class UserUpdate(BaseModel):
    email: EmailStr
    name: str
    last_name: str
    password: str = Field(..., min_length=6, max_length=100, description="Пароль")
    phone: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Пароль должен быть не менее 6 символов")
        return v


class UserProfileUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, min_length=1, max_length=50)
    phone: str | None = Field(default=None, min_length=3, max_length=20)
    current_password: str | None = Field(default=None, min_length=6, max_length=100)
    new_password: str | None = Field(default=None, min_length=6, max_length=100)

    @field_validator("name", "last_name", "phone", mode="before")
    @classmethod
    def trim_string(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Поле не может быть пустым")
            return trimmed
        return v

    @field_validator("current_password", "new_password", mode="before")
    @classmethod
    def trim_password(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if v is None:
            return v
        if len(v) < 6:
            raise ValueError("Новый пароль должен быть не менее 6 символов")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    last_name: str
    phone: str | None
    role: str
    avatar_url: str | None
    created_at: datetime


class UserPublicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    last_name: str
    phone: str | None
    avatar_url: str | None
    created_at: datetime


class UserPublicProfileResponse(BaseModel):
    user: UserPublicRead
    active_listings_total: int
