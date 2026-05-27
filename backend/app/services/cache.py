from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from app.core.redis import get_redis

SESSION_PREFIX = "sb:session:"
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
CATEGORIES_KEY = "sb:categories"
CATEGORIES_TTL_SECONDS = 300
REPORTS_KEY = "sb:reports"


async def set_session_cache(session_id: str, user_id: int) -> None:
    redis = await get_redis()
    await redis.setex(f"{SESSION_PREFIX}{session_id}", SESSION_TTL_SECONDS, str(user_id))


async def get_session_user_id(session_id: str) -> int | None:
    redis = await get_redis()
    value = await redis.get(f"{SESSION_PREFIX}{session_id}")
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


async def delete_session_cache(session_id: str) -> None:
    redis = await get_redis()
    await redis.delete(f"{SESSION_PREFIX}{session_id}")


async def get_categories_cache() -> list[dict[str, Any]] | None:
    redis = await get_redis()
    raw = await redis.get(CATEGORIES_KEY)
    if not raw:
        return None
    try:
        payload = json.loads(raw)
        return payload if isinstance(payload, list) else None
    except json.JSONDecodeError:
        return None


async def set_categories_cache(categories: list[dict[str, Any]]) -> None:
    redis = await get_redis()
    await redis.setex(CATEGORIES_KEY, CATEGORIES_TTL_SECONDS, json.dumps(categories, default=str))


async def invalidate_ads_cache() -> None:
    redis = await get_redis()
    keys = [key async for key in redis.scan_iter("sb:ads:*")]
    if keys:
        await redis.delete(*keys)


async def push_report(listing_id: int, user_id: int | None, reason: str) -> None:
    redis = await get_redis()
    payload = {
        "listing_id": listing_id,
        "user_id": user_id,
        "reason": reason.strip(),
        "created_at": datetime.utcnow().isoformat(),
    }
    await redis.lpush(REPORTS_KEY, json.dumps(payload))
