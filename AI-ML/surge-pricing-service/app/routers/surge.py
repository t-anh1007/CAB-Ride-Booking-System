import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.database import get_redis
from app.feature_store.ingestion import build_online_zone_context, record_demand_signal
from app.models.surge import SurgeEvaluationRequest, SurgeEvaluationResponse
from app.serve.surge_predictor import get_surge_model_metadata, predict_surge

router = APIRouter()
logger = logging.getLogger(__name__)

DEMAND_TTL_SECONDS = 300


@router.post(
    "/evaluate",
    response_model=SurgeEvaluationResponse,
    summary="Evaluate dynamic surge multiplier for one zone",
)
async def evaluate_surge(payload: SurgeEvaluationRequest):
    try:
        redis = get_redis()
        zone_id = payload.zoneId
        computed_at = datetime.now(tz=timezone.utc).isoformat()
        model_metadata = get_surge_model_metadata(settings.model_store_path)
        model_version = model_metadata.get("version")

        zone_context, metrics_source = await build_online_zone_context(zone_id)
        supply_count = int(zone_context.get("supply_count", 0))
        demand_count = int(zone_context.get("demand_count", 0))
        compatibility_mode = zone_context.get("source") in (None, "feature-store-context", "compat-demand-signal")

        # Compatibility mode: until upstream metrics lane is fully integrated,
        # one evaluate request may still register one demand signal.
        if compatibility_mode and payload.requestId:
            zone_context = await record_demand_signal(
                zone_id=zone_id,
                request_id=payload.requestId,
                ttl_seconds=DEMAND_TTL_SECONDS,
                source="compat-demand-signal",
            )
            metrics_source = "compat-demand-signal"
            supply_count = int(zone_context.get("supply_count", 0))
            demand_count = int(zone_context.get("demand_count", 0))

        if supply_count <= 0:
            return SurgeEvaluationResponse(
                zoneId=zone_id,
                supplyCount=supply_count,
                demandCount=demand_count,
                surgeMultiplier=1.0,
                surgeSource="rule-no-driver",
                metricsSource=metrics_source,
                modelVersion=model_version,
                computedAt=computed_at,
                available=False,
            )

        if demand_count <= 1:
            return SurgeEvaluationResponse(
                zoneId=zone_id,
                supplyCount=supply_count,
                demandCount=demand_count,
                surgeMultiplier=1.0,
                surgeSource="rule-low-demand",
                metricsSource=metrics_source,
                modelVersion=model_version,
                computedAt=computed_at,
                available=True,
            )

        cached_raw = await redis.get(f"surge_zone:{zone_id}")
        if cached_raw:
            import json

            parsed = json.loads(cached_raw)
            multiplier = float(parsed.get("multiplier", 1.0))
            return SurgeEvaluationResponse(
                zoneId=zone_id,
                supplyCount=supply_count,
                demandCount=demand_count,
                surgeMultiplier=max(1.0, multiplier),
                surgeSource=parsed.get("source", "surge-cache"),
                metricsSource=parsed.get("metricsSource", metrics_source),
                modelVersion=parsed.get("modelVersion", model_version),
                computedAt=parsed.get("updatedAt", computed_at),
                available=True,
            )

        multiplier = predict_surge(zone_context, settings.model_store_path)
        return SurgeEvaluationResponse(
            zoneId=zone_id,
            supplyCount=supply_count,
            demandCount=demand_count,
            surgeMultiplier=max(1.0, float(multiplier)),
            surgeSource="ai-on-demand-fallback",
            metricsSource=metrics_source,
            modelVersion=model_version,
            computedAt=computed_at,
            available=True,
        )
    except RuntimeError as exc:
        logger.warning("Surge evaluation degraded: %s", exc)
        return SurgeEvaluationResponse(
            zoneId=payload.zoneId,
            supplyCount=None,
            demandCount=None,
            surgeMultiplier=1.0,
            surgeSource="service-fallback",
            metricsSource="service-fallback",
            modelVersion=None,
            computedAt=datetime.now(tz=timezone.utc).isoformat(),
            available=True,
        )
    except Exception as exc:
        logger.error("evaluate_surge failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
