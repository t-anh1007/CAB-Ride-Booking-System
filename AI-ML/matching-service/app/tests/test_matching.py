import asyncio

from app.serve.matching_predictor import predict_matching_scores
from app.utils import matching_utils
from app.utils.matching_utils import (
    apply_hard_constraints,
    build_assignment_event,
    enrich_candidate_features,
    filter_candidates_by_payload_distance,
    pick_best_candidate,
)


def test_predict_matching_scores_fallback_range():
    candidates = [
        {
            "driver_id": "driver_a",
            "distance_km": 1.2,
            "driver_rating": 4.9,
            "driver_completed_trips": 120,
            "driver_acceptance_rate": 0.92,
            "historical_matching_score": 0.8,
            "eta_seconds": 180,
            "surge_multiplier": 1.2,
            "driver_busy_time": 10,
        },
        {
            "driver_id": "driver_b",
            "distance_km": 6.5,
            "driver_rating": 4.4,
            "driver_completed_trips": 80,
            "driver_acceptance_rate": 0.75,
            "historical_matching_score": 0.5,
            "eta_seconds": 420,
            "surge_multiplier": 1.0,
            "driver_busy_time": 25,
        },
    ]

    scored = predict_matching_scores(candidates)
    assert len(scored) == 2
    assert all(0.0 <= item["confidence_score"] <= 1.0 for item in scored)
    assert any(item["matching_reason"] == "fallback rule-based" for item in scored)


def test_pick_best_candidate_prefers_higher_score():
    options = [
        {"driver_id": "d1", "confidence_score": 0.54, "features": {"distance_km": 1.0}},
        {"driver_id": "d2", "confidence_score": 0.54, "features": {"distance_km": 0.8}},
        {"driver_id": "d3", "confidence_score": 0.48, "features": {"distance_km": 0.5}},
    ]

    best = pick_best_candidate(options)
    assert best["driver_id"] == "d2"


def test_filter_candidates_by_payload_distance_enforces_hard_constraint():
    candidates = [
        {"driver_id": "d1", "distance_km": 1.2},
        {"driver_id": "d2", "distance_km": 4.9},
        {"driver_id": "d3", "distance_km": 5.2},
        {"driver_id": "d4"},
    ]

    filtered = filter_candidates_by_payload_distance(candidates, max_distance_km=5.0)
    assert [candidate["driver_id"] for candidate in filtered] == ["d1", "d2"]


def test_enrich_candidate_features_uses_feature_store_only_for_missing_fields():
    candidate = {
        "driver_id": "driver_a",
        "distance_km": 1.4,
        "driver_rating": None,
        "historical_matching_score": None,
        "eta_seconds": 210,
        "driver_busy_time": None,
    }
    feature_snapshot = {
        "driver_rating": 4.8,
        "historical_matching_score": 0.77,
        "eta_seconds": 190,
        "driver_busy_time": 11.0,
    }

    enriched = enrich_candidate_features(candidate, feature_snapshot)
    assert enriched["driver_rating"] == 4.8
    assert enriched["historical_matching_score"] == 0.77
    assert enriched["driver_busy_time"] == 11.0
    assert enriched["eta_seconds"] == 210


def test_enrich_candidate_features_applies_defaults_when_feature_store_missing():
    candidate = {
        "driver_id": "driver_b",
        "distance_km": 2.2,
    }

    enriched = enrich_candidate_features(candidate, None)
    assert enriched["driver_rating"] == 4.0
    assert enriched["historical_matching_score"] == 0.5
    assert enriched["eta_seconds"] == 300


def test_build_assignment_event_contains_decision_metadata():
    event = build_assignment_event(
        "ride-1",
        {
            "driver_id": "driver-a",
            "confidence_score": 0.91,
            "matching_reason": "AI model",
            "decision_source": "ai-driver-matching",
            "model_version": "20260422_120000",
            "assigned_at": "2026-04-22T12:00:00Z",
        },
    )

    assert event["rideId"] == "ride-1"
    assert event["driverId"] == "driver-a"
    assert event["decisionSource"] == "ai-driver-matching"
    assert event["modelVersion"] == "20260422_120000"


def test_apply_hard_constraints_returns_empty_when_redis_geo_has_no_nearby():
    async def fake_query_geo(**kwargs):
        return []

    original = matching_utils._query_geo_nearby_drivers
    matching_utils._query_geo_nearby_drivers = fake_query_geo
    try:
        filtered, source, constraints = asyncio.run(
            apply_hard_constraints(
                candidates=[{"driver_id": "d1", "distance_km": 1.0}],
                pickup_lat=10.0,
                pickup_lng=106.0,
                max_distance_km=5.0,
            )
        )
    finally:
        matching_utils._query_geo_nearby_drivers = original

    assert filtered == []
    assert source == "redis-geo"
    assert "redis_geo_nearby" in constraints


def test_apply_hard_constraints_falls_back_to_payload_distance_when_geo_unavailable():
    async def fake_query_geo(**kwargs):
        return None

    original = matching_utils._query_geo_nearby_drivers
    matching_utils._query_geo_nearby_drivers = fake_query_geo
    try:
        filtered, source, constraints = asyncio.run(
            apply_hard_constraints(
                candidates=[
                    {"driver_id": "d1", "distance_km": 1.0},
                    {"driver_id": "d2", "distance_km": 6.0},
                ],
                pickup_lat=10.0,
                pickup_lng=106.0,
                max_distance_km=5.0,
            )
        )
    finally:
        matching_utils._query_geo_nearby_drivers = original

    assert [item["driver_id"] for item in filtered] == ["d1"]
    assert source == "payload-distance"
    assert "payload_distance_nearby" in constraints
