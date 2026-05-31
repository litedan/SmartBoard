from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user_from_session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.repositories.listing_repository import ListingRepository
from app.schemas.report import ReportCreate, ReportCreateResponse
from app.services.cache import ReportDuplicateError, push_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_session),
):
    listing = await ListingRepository.get_by_id(session=db, obj_id=payload.listing_id)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Администратор не может отправлять жалобы",
        )

    if listing.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя пожаловаться на своё объявление",
        )

    try:
        await push_report(
            listing_id=listing.id,
            user_id=current_user.id,
            reason=payload.reason,
        )
    except ReportDuplicateError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Вы уже отправляли жалобу на это объявление",
        )

    return ReportCreateResponse(message="Жалоба принята. Модераторы рассмотрят её в ближайшее время.")
