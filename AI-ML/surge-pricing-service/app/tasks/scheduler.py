"""
scheduler.py
────────────
Background task: mỗi SURGE_PUSH_INTERVAL_SECONDS giây,
fetch zone metrics từ Redis (live) hoặc MongoDB (fallback),
predict surge multiplier bằng XGBoost, và PUSH kết quả
vào Redis với key `surge_zone:{zoneId}`.

Pricing Service (Node.js) chỉ cần GET từ Redis.
"""

import json
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.database import get_mongo_db, get_redis
from app.feature_store.ingestion import build_online_zone_context
from app.kafka_producer import publish_surge_updated
from app.serve.surge_predictor import get_surge_model_metadata, predict_surge
from app.trainers.surge_trainer import run_surge_training

logger = logging.getLogger(__name__)

# ── Scheduler singleton ────────────────────────────────────────────────────────
_scheduler = AsyncIOScheduler(timezone="UTC")

async def _build_live_zones(redis) -> list[dict]:
    """
    Scan Redis để tìm tất cả zone đang có tài xế active (supply:zone:*).
    Đây là các Geohash zone thực tế do driver-service ghi vào.
    Với mỗi zone: đọc supply count + demand count → làm input feature XGBoost.
    """
    if redis is None:
        return []

    live_zones = []
    try:
        supply_keys = await redis.keys("supply:zone:*")
        if not supply_keys:
            return []

        for key in supply_keys:
            # key dạng "supply:zone:w7epx" → lấy phần cuối
            geohash = key.split(":")[-1]
            supply_count = await redis.scard(f"supply:zone:{geohash}")
            demand_count = await redis.scard(f"demand:zone:{geohash}")

            live_zones.append({
                "zoneId": geohash,
                "supply_count": float(supply_count),
                "demand_count": float(demand_count),
                "source": "redis-live-scan",
            })

        logger.info(
            "📍 [Surge Push] %d live zones từ Redis: %s",
            len(live_zones),
            [z["zoneId"] for z in live_zones],
        )
    except Exception as exc:
        logger.error("❌ [_build_live_zones] Lỗi scan Redis: %s", exc)

    return live_zones


async def _push_surge_for_all_zones() -> None:
    """
    Core scheduled task.
    Priority order:
      1. Live zones từ Redis (supply:zone:* keys của driver-service)
      2. Zones từ MongoDB zone_metrics collection
      3. Cold-start mock zones (cuối cùng)
    """
    try:
        db = get_mongo_db()
        try:
            redis = get_redis()
        except RuntimeError:
            logger.warning("Redis not available, skipping live zone scan.")
            redis = None

        # ── 1. Ưu tiên zones live từ Redis ───────────────────────────────────
        zones = []
        if redis:
            zones = await _build_live_zones(redis)

        # ── 2. Fallback: zones từ MongoDB ─────────────────────────────────────
        if not zones:
            zones = await db.zone_metrics.find({}, {"_id": 0}).to_list(length=200)

        # ── 3. Nếu vẫn không có zones nào, bỏ qua không làm gì cả ────────────
        if not zones:
            logger.info("ℹ️ Không có tài xế nào active. Tạm ngưng chạy AI...")
            return

        # ── 4. Enrich với current hour/day ────────────────────────────────────
        now = datetime.now(tz=timezone.utc)
        model_metadata = get_surge_model_metadata(settings.model_store_path)
        model_version = model_metadata.get("version")
        for zone in zones:
            zone.setdefault("hour_of_day", now.hour)
            zone.setdefault("day_of_week", now.weekday())

        # ── 5. Predict & Push ──────────────────────────────────────────────────
        pushed: list[dict] = []
        for zone in zones:
            zone_id = zone.get("zoneId", "zone_unknown")
            online_context, metrics_source = await build_online_zone_context(zone_id)
            merged_zone = {
                "zoneId": zone_id,
                "demand_count": float(zone.get("demand_count", online_context.get("demand_count", 0.0))),
                "supply_count": float(zone.get("supply_count", online_context.get("supply_count", 0.0))),
                "avg_speed_kmh": float(online_context.get("avg_speed_kmh", 20.0)),
                "rain_indicator": int(online_context.get("rain_indicator", 0)),
                "event_flag": int(online_context.get("event_flag", 0)),
                "hour_of_day": zone.get("hour_of_day", online_context.get("hour_of_day", now.hour)),
                "day_of_week": zone.get("day_of_week", online_context.get("day_of_week", now.weekday())),
                "source": zone.get("source", online_context.get("source", "surge-pricing-service")),
            }
            surge = predict_surge(merged_zone, settings.model_store_path)
            pushed.append({"zone": zone_id, "surge": surge})

            if redis:
                payload = json.dumps(
                    {
                        "multiplier": surge,
                        "zoneId": zone_id,
                        "updatedAt": now.isoformat(),
                        "source": "surge-pricing-service",
                        "modelVersion": model_version,
                        "metricsSource": metrics_source,
                    },
                    ensure_ascii=False,
                )

                redis_key = f"surge_zone:{zone_id}"
                await redis.setex(redis_key, settings.surge_redis_ttl, payload)
            else:
                logger.info("Redis not available, skipping surge push for zone=%s surge=%.2f", zone_id, surge)

            # Broadcast để downstream consumer theo dõi surge update.
            await publish_surge_updated(
                zone_id=zone_id,
                surge_multiplier=surge,
                updated_at=now.isoformat(),
                source="surge-pricing-service",
                model_version=model_version,
                metrics_snapshot={
                    "demand_count": merged_zone.get("demand_count"),
                    "supply_count": merged_zone.get("supply_count"),
                    "avg_speed_kmh": merged_zone.get("avg_speed_kmh"),
                    "rain_indicator": merged_zone.get("rain_indicator"),
                    "event_flag": merged_zone.get("event_flag"),
                    "metrics_source": metrics_source,
                },
            )

        if pushed:
            logger.info(
                "✅ [Surge Push] %d zones pushed → %s",
                len(pushed),
                pushed,
            )

    except Exception as exc:
        logger.error("❌ [Surge Push] Task failed: %s", exc, exc_info=True)


async def _retrain_surge_model() -> None:
    try:
        result = await run_surge_training()
        logger.info("✅ Surge retrain completed: %s", result)
    except Exception as exc:
        logger.error("❌ Surge retrain failed: %s", exc, exc_info=True)


# ── Public API ─────────────────────────────────────────────────────────────────
async def start_scheduler() -> None:
    _scheduler.add_job(
        _push_surge_for_all_zones,
        trigger="interval",
        seconds=settings.surge_push_interval_seconds,
        id="surge_push_job",
        replace_existing=True,
        next_run_time=datetime.now(tz=timezone.utc),
    )
    _scheduler.start()
    logger.info(
        "✅ Surge scheduler started (interval=%ds, TTL=%ds).",
        settings.surge_push_interval_seconds,
        settings.surge_redis_ttl,
    )

    _scheduler.add_job(
        _retrain_surge_model,
        trigger="interval",
        seconds=settings.surge_retrain_interval_seconds,
        id="surge_retrain_job",
        replace_existing=True,
        next_run_time=datetime.now(tz=timezone.utc),
    )
    logger.info(
        "✅ Surge retrain scheduler started (interval=%ds).",
        settings.surge_retrain_interval_seconds,
    )


async def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("🛑 Surge scheduler stopped.")
