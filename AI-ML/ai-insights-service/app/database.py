import redis.asyncio as aioredis
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

_mongo_client = None
_redis_client = None


async def connect_db():
    global _mongo_client, _redis_client
    _mongo_client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=1000)
    _redis_client = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=1,
    )


async def close_db():
    if _mongo_client:
        _mongo_client.close()
    if _redis_client:
        await _redis_client.aclose()


def get_mongo_db():
    if _mongo_client is None:
        raise RuntimeError('MongoDB unavailable')
    return _mongo_client[settings.mongo_db]


def get_redis():
    if _redis_client is None:
        raise RuntimeError('Redis unavailable')
    return _redis_client
