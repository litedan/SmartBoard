from fastapi import APIRouter

from app.core.redis import ping_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    redis_ok = await ping_redis()
    return {
        "status": "ok",
        "redis": "connected" if redis_ok else "unavailable",
    }
