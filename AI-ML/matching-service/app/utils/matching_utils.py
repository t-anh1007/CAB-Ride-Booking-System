"""Utility helpers for hard constraints, feature enrichment, and fallback scoring."""
import logging
from typing import List, Optional

from app.database import get_redis

logger = logging.getLogger(__name__)

MATCHING_FEATURE_ORDER = [
    "distance_km",
    "driver_rating",
    "driver_completed_trips",
    "driver_acceptance_rate",
    "historical_matching_score",
    "eta_seconds",
    "surge_multiplier",
    "driver_busy_time",
]

ENRICHABLE_FEATURE_KEYS = [
    "driver_rating",
    "driver_completed_trips",
    "driver_acceptance_rate",
    "historical_matching_score",
    "eta_seconds",
    "surge_multiplier",
    "driver_busy_time",
]

DEFAULT_FEATURE_VALUES = {
    "distance_km": 5.0,
    "driver_rating": 4.0,
    "driver_completed_trips": 0,
    "driver_acceptance_rate": 0.8,
    "historical_matching_score": 0.5,
    "eta_seconds": 300,
    "surge_multiplier": 1.0,
    "driver_busy_time": 0.0,
}


def build_feature_vector(candidate: dict) -> list[float]:
    return [
        float(candidate.get("distance_km", 5.0)),
        float(candidate.get("driver_rating", 4.0)),
        float(candidate.get("driver_completed_trips", 0)),
        float(candidate.get("driver_acceptance_rate", 0.8)),
        float(candidate.get("historical_matching_score", 0.5)),
        float(candidate.get("eta_seconds", 300)),
        float(candidate.get("surge_multiplier", 1.0)),
        float(candidate.get("driver_busy_time", 0)),
    ]


def compute_rule_based_score(candidate: dict) -> float:
    distance = max(0.1, float(candidate.get("distance_km", 5.0)))
    rating = min(max(float(candidate.get("driver_rating", 4.0)), 0.0), 5.0)
    acceptance = min(max(float(candidate.get("driver_acceptance_rate", 0.8)), 0.0), 1.0)
    busy = min(max(float(candidate.get("driver_busy_time", 0.0)), 0.0), 120.0)
    eta = min(max(float(candidate.get("eta_seconds", 300.0)), 0.0), 900.0)

    distance_score = 1.0 / (1.0 + distance)
    rating_score = rating / 5.0
    busy_score = 1.0 - (busy / 120.0)
    eta_score = 1.0 - (eta / 900.0)

    score = (
        0.40 * distance_score
        + 0.30 * rating_score
        + 0.15 * acceptance
        + 0.10 * busy_score
        + 0.05 * eta_score
    )
    return max(0.0, min(1.0, score))


def pick_best_candidate(candidates: list[dict]) -> dict:
    if not candidates:
        raise ValueError("No candidate drivers available.")
    best = max(
        candidates,
        key=lambda item: (
            item.get("confidence_score", 0.0),
            -float(item.get("features", {}).get("distance_km", 999.0)),
        ),
    )
    return best


def build_assignment_event(ride_id: str, best_driver: dict) -> dict:
    return {
        "rideId": ride_id,
        "driverId": best_driver["driver_id"],
        "confidenceScore": best_driver["confidence_score"],
        "matchingReason": best_driver["matching_reason"],
        "decisionSource": best_driver.get("decision_source", "ai-driver-matching"),
        "modelVersion": best_driver.get("model_version"),
        "assignedAt": best_driver.get("assigned_at"),
        "source": "ai-driver-matching",
    }


def enrich_candidate_features(candidate: dict, feature_snapshot: Optional[dict] = None) -> dict:
    merged = dict(candidate)
    feature_snapshot = feature_snapshot or {}

    for key in ENRICHABLE_FEATURE_KEYS:
        if merged.get(key) is None and feature_snapshot.get(key) is not None:
            merged[key] = feature_snapshot[key]

    for key, default_value in DEFAULT_FEATURE_VALUES.items():
        if merged.get(key) is None:
            merged[key] = default_value

    return merged


def filter_candidates_by_payload_distance(candidates: list[dict], max_distance_km: float) -> list[dict]:
    filtered = []
    for candidate in candidates:
        distance = candidate.get("distance_km")
        if distance is None:
            continue
        if float(distance) <= max_distance_km:
            filtered.append(candidate)
    return filtered


async def _query_geo_nearby_drivers(
    pickup_lat: float,
    pickup_lng: float,
    max_distance_km: float,
    candidate_driver_ids: Optional[List[str]] = None,
) -> Optional[List[dict]]:
    redis = get_redis()
    geo_key = "drivers:locations"

    if not await redis.exists(geo_key):
        return None

    nearby_raw = await redis.georadius(
        geo_key,
        longitude=pickup_lng,
        latitude=pickup_lat,
        radius=max_distance_km,
        unit="km",
        withdist=True,
    )

    if candidate_driver_ids:
        candidate_set = set(candidate_driver_ids)
        return [
            {"driver_id": item[0], "distance_km": float(item[1])}
            for item in nearby_raw
            if item[0] in candidate_set
        ]

    return [
        {"driver_id": item[0], "distance_km": float(item[1])}
        for item in nearby_raw
    ]


async def filter_nearby_drivers(
    pickup_lat: float,
    pickup_lng: float,
    max_distance_km: float,
    candidate_driver_ids: Optional[List[str]] = None,
) -> List[dict]:
    """
    Filter drivers within max_distance_km using Redis Geo.
    Returns list of dict with driver_id and distance_km.
    If candidate_driver_ids provided, only check those drivers.
    """
    try:
        nearby = await _query_geo_nearby_drivers(
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            max_distance_km=max_distance_km,
            candidate_driver_ids=candidate_driver_ids,
        )
        return nearby or []
    except Exception as exc:
        logger.error("Failed to query Redis Geo for nearby drivers: %s", exc)
        return []


async def apply_hard_constraints(
    candidates: list[dict],
    pickup_lat: Optional[float],
    pickup_lng: Optional[float],
    max_distance_km: float,
) -> tuple[list[dict], str, list[str]]:
    constraints_applied = ["driver_id_present", "max_distance"]

    # Preferred path: Redis Geo when a pickup coordinate is available.
    if pickup_lat is not None and pickup_lng is not None:
        try:
            nearby_drivers = await _query_geo_nearby_drivers(
                pickup_lat=pickup_lat,
                pickup_lng=pickup_lng,
                max_distance_km=max_distance_km,
                candidate_driver_ids=[c["driver_id"] for c in candidates],
            )
            if nearby_drivers is not None:
                if not nearby_drivers:
                    return [], "redis-geo", constraints_applied + ["redis_geo_nearby"]
                nearby_map = {item["driver_id"]: item["distance_km"] for item in nearby_drivers}
                filtered = []
                for candidate in candidates:
                    driver_id = candidate["driver_id"]
                    if driver_id in nearby_map:
                        updated = dict(candidate)
                        updated["distance_km"] = nearby_map[driver_id]
                        filtered.append(updated)
                return filtered, "redis-geo", constraints_applied + ["redis_geo_nearby"]
        except Exception as exc:
            logger.warning("Redis Geo hard constraint degraded: %s", exc)

    # Fallback path still keeps a hard distance constraint using payload distance.
    filtered = filter_candidates_by_payload_distance(candidates, max_distance_km)
    return filtered, "payload-distance", constraints_applied + ["payload_distance_nearby"]
