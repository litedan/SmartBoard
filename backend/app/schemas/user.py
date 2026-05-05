from pydantic import BaseModel, EmailStr, Field, field_validator


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
