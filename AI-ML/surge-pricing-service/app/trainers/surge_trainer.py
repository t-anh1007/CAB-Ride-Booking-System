"""
surge_trainer.py
────────────────
XGBoost training pipeline cho Surge Pricing model.

Chiến lược dữ liệu:
  - Nếu Feature Store có ≥ 50 labeled samples → train trên real data
  - Ngược lại → generate synthetic data (đủ để train một model baseline)

Output:
  - /app/model_store/surge_model.joblib   (model weights)
  - /app/model_store/surge_metadata.json  (version, MAE, feature list)
  - MongoDB `ml_model_metadata` collection (queryable metadata)
"""

import json
import logging
import os
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

from app.config import settings
from app.database import get_mongo_db

logger = logging.getLogger(__name__)

FEATURE_COLS = [
    "hour_of_day",
    "day_of_week",
    "demand_count",
    "supply_count",
    "avg_speed_kmh",
    "rain_indicator",
    "event_flag",
]

MODEL_PATH = os.path.join(settings.model_store_path, "surge_model.joblib")
METADATA_PATH = os.path.join(settings.model_store_path, "surge_metadata.json")


def _generate_synthetic_data(n: int = 800) -> pd.DataFrame:
    """
    Sinh dữ liệu tổng hợp để train baseline model khi Feature Store chưa có đủ data thực.

    Quy tắc xây dựng label (phản ánh đúng quy luật kinh tế):
      - Base surge = demand / supply (Cầu/Cung)
      - Giờ cao điểm (7-9h, 17-19h, 22-23h) → nhân thêm 1.15
      - Trời mưa → nhân thêm 1.2
      - Kẹt xe (tốc độ < 15km/h) → nhân thêm 1.1
      - Noise DƯƠNG nhỏ (0~0.1) để dữ liệu không hoàn hảo nhưng không sai hướng
      - Clamp vào [1.0, 3.0]
    """
    rng = np.random.default_rng(42)
    df = pd.DataFrame(
        {
            "hour_of_day": rng.integers(0, 24, n),
            "day_of_week": rng.integers(0, 7, n),
            "demand_count": rng.integers(5, 80, n).astype(float),
            "supply_count": rng.integers(3, 50, n).astype(float),
            "avg_speed_kmh": rng.uniform(4.0, 60.0, n),
            "rain_indicator": rng.integers(0, 2, n).astype(float),
            "event_flag": rng.integers(0, 2, n).astype(float),
        }
    )

    # Base: tỷ lệ Cầu/Cung
    base = df["demand_count"] / df["supply_count"].clip(lower=1)

    # Giờ cao điểm tăng giá thêm 15%
    peak_hours = df["hour_of_day"].isin([7, 8, 9, 17, 18, 19, 22, 23])
    base = base * (1 + 0.15 * peak_hours)

    # Mưa tăng thêm 20%
    base = base * (1 + 0.20 * df["rain_indicator"])

    # Sự kiện lớn tăng thêm 25%
    base = base * (1 + 0.25 * df["event_flag"])

    # Kẹt xe (tốc độ chậm) tăng thêm 10%
    slow_traffic = (df["avg_speed_kmh"] < 15).astype(float)
    base = base * (1 + 0.10 * slow_traffic)

    # Noise DƯƠNG (0.0 → 0.1) — không để âm tránh label giảm bất hợp lý
    noise = rng.uniform(0.0, 0.10, n)
    df["label"] = (base + noise).clip(1.0, 3.0)

    logger.info("Generated %d synthetic training samples (monotonic-safe).", n)
    return df


async def run_surge_training() -> dict:
    """
    Orchestrates the full training pipeline:
      1. Load data (Feature Store hoặc synthetic)
      2. Train XGBoost Regressor
      3. Evaluate MAE trên test split
      4. Serialize model → joblib
      5. Persist metadata → JSON + MongoDB
      6. Invalidate in-memory model cache → next prediction loads new model
    """
    db = get_mongo_db()

    # ── 1. Load Training Data ─────────────────────────────────────────────────
    docs = (
        await db.ml_features.find(
            {"source": "trip_history", "label": {"$ne": None}},
            {"_id": 0},
        ).to_list(length=10_000)
    )

    if len(docs) >= 50:
        logger.info("Training on %d real samples from Feature Store.", len(docs))
        rows = [{"label": d["label"], **d["features"]} for d in docs]
        df = pd.DataFrame(rows)
    else:
        logger.warning(
            "Only %d labeled samples in Feature Store (need ≥ 50). "
            "Using synthetic data to build a baseline model.",
            len(docs),
        )
        df = _generate_synthetic_data()

    df = df.dropna(subset=FEATURE_COLS + ["label"])
    X = df[FEATURE_COLS].fillna(0).astype(float)
    y = df["label"].clip(1.0, 3.0)

    # ── 2. Train / Test Split ─────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # ── 3. XGBoost Regressor với Monotonic Constraints ───────────────────────
    #
    # monotone_constraints: ràng buộc từng feature theo thứ tự FEATURE_COLS
    # Giá trị: +1 = tăng feature → surge chỉ được tăng hoặc giữ
    #           0 = không ràng buộc
    #          -1 = tăng feature → surge chỉ được giảm hoặc giữ
    #
    # FEATURE_COLS = [hour_of_day, day_of_week, demand_count, supply_count, avg_speed_kmh, rain_indicator, event_flag]
    #                    0               0           +1             -1             -1              +1            +1
    #
    # Giải thích:
    #   demand_count  (+1): Cầu tăng → Surge PHẢI tăng hoặc giữ nguyên (cấm giảm)
    #   supply_count  (-1): Cung tăng → Surge PHẢI giảm hoặc giữ nguyên (xe nhiều thì rẻ)
    #   avg_speed_kmh (-1): Tốc độ tăng (đường thông) → Surge giảm (ít kẹt xe = dễ đặt)
    #   rain_indicator(+1): Mưa → Surge tăng
    #   hour/day_of_week(0): Không ràng buộc cứng (giờ tác động phức tạp)
    model = xgb.XGBRegressor(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42,
        verbosity=0,
        monotone_constraints=(0, 0, 1, -1, -1, 1, 1),  # [hour, day, demand, supply, speed, rain, event]
    )
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # ── 4. Evaluate ───────────────────────────────────────────────────────────
    mae = round(float(mean_absolute_error(y_test, model.predict(X_test))), 4)
    logger.info("Training complete. MAE=%.4f  n_samples=%d", mae, len(df))

    # ── 5. Serialize ──────────────────────────────────────────────────────────
    os.makedirs(settings.model_store_path, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    logger.info("Model saved → %s", MODEL_PATH)

    # ── 6. Metadata ───────────────────────────────────────────────────────────
    now_iso = datetime.now(tz=timezone.utc).isoformat()
    metadata = {
        "model_type": "surge_pricing",
        "version": datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S"),
        "mae": mae,
        "n_samples": int(len(df)),
        "feature_names": FEATURE_COLS,
        "trained_at": now_iso,
        "status": "ready",
    }

    # Persist to JSON (human-readable)
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Persist to MongoDB (queryable)
    await db.ml_model_metadata.update_one(
        {"model_type": "surge_pricing"},
        {"$set": metadata},
        upsert=True,
    )

    # ── 7. Invalidate in-memory model cache ───────────────────────────────────
    from app.serve.surge_predictor import invalidate_model_cache
    invalidate_model_cache()

    return metadata
