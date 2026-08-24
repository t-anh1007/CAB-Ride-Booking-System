import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.models.feature import (
    DemandSignalRequest,
    FeatureIngestRequest,
    FeatureIngestResponse,
    ZoneMetricResponse,
    ZoneMetricUpsertRequest,
)
from app.feature_store.ingestion import (
    get_zone_metric,
    ingest_feature,
    record_demand_signal,
    upsert_zone_metric,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/ingest",
    response_model=FeatureIngestResponse,
    status_code=201,
    summary="Ingest feature sample vào Feature Store (MongoDB)",
)
async def ingest_features(payload: FeatureIngestRequest):
    """
    Nhận feature vector từ Data Sources (GPS, Trip History, Ratings)
    và lưu bất đồng bộ vào MongoDB collection `ml_features`.
    """
    try:
        sample_id = await ingest_feature(payload.model_dump())
        return FeatureIngestResponse(
            sampleId=sample_id,
            zoneId=payload.zoneId,
            source=payload.source,
            capturedAt=datetime.now(tz=timezone.utc).isoformat(),
            message="Feature ingested successfully",
        )
    except Exception as exc:
        logger.error("Failed to ingest feature: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/zone-metrics",
    status_code=200,
    summary="Cập nhật real-time zone metrics (demand/supply) cho Surge prediction",
)
async def update_zone_metrics(payload: ZoneMetricUpsertRequest):
    """
    Upsert real-time demand/supply metrics cho một zone.
    Background scheduler sẽ đọc collection này để predict surge.
    """
    try:
        from datetime import datetime as dt
        now = dt.now(tz=timezone.utc)
        data = {
            "zoneId": payload.zoneId,
            "demand_count": payload.demand_count,
            "supply_count": payload.supply_count,
            "avg_speed_kmh": payload.avg_speed_kmh,
            "rain_indicator": payload.rain_indicator,
            "event_flag": payload.event_flag,
            "hour_of_day": now.hour,
            "day_of_week": now.weekday(),
            "source": payload.source,
        }
        await upsert_zone_metric(data)
        return {"success": True, "zoneId": payload.zoneId, "message": "Zone metric updated"}
    except Exception as exc:
        logger.error("Failed to update zone metric: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/demand-signal",
    status_code=200,
    summary="Ghi nhận một demand signal riêng biệt cho zone metrics",
)
async def create_demand_signal(payload: DemandSignalRequest):
    try:
        snapshot = await record_demand_signal(
            zone_id=payload.zoneId,
            request_id=payload.requestId,
            ttl_seconds=payload.ttlSeconds,
            source=payload.source,
        )
        return {
            "success": True,
            "zoneId": payload.zoneId,
            "demand_count": snapshot["demand_count"],
            "supply_count": snapshot["supply_count"],
            "message": "Demand signal recorded",
        }
    except Exception as exc:
        logger.error("Failed to record demand signal: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/zone-metrics/{zone_id}",
    response_model=ZoneMetricResponse,
    summary="Lấy snapshot zone metrics mới nhất từ Redis/Mongo",
)
async def get_zone_metrics(zone_id: str):
    try:
        snapshot = await get_zone_metric(zone_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Zone metric snapshot not found")

        return ZoneMetricResponse(
            zoneId=snapshot["zoneId"],
            demand_count=int(snapshot.get("demand_count", 0)),
            supply_count=int(snapshot.get("supply_count", 0)),
            avg_speed_kmh=float(snapshot.get("avg_speed_kmh", 20.0)),
            rain_indicator=int(snapshot.get("rain_indicator", 0)),
            event_flag=int(snapshot.get("event_flag", 0)),
            hour_of_day=int(snapshot.get("hour_of_day", 0)),
            day_of_week=int(snapshot.get("day_of_week", 0)),
            source=snapshot.get("source", "surge-metrics"),
            metricsSource=snapshot.get("metricsSource", "zone-metrics"),
            updatedAt=str(snapshot.get("updatedAt")),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to fetch zone metric: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
