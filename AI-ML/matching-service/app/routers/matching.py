import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.config import settings
from app.feature_store.matching_ingestion import get_driver_feature_snapshots
from app.models.matching import (
    BestDriverRequest,
    BestDriverResponse,
    MatchingHealthResponse,
    MatchingScoreRequest,
    MatchingScoreResponse,
)
from app.serve.matching_predictor import get_matching_model_metadata, predict_matching_scores
from app.utils.matching_utils import (
    apply_hard_constraints,
    build_assignment_event,
    enrich_candidate_features,
    pick_best_candidate,
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def _publish_assignment_event(payload: dict) -> bool:
    try:
        from aiokafka import AIOKafkaProducer
    except ImportError:
        logger.error("Kafka dependency not installed. Cannot publish ride.assigned event.")
        return False

    producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap_servers)
    await producer.start()
    try:
        await producer.send_and_wait(
            settings.ride_assigned_topic,
            json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )
        await producer.flush()
        logger.info("Published %s event for ride=%s driver=%s", settings.ride_assigned_topic, payload["rideId"], payload["driverId"])
        return True
    except Exception as exc:
        logger.error("Failed to publish ride.assigned event: %s", exc, exc_info=True)
        return False
    finally:
        await producer.stop()


@router.post(
    "/score",
    response_model=MatchingScoreResponse,
    summary="Predict matching confidence score cho danh sách tài xế",
)
async def score_matching(payload: MatchingScoreRequest):
    try:
        raw_candidates = [candidate.model_dump(exclude_none=True) for candidate in payload.candidates]
        try:
            snapshots = await get_driver_feature_snapshots([candidate["driver_id"] for candidate in raw_candidates])
        except Exception as exc:
            logger.warning("Feature-store lookup degraded during score request: %s", exc)
            snapshots = {}
        enriched = [
            enrich_candidate_features(candidate, snapshots.get(candidate["driver_id"]))
            for candidate in raw_candidates
        ]
        scores = predict_matching_scores(enriched)
        return MatchingScoreResponse(rideId=payload.rideId, scores=scores)
    except Exception as exc:
        logger.error("score_matching failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/best-driver",
    response_model=BestDriverResponse,
    summary="Chọn tài xế tốt nhất cho cuốc xe và publish sự kiện driver.assigned",
)
async def choose_best_driver(payload: BestDriverRequest, background_tasks: BackgroundTasks):
    """Hard constraints -> feature enrich -> AI/rule scoring -> publish assignment event."""
    ride_id = payload.rideId
    candidates = [c.model_dump(exclude_none=True) for c in payload.candidates]
    force_fallback = payload.force_fallback
    max_distance_km = payload.max_distance_km
    pickup_lat = payload.pickup_lat
    pickup_lng = payload.pickup_lng

    if not candidates:
        raise HTTPException(status_code=422, detail="Candidate list cannot be empty.")

    logger.info(
        "Received best-driver request for ride=%s, force_fallback=%s, max_distance_km=%.2f, pickup=(%s, %s)",
        ride_id, force_fallback, max_distance_km, pickup_lat, pickup_lng
    )

    try:
        # 1. Hard constraints first. This set is authoritative and cannot be bypassed by fallback.
        filtered_candidates, hard_constraint_source, hard_constraints_applied = await apply_hard_constraints(
            candidates=candidates,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            max_distance_km=max_distance_km,
        )
        if not filtered_candidates:
            raise HTTPException(status_code=404, detail="No candidate drivers satisfy hard constraints.")

        # 2. Feature-store enrich. Payload wins when it already provides a concrete runtime value.
        try:
            snapshots = await get_driver_feature_snapshots([candidate["driver_id"] for candidate in filtered_candidates])
        except Exception as exc:
            logger.warning("Feature-store lookup degraded during best-driver request: %s", exc)
            snapshots = {}
        enriched_candidates = [
            enrich_candidate_features(candidate, snapshots.get(candidate["driver_id"]))
            for candidate in filtered_candidates
        ]

        # 3. AI scoring / rule-based fallback only operates inside the hard-constrained candidate set.
        scored_candidates = predict_matching_scores(
            enriched_candidates,
            force_fallback=force_fallback
        )

        best_candidate = pick_best_candidate(scored_candidates)
        best_candidate["assigned_at"] = datetime.now(tz=timezone.utc).isoformat()
        best_candidate["decision_source"] = (
            "rule-based-matching" if best_candidate["matching_reason"].startswith("fallback")
            else "ai-driver-matching"
        )
        best_candidate["model_version"] = get_matching_model_metadata().get("version")

        # 4. Publish Kafka (optional - does not block local testing)
        published = False
        try:
            payload_data = build_assignment_event(ride_id, best_candidate)
            background_tasks.add_task(_publish_assignment_event, payload_data)
            published = True
        except Exception as e:
            logger.warning("Kafka publish failed (normal for local testing): %s", e)

        response = BestDriverResponse(
            rideId=ride_id,
            driver_id=best_candidate["driver_id"],
            confidence_score=best_candidate["confidence_score"],
            matching_reason=best_candidate["matching_reason"],
            selected_by="matching-service",
            decision_source=best_candidate["decision_source"],
            hard_constraint_source=hard_constraint_source,
            hard_constraints_applied=hard_constraints_applied,
            model_version=best_candidate["model_version"],
            assigned_at=best_candidate["assigned_at"],
            published=published,
        )

        return response

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("choose_best_driver failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get(
    "/health",
    response_model=MatchingHealthResponse,
    summary="Health check cho AI Matching service",
)
async def health_check():
    from app.serve.matching_predictor import _load_model, get_matching_model_metadata

    model = _load_model(settings.model_store_path)
    metadata = get_matching_model_metadata()
    return MatchingHealthResponse(
        status="ok",
        model_loaded=bool(model),
        source="ai-driver-matching" if not metadata.get("version") else f'ai-driver-matching:{metadata["version"]}',
        timestamp=datetime.now(tz=timezone.utc).isoformat(),
    )
