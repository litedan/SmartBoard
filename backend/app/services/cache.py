from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

from app.core.redis import get_redis

logger = logging.getLogger("smartboard.cache")

SESSION_PREFIX = "sb:session:"
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
CATEGORIES_KEY = "sb:categories"
CATEGORIES_TTL_SECONDS = 300
REPORTS_KEY = "sb:reports"
REPORT_DEDUP_PREFIX = "sb:report:dedup:"
REPORT_STATUS_PENDING = "pending"
REPORT_STATUS_REJECTED = "rejected"
REPORT_STATUS_BLOCKED = "blocked"


class ReportDuplicateError(Exception):
    pass


class ReportAlreadyResolvedError(Exception):
    pass


async def set_session_cache(session_id: str, user_id: int) -> None:
    redis = await get_redis()
    await redis.setex(f"{SESSION_PREFIX}{session_id}", SESSION_TTL_SECONDS, str(user_id))
    logger.debug("Session cached: session_id=%s user_id=%s", session_id, user_id)


async def get_session_user_id(session_id: str) -> int | None:
    redis = await get_redis()
    value = await redis.get(f"{SESSION_PREFIX}{session_id}")
    if not value:
        logger.debug("Session cache miss: session_id=%s", session_id)
        return None
    try:
        logger.debug("Session cache hit: session_id=%s", session_id)
        return int(value)
    except ValueError:
        logger.warning("Session cache invalid value: session_id=%s value=%s", session_id, value)
        return None


async def delete_session_cache(session_id: str) -> None:
    redis = await get_redis()
    await redis.delete(f"{SESSION_PREFIX}{session_id}")
    logger.debug("Session cache removed: session_id=%s", session_id)


async def touch_session_cache(session_id: str) -> None:
    redis = await get_redis()
    await redis.expire(f"{SESSION_PREFIX}{session_id}", SESSION_TTL_SECONDS)


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


async def invalidate_categories_cache() -> None:
    redis = await get_redis()
    await redis.delete(CATEGORIES_KEY)


async def invalidate_ads_cache() -> None:
    redis = await get_redis()
    keys = [key async for key in redis.scan_iter("sb:ads:*")]
    if keys:
        await redis.delete(*keys)
        logger.info("Ads cache invalidated: keys=%s", len(keys))


async def ensure_reports_normalized() -> None:
    redis = await get_redis()
    total = await redis.llen(REPORTS_KEY)
    if total <= 0:
        return

    rows = await redis.lrange(REPORTS_KEY, 0, total - 1)
    for index, row in enumerate(rows):
        try:
            item = json.loads(row)
        except json.JSONDecodeError:
            continue
        if not isinstance(item, dict):
            continue

        changed = False
        if not item.get("id"):
            item["id"] = uuid4().hex
            changed = True
        if not item.get("status"):
            item["status"] = REPORT_STATUS_PENDING
            changed = True
        if not item.get("created_at"):
            item["created_at"] = datetime.utcnow().isoformat()
            changed = True

        if changed:
            await redis.lset(REPORTS_KEY, index, json.dumps(item))


async def push_report(listing_id: int, user_id: int | None, reason: str) -> dict[str, Any]:
    redis = await get_redis()

    if user_id is not None:
        dedup_key = f"{REPORT_DEDUP_PREFIX}{user_id}:{listing_id}"
        created = await redis.set(dedup_key, "1", nx=True)
        if not created:
            raise ReportDuplicateError()

    payload = {
        "id": uuid4().hex,
        "listing_id": listing_id,
        "user_id": user_id,
        "reason": reason.strip(),
        "created_at": datetime.utcnow().isoformat(),
        "status": REPORT_STATUS_PENDING,
    }
    await redis.lpush(REPORTS_KEY, json.dumps(payload))
    logger.info("Report queued: listing_id=%s user_id=%s", listing_id, user_id)
    return payload


async def update_report_status(report_id: str, new_status: str) -> dict[str, Any]:
    if new_status not in {REPORT_STATUS_REJECTED, REPORT_STATUS_BLOCKED}:
        raise ValueError("INVALID_REPORT_STATUS")

    await ensure_reports_normalized()

    redis = await get_redis()
    total = await redis.llen(REPORTS_KEY)
    if total <= 0:
        raise ReportAlreadyResolvedError()

    rows = await redis.lrange(REPORTS_KEY, 0, total - 1)
    for index, row in enumerate(rows):
        try:
            item = json.loads(row)
        except json.JSONDecodeError:
            continue
        if not isinstance(item, dict):
            continue

        item_id = item.get("id")
        if not item_id or item_id != report_id:
            continue

        current_status = item.get("status") or REPORT_STATUS_PENDING
        if current_status in {REPORT_STATUS_REJECTED, REPORT_STATUS_BLOCKED}:
            raise ReportAlreadyResolvedError()

        item["status"] = new_status
        item["resolved_at"] = datetime.utcnow().isoformat()
        await redis.lset(REPORTS_KEY, index, json.dumps(item))
        return item

    raise ReportAlreadyResolvedError()


async def get_reports(limit: int, offset: int) -> tuple[list[dict[str, Any]], int]:
    await ensure_reports_normalized()

    redis = await get_redis()
    total = await redis.llen(REPORTS_KEY)
    if total <= 0 or offset >= total:
        return [], total

    rows = await redis.lrange(REPORTS_KEY, 0, total - 1)
    items: list[dict[str, Any]] = []
    for row in rows:
        try:
            payload = json.loads(row)
            if isinstance(payload, dict):
                items.append(payload)
        except json.JSONDecodeError:
            continue

    def _created_ts(item: dict[str, Any]) -> float:
        raw = item.get("created_at")
        if not raw:
            return 0.0
        try:
            return datetime.fromisoformat(str(raw)).timestamp()
        except ValueError:
            return 0.0

    items.sort(
        key=lambda item: (
            0 if (item.get("status") or REPORT_STATUS_PENDING) == REPORT_STATUS_PENDING else 1,
            -_created_ts(item),
        )
    )

    page = items[offset : offset + limit]
    return page, total
