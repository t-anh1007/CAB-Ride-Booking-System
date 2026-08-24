import asyncio
import json

from app.models.surge import SurgeEvaluationRequest
from app.routers import surge as surge_router
from app.serve import surge_predictor
from app.trainers import surge_trainer


class _FakeRedis:
    def __init__(self, cached_value=None):
        self._cached_value = cached_value

    async def get(self, key):
        return self._cached_value


def test_feature_columns_include_event_flag():
    assert "event_flag" in surge_predictor.FEATURE_COLS
    assert "event_flag" in surge_trainer.FEATURE_COLS


def test_evaluate_surge_returns_cached_multiplier_with_metadata():
    async def fake_build_online_zone_context(zone_id):
        return (
            {
                "zoneId": zone_id,
                "demand_count": 8,
                "supply_count": 3,
                "avg_speed_kmh": 18.0,
                "rain_indicator": 1,
                "event_flag": 1,
                "hour_of_day": 18,
                "day_of_week": 2,
                "source": "surge-metrics",
            },
            "redis-metrics",
        )

    original_build = surge_router.build_online_zone_context
    original_get_redis = surge_router.get_redis
    original_metadata = surge_router.get_surge_model_metadata
    try:
        surge_router.build_online_zone_context = fake_build_online_zone_context
        surge_router.get_redis = lambda: _FakeRedis(
            json.dumps(
                {
                    "multiplier": 1.7,
                    "zoneId": "w3gvk",
                    "updatedAt": "2026-04-22T10:00:00Z",
                    "source": "surge-pricing-service",
                    "metricsSource": "redis-metrics",
                    "modelVersion": "20260422_100000",
                }
            )
        )
        surge_router.get_surge_model_metadata = lambda _path: {"version": "20260422_100000"}

        response = asyncio.run(
            surge_router.evaluate_surge(
                SurgeEvaluationRequest(zoneId="w3gvk", requestId="req-1")
            )
        )
    finally:
        surge_router.build_online_zone_context = original_build
        surge_router.get_redis = original_get_redis
        surge_router.get_surge_model_metadata = original_metadata

    assert response.surgeMultiplier == 1.7
    assert response.surgeSource == "surge-pricing-service"
    assert response.metricsSource == "redis-metrics"
    assert response.modelVersion == "20260422_100000"
    assert response.available is True


def test_evaluate_surge_uses_compat_demand_signal_when_metrics_not_integrated():
    async def fake_build_online_zone_context(zone_id):
        return (
            {
                "zoneId": zone_id,
                "demand_count": 0,
                "supply_count": 2,
                "avg_speed_kmh": 20.0,
                "rain_indicator": 0,
                "event_flag": 0,
                "hour_of_day": 11,
                "day_of_week": 1,
            },
            "feature-store-context",
        )

    async def fake_record_demand_signal(zone_id, request_id, ttl_seconds, source):
        return {
            "zoneId": zone_id,
            "demand_count": 1,
            "supply_count": 2,
            "avg_speed_kmh": 20.0,
            "rain_indicator": 0,
            "event_flag": 0,
            "hour_of_day": 11,
            "day_of_week": 1,
            "source": source,
        }

    original_build = surge_router.build_online_zone_context
    original_record = surge_router.record_demand_signal
    original_get_redis = surge_router.get_redis
    original_metadata = surge_router.get_surge_model_metadata
    try:
        surge_router.build_online_zone_context = fake_build_online_zone_context
        surge_router.record_demand_signal = fake_record_demand_signal
        surge_router.get_redis = lambda: _FakeRedis(None)
        surge_router.get_surge_model_metadata = lambda _path: {}

        response = asyncio.run(
            surge_router.evaluate_surge(
                SurgeEvaluationRequest(zoneId="w3gvk", requestId="req-compat")
            )
        )
    finally:
        surge_router.build_online_zone_context = original_build
        surge_router.record_demand_signal = original_record
        surge_router.get_redis = original_get_redis
        surge_router.get_surge_model_metadata = original_metadata

    assert response.available is True
    assert response.demandCount == 1
    assert response.supplyCount == 2
    assert response.surgeMultiplier == 1.0
    assert response.surgeSource == "rule-low-demand"
    assert response.metricsSource == "compat-demand-signal"
