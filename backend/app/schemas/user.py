from datetime import datetime
import re

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

NICKNAME_PATTERN = re.compile(r"^[A-Za-zА-Яа-яЁё0-9_-]+$")


def validate_nickname(value: str, field_label: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_label} не может быть пустым")
    if any(char.isspace() for char in cleaned):
        raise ValueError(f"{field_label} не должен содержать пробелы")
    if not NICKNAME_PATTERN.fullmatch(cleaned):
        raise ValueError(f"{field_label} содержит недопустимые символы")
    return cleaned


def normalize_ru_phone(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Телефон не может быть пустым")

    digits = "".join(ch for ch in cleaned if ch.isdigit())
    if len(digits) != 11:
        raise ValueError("Телефон должен содержать 11 цифр")
    if digits[0] not in {"7", "8"}:
        raise ValueError("Телефон должен начинаться с +7 или 8")

    normalized_digits = "7" + digits[1:]
    return f"+{normalized_digits}"


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    last_name: str
    password: str = Field(..., min_length=6, max_length=100, description="Пароль")
    phone: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if any(char.isspace() for char in v):
            raise ValueError("Пароль не должен содержать пробелы")
        if len(v) < 6:
            raise ValueError("Пароль должен быть не менее 6 символов")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return validate_nickname(v, "Имя")

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, v):
        return validate_nickname(v, "Ник")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        return normalize_ru_phone(v)

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

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return validate_nickname(v, "Имя")

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, v):
        return validate_nickname(v, "Ник")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        return normalize_ru_phone(v)


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

    @field_validator("name")
    @classmethod
    def validate_profile_name(cls, v):
        if v is None:
            return v
        return validate_nickname(v, "Имя")

    @field_validator("last_name")
    @classmethod
    def validate_profile_last_name(cls, v):
        if v is None:
            return v
        return validate_nickname(v, "Ник")

    @field_validator("phone")
    @classmethod
    def validate_profile_phone(cls, v):
        if v is None:
            return v
        return normalize_ru_phone(v)

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

class EmailAvailabilityResponse(BaseModel):
    available: bool


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_login_password(cls, v: str) -> str:
        if any(char.isspace() for char in v):
            raise ValueError("Пароль не должен содержать пробелы")
        return v


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
