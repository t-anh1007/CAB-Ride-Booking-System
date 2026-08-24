import uuid
import json
import logging
from datetime import datetime, timezone

from app.config import settings
from app.database import get_mongo_db, get_redis

logger = logging.getLogger(__name__)

ZONE_METRIC_KEY_PREFIX = "zone_metrics"
DEFAULT_CONTEXT_FEATURES = {
    "avg_speed_kmh": 20.0,
    "rain_indicator": 0,
    "event_flag": 0,
}


async def ingest_feature(data: dict) -> str:
    """
    Lưu một feature sample vào MongoDB collection `ml_features`.

    Document schema:
    {
        sampleId:   str (UUID),
        source:     "gps" | "trip_history" | "ratings",
        zoneId:     str,
        features:   { hour_of_day, day_of_week, demand_count, supply_count, ... },
        label:      float | None  (surge multiplier ground truth),
        capturedAt: datetime (UTC)
    }
    """
    db = get_mongo_db()
    sample_id = str(uuid.uuid4())

    doc = {
        "sampleId": sample_id,
        "source": data["source"],
        "zoneId": data["zoneId"],
        "features": data["features"],
        "label": data.get("label"),
        "capturedAt": datetime.now(tz=timezone.utc),
    }

    await db.ml_features.insert_one(doc)
    logger.debug("Feature ingested: sampleId=%s zone=%s", sample_id, data["zoneId"])
    return sample_id


async def upsert_zone_metric(zone_data: dict) -> None:
    """
    Cập nhật real-time metrics của một zone vào collection `zone_metrics`.
    Được dùng bởi background scheduler để fetch dữ liệu mới nhất khi predict.
    """
    db = get_mongo_db()
    zone_id = zone_data["zoneId"]
    now = datetime.now(tz=timezone.utc)

    await db.zone_metrics.update_one(
        {"zoneId": zone_id},
        {
            "$set": {
                **zone_data,
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    logger.debug("Zone metric upserted: zoneId=%s", zone_id)

    try:
        redis = get_redis()
        payload = {
            **zone_data,
            "updatedAt": now.isoformat(),
        }
        await redis.setex(
            f"{ZONE_METRIC_KEY_PREFIX}:{zone_id}",
            settings.surge_redis_ttl,
            json.dumps(payload, ensure_ascii=False),
        )
    except Exception as exc:
        logger.debug("Zone metric Redis cache skipped for zone=%s: %s", zone_id, exc)


async def get_zone_metric(zone_id: str) -> dict | None:
    try:
        redis = get_redis()
        cached = await redis.get(f"{ZONE_METRIC_KEY_PREFIX}:{zone_id}")
        if cached:
            parsed = json.loads(cached)
            parsed["metricsSource"] = "redis-metrics"
            return parsed
    except Exception as exc:
        logger.debug("Zone metric Redis read degraded for zone=%s: %s", zone_id, exc)

    db = get_mongo_db()
    doc = await db.zone_metrics.find_one({"zoneId": zone_id}, {"_id": 0})
    if not doc:
        return None

    doc["metricsSource"] = "mongo-zone-metrics"
    return doc


async def record_demand_signal(zone_id: str, request_id: str, ttl_seconds: int = 300, source: str = "surge-demand-signal") -> dict:
    redis = get_redis()
    demand_key = f"demand:zone:{zone_id}"
    await redis.sadd(demand_key, request_id)
    await redis.expire(demand_key, ttl_seconds)

    demand_count = int(await redis.scard(demand_key))
    supply_count = int(await redis.scard(f"supply:zone:{zone_id}"))
    now = datetime.now(tz=timezone.utc)

    zone_snapshot = {
        "zoneId": zone_id,
        "demand_count": demand_count,
        "supply_count": supply_count,
        "avg_speed_kmh": DEFAULT_CONTEXT_FEATURES["avg_speed_kmh"],
        "rain_indicator": DEFAULT_CONTEXT_FEATURES["rain_indicator"],
        "event_flag": DEFAULT_CONTEXT_FEATURES["event_flag"],
        "hour_of_day": now.hour,
        "day_of_week": now.weekday(),
        "source": source,
    }
    await upsert_zone_metric(zone_snapshot)
    return zone_snapshot


async def get_latest_context_features(zone_id: str) -> dict:
    db = get_mongo_db()
    docs = await (
        db.ml_features.find({"zoneId": zone_id}, {"_id": 0, "features": 1})
        .sort("capturedAt", -1)
        .limit(20)
        .to_list(length=20)
    )

    merged = dict(DEFAULT_CONTEXT_FEATURES)
    for doc in reversed(docs):
        features = doc.get("features") or {}
        for key in DEFAULT_CONTEXT_FEATURES:
            if features.get(key) is not None:
                merged[key] = features[key]
    return merged


async def build_online_zone_context(zone_id: str) -> tuple[dict, str]:
    metric_snapshot = await get_zone_metric(zone_id)
    context_features = await get_latest_context_features(zone_id)
    now = datetime.now(tz=timezone.utc)

    if metric_snapshot:
        snapshot = dict(metric_snapshot)
        snapshot.setdefault("hour_of_day", now.hour)
        snapshot.setdefault("day_of_week", now.weekday())
        snapshot["avg_speed_kmh"] = float(snapshot.get("avg_speed_kmh", context_features["avg_speed_kmh"]))
        snapshot["rain_indicator"] = int(snapshot.get("rain_indicator", context_features["rain_indicator"]))
        snapshot["event_flag"] = int(snapshot.get("event_flag", context_features["event_flag"]))
        return snapshot, snapshot.get("metricsSource", "zone-metrics")

    snapshot = {
        "zoneId": zone_id,
        "demand_count": 0.0,
        "supply_count": 0.0,
        "avg_speed_kmh": float(context_features["avg_speed_kmh"]),
        "rain_indicator": int(context_features["rain_indicator"]),
        "event_flag": int(context_features["event_flag"]),
        "hour_of_day": now.hour,
        "day_of_week": now.weekday(),
        "updatedAt": now.isoformat(),
        "source": "feature-store-context",
    }
    return snapshot, "feature-store-context"
