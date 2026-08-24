import uuid
import logging
from datetime import datetime, timezone

from app.database import get_mongo_db

logger = logging.getLogger(__name__)


async def ingest_matching_sample(data: dict) -> str:
    """Lưu một sample matching candidate vào MongoDB để dùng cho training."""
    db = get_mongo_db()
    sample_id = str(uuid.uuid4())
    doc = {
        "sampleId": sample_id,
        "rideId": data["rideId"],
        "driverId": data["driverId"],
        "source": data.get("source", "matching"),
        "features": data["features"],
        "label": data.get("label"),
        "capturedAt": datetime.now(tz=timezone.utc),
    }
    await db.ml_matching_samples.insert_one(doc)
    logger.debug(
        "Matching sample ingested: sampleId=%s rideId=%s driverId=%s",
        sample_id,
        data["rideId"],
        data["driverId"],
    )
    return sample_id


async def fetch_matching_samples(limit: int = 10_000) -> list[dict]:
    db = get_mongo_db()
    return await db.ml_matching_samples.find({"label": {"$ne": None}}, {"_id": 0}).to_list(length=limit)


async def upsert_driver_feature_snapshot(driver_id: str, features: dict, source: str = "matching-feature-store") -> dict:
    db = get_mongo_db()
    now = datetime.now(tz=timezone.utc)
    doc = {
        "driverId": driver_id,
        "features": features,
        "source": source,
        "updatedAt": now,
    }
    await db.matching_driver_feature_snapshots.update_one(
        {"driverId": driver_id},
        {"$set": doc},
        upsert=True,
    )
    return doc


async def get_driver_feature_snapshot(driver_id: str) -> dict | None:
    db = get_mongo_db()
    return await db.matching_driver_feature_snapshots.find_one(
        {"driverId": driver_id},
        {"_id": 0},
    )


async def get_driver_feature_snapshots(driver_ids: list[str]) -> dict[str, dict]:
    if not driver_ids:
        return {}

    db = get_mongo_db()
    cursor = db.matching_driver_feature_snapshots.find(
        {"driverId": {"$in": list(set(driver_ids))}},
        {"_id": 0},
    )
    docs = await cursor.to_list(length=len(driver_ids))
    return {
        doc["driverId"]: doc.get("features", {})
        for doc in docs
    }
