"""
surge_predictor.py
──────────────────
Core inference module cho Surge Pricing.

Strategy (priority order):
  1. Load trained XGBoost model từ joblib file (persisted trên disk)
  2. Fallback → demand / supply ratio formula (khi model chưa được train)

Kết quả luôn được clamp vào [1.0, 3.0].
"""

import logging
import os
import json
from datetime import datetime, timezone
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Feature columns phải khớp với thứ tự dùng khi training
FEATURE_COLS = [
    "hour_of_day",
    "day_of_week",
    "demand_count",
    "supply_count",
    "avg_speed_kmh",
    "rain_indicator",
    "event_flag",
]

# In-memory model cache — tránh re-load joblib mỗi 30 giây
_model_cache = None
_model_loaded_at: Optional[datetime] = None


def invalidate_model_cache() -> None:
    """Gọi sau khi training hoàn tất để force load lại model mới."""
    global _model_cache, _model_loaded_at
    _model_cache = None
    _model_loaded_at = None
    logger.info("🔄 Model cache invalidated — will reload on next prediction.")


def _load_model(model_store_path: str):
    """
    Lazy-load model từ disk vào memory cache.
    Trả về None nếu file chưa tồn tại (cold start).
    """
    global _model_cache, _model_loaded_at

    if _model_cache is not None:
        return _model_cache

    model_path = os.path.join(model_store_path, "surge_model.joblib")
    if not os.path.exists(model_path):
        logger.warning(
            "⚠️  Model file not found at %s. Will use fallback formula.", model_path
        )
        return None

    try:
        import joblib

        _model_cache = joblib.load(model_path)
        _model_loaded_at = datetime.now(tz=timezone.utc)
        logger.info("✅ Surge model loaded from %s at %s", model_path, _model_loaded_at)
        return _model_cache
    except Exception as exc:
        logger.error("❌ Failed to load model: %s. Using fallback.", exc)
        return None


def _fallback_surge(demand_count: float, supply_count: float) -> float:
    """
    Công thức đơn giản khi model chưa sẵn sàng:
        surge = demand / supply   (clamp → [1.0, 3.0])
    """
    if supply_count <= 0:
        return 1.0
    ratio = demand_count / supply_count
    return round(max(1.0, min(3.0, ratio)), 2)


def get_surge_model_metadata(model_store_path: str) -> dict:
    metadata_path = os.path.join(model_store_path, "surge_metadata.json")
    if not os.path.exists(metadata_path):
        return {}

    try:
        with open(metadata_path, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as exc:
        logger.warning("Failed to read surge metadata: %s", exc)
        return {}


def predict_surge(zone_metrics: dict, model_store_path: str) -> float:
    """
    Predict surge multiplier cho một zone.

    Args:
        zone_metrics: dict chứa demand_count, supply_count, avg_speed_kmh, ...
        model_store_path: thư mục chứa surge_model.joblib

    Returns:
        float trong khoảng [1.0, 3.0]
    """
    now = datetime.now(tz=timezone.utc)
    demand = float(zone_metrics.get("demand_count", 10))
    supply = float(zone_metrics.get("supply_count", 10))

    model = _load_model(model_store_path)

    if model is not None:
        try:
            features = np.array([[
                zone_metrics.get("hour_of_day", now.hour),
                zone_metrics.get("day_of_week", now.weekday()),
                demand,
                supply,
                zone_metrics.get("avg_speed_kmh", 30.0),
                zone_metrics.get("rain_indicator", 0),
                zone_metrics.get("event_flag", 0),
            ]], dtype=float)

            predicted = float(model.predict(features)[0])
            result = round(max(1.0, min(3.0, predicted)), 2)
            logger.debug(
                "XGBoost prediction: zone=%s raw=%.3f clamped=%.2f",
                zone_metrics.get("zoneId", "?"),
                predicted,
                result,
            )
            return result

        except Exception as exc:
            logger.warning(
                "Model inference failed (%s). Falling back to formula.", exc
            )

    # ── Fallback ──────────────────────────────────────────────────────────────
    result = _fallback_surge(demand, supply)
    logger.debug(
        "Fallback surge: zone=%s demand=%.1f supply=%.1f → %.2f",
        zone_metrics.get("zoneId", "?"),
        demand,
        supply,
        result,
    )
    return result
