import logging

from fastapi import APIRouter

from app.database import get_redis, get_mongo_db

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health", summary="Service health check")
async def health_check():
    status: dict = {"status": "ok", "service": "matching-service"}

    # ── Redis ─────────────────────────────────────────────────────────────────
    try:
        redis = get_redis()
        await redis.ping()
        status["redis"] = "connected"
    except Exception as exc:
        status["redis"] = f"error: {exc}"
        status["status"] = "degraded"

    # ── MongoDB ───────────────────────────────────────────────────────────────
    try:
        db = get_mongo_db()
        await db.command("ping")
        status["mongodb"] = "connected"
    except Exception as exc:
        status["mongodb"] = f"error: {exc}"
        status["status"] = "degraded"

    return status
