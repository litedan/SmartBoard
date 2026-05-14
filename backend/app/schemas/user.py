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
