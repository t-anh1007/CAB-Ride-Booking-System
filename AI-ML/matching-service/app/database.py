import logging
import redis.asyncio as aioredis
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)

# ── Singletons ──────────────────────────────────────────────────────────────
_mongo_client: AsyncIOMotorClient | None = None
_redis_client: aioredis.Redis | None = None


# ── Lifecycle ────────────────────────────────────────────────────────────────
async def connect_db() -> None:
    global _mongo_client, _redis_client

    _mongo_client = AsyncIOMotorClient(settings.mongo_uri)
    try:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
        )
        await _redis_client.ping()
        logger.info("✅ Redis connected:   %s", settings.redis_url)
    except Exception as exc:
        logger.warning("⚠️  Redis not available: %s. Some features may not work.", exc)
        _redis_client = None

    # Verify MongoDB
    await _mongo_client.admin.command("ping")
    logger.info("✅ MongoDB connected: %s", settings.mongo_uri)


async def close_db() -> None:
    global _mongo_client, _redis_client
    if _mongo_client:
        _mongo_client.close()
    if _redis_client:
        await _redis_client.aclose()
    logger.info("🔌 DB connections closed.")


# ── Accessors ─────────────────────────────────────────────────────────────────
def get_mongo_db() -> AsyncIOMotorDatabase:
    if _mongo_client is None:
        raise RuntimeError("MongoDB client not initialised — call connect_db() first.")
    return _mongo_client[settings.mongo_db]


def get_redis() -> aioredis.Redis:
    if _redis_client is None:
        raise RuntimeError("Redis client not initialised — Redis is not available.")
    return _redis_client
