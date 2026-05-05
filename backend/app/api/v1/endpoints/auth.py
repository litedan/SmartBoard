from fastapi import APIRouter
from app.schemas.user import UserCreate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register_user(user_data: UserCreate):
    return {"msg": "ok"}