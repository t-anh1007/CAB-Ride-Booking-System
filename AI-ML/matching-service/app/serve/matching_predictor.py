"""
matching_predictor.py
────────────────────
Inference module cho Matching Service.
"""
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import numpy as np

from app.config import settings
from app.utils.matching_utils import build_feature_vector, compute_rule_based_score

logger = logging.getLogger(__name__)

FEATURE_COLS = [
    "distance_km",
    "driver_rating",
    "driver_completed_trips",
    "driver_acceptance_rate",
    "historical_matching_score",
    "eta_seconds",
    "surge_multiplier",
    "driver_busy_time",
]

_model_cache = None
_model_loaded_at: Optional[datetime] = None


def invalidate_model_cache() -> None:
    global _model_cache, _model_loaded_at
    _model_cache = None
    _model_loaded_at = None
    logger.info("🔄 Matching model cache invalidated.")


def _load_model(model_store_path: str):
    global _model_cache, _model_loaded_at

    if _model_cache is not None:
        return _model_cache

    model_path = os.path.join(model_store_path, "matching_model.joblib")
    if not os.path.exists(model_path):
        logger.warning("Matching model file not found at %s. Using fallback.", model_path)
        return None

    try:
        import joblib

        _model_cache = joblib.load(model_path)
        _model_loaded_at = datetime.now(tz=timezone.utc)
        logger.info("✅ Matching model loaded from %s", model_path)
        return _model_cache
    except Exception as exc:
        logger.error("Failed to load matching model: %s", exc, exc_info=True)
        return None


def _normalize_score(raw_score: float) -> float:
    if raw_score is None:
        return 0.0
    value = float(raw_score)
    return float(round(max(0.0, min(1.0, value)), 3))


def get_matching_model_metadata() -> dict:
    metadata_path = os.path.join(settings.model_store_path, "matching_metadata.json")
    if not os.path.exists(metadata_path):
        return {}

    try:
        with open(metadata_path, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as exc:
        logger.warning("Failed to read matching metadata: %s", exc)
        return {}


def predict_matching_scores(candidates: list[dict], force_fallback: bool = False) -> list[dict]:
    """
    Tính score cho từng candidate.
    force_fallback=True → buộc dùng rule-based (dùng để test fallback)
    """
    if not candidates:
        return []

    # === 1. FORCE FALLBACK (dùng để test) ===
    if force_fallback:
        logger.info("🧪 [TEST] Force fallback mode - Using rule-based scoring")
        prepared = []
        for candidate in candidates:
            rule_score = compute_rule_based_score(candidate)
            prepared.append({
                "driver_id": candidate["driver_id"],
                "confidence_score": _normalize_score(rule_score),
                "matching_reason": "fallback rule-based (forced for test)",
                "features": candidate,
            })
        return prepared

    # === 2. Bình thường: thử dùng AI model trước ===
    model = _load_model(settings.model_store_path)

    prepared = []
    feature_matrix = np.array(
        [build_feature_vector(candidate) for candidate in candidates],
        dtype=float,
    )

    if model is not None:
        try:
            raw = model.predict(feature_matrix)
            for candidate, score in zip(candidates, raw.tolist()):
                prepared.append({
                    "driver_id": candidate["driver_id"],
                    "confidence_score": _normalize_score(score),
                    "matching_reason": "AI model",
                    "features": candidate,
                })
            logger.info("✅ Used AI model for matching")
            return prepared
        except Exception as exc:
            logger.warning("Model inference failed: %s. Falling back...", exc)

    # === 3. Fallback tự động khi model lỗi hoặc không có ===
    logger.info("🔄 Using fallback rule-based scoring")
    for candidate in candidates:
        rule_score = compute_rule_based_score(candidate)
        prepared.append({
            "driver_id": candidate["driver_id"],
            "confidence_score": _normalize_score(rule_score),
            "matching_reason": "fallback rule-based",
            "features": candidate,
        })
    return prepared


def predict_best_driver(candidates: list[dict], force_fallback: bool = False) -> dict:
    """Chọn best driver, hỗ trợ force_fallback để test"""
    scored = predict_matching_scores(candidates, force_fallback=force_fallback)
    if not scored:
        raise ValueError("No candidates provided.")

    best = max(scored, key=lambda x: x["confidence_score"])
    best["fallback_used"] = force_fallback or best.get("matching_reason", "").startswith("fallback")
    
    return best
