"""
matching_trainer.py
───────────────────
Huấn luyện XGBoost ranking/regression model cho Matching Service.
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
    "distance_km",
    "driver_rating",
    "driver_completed_trips",
    "driver_acceptance_rate",
    "historical_matching_score",
    "eta_seconds",
    "surge_multiplier",
    "driver_busy_time",
]

MODEL_PATH = os.path.join(settings.model_store_path, "matching_model.joblib")
METADATA_PATH = os.path.join(settings.model_store_path, "matching_metadata.json")


def _generate_synthetic_matching_data(n: int = 700) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    df = pd.DataFrame(
        {
            "distance_km": rng.uniform(0.2, 30.0, n),
            "driver_rating": rng.uniform(3.5, 5.0, n),
            "driver_completed_trips": rng.integers(0, 300, n).astype(float),
            "driver_acceptance_rate": rng.uniform(0.5, 1.0, n),
            "historical_matching_score": rng.uniform(0.0, 1.0, n),
            "eta_seconds": rng.uniform(60, 900, n),
            "surge_multiplier": rng.uniform(0.8, 2.5, n),
            "driver_busy_time": rng.uniform(0, 90, n),
        }
    )

    distance_score = np.clip(1.0 - (df["distance_km"] / 30.0), 0.0, 1.0)
    rating_score = df["driver_rating"] / 5.0
    acceptance_score = df["driver_acceptance_rate"]
    history_score = df["historical_matching_score"]
    eta_score = np.clip(1.0 - (df["eta_seconds"] / 900.0), 0.0, 1.0)
    busy_score = np.clip(1.0 - (df["driver_busy_time"] / 90.0), 0.0, 1.0)

    label = (
        0.40 * distance_score
        + 0.26 * rating_score
        + 0.15 * acceptance_score
        + 0.10 * history_score
        + 0.06 * eta_score
        + 0.03 * busy_score
    )
    noise = rng.uniform(-0.04, 0.04, n)
    df["label"] = np.clip(label + noise, 0.0, 1.0)

    logger.info("Generated %d synthetic matching samples.", n)
    return df


async def run_matching_training() -> dict:
    db = get_mongo_db()

    docs = await db.ml_matching_samples.find({"label": {"$ne": None}}, {"_id": 0}).to_list(length=10_000)
    if len(docs) >= 80:
        logger.info("Training matching model on %d real samples.", len(docs))
        rows = [
            {"label": d["label"], **d["features"]}
            for d in docs
            if d.get("features") is not None
        ]
        df = pd.DataFrame(rows)
    else:
        logger.warning(
            "Only %d labeled matching samples available. Using synthetic baseline dataset.",
            len(docs),
        )
        df = _generate_synthetic_matching_data()

    df = df.dropna(subset=FEATURE_COLS + ["label"])
    X = df[FEATURE_COLS].fillna(0).astype(float)
    y = df["label"].clip(0.0, 1.0)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    model = xgb.XGBRegressor(
        n_estimators=180,
        max_depth=5,
        learning_rate=0.07,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42,
        verbosity=0,
        monotone_constraints=(
            -1,  # distance_km: càng gần càng tốt
            1,   # driver_rating: càng cao càng tốt
            1,   # driver_completed_trips: càng nhiều càng tốt
            1,   # driver_acceptance_rate: càng cao càng tốt
            1,   # historical_matching_score: càng cao càng tốt
            -1,  # eta_seconds: càng thấp càng tốt
            0,   # surge_multiplier: soft effect
            -1,  # driver_busy_time: càng thấp càng tốt
        ),
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    mae = round(float(mean_absolute_error(y_test, model.predict(X_test))), 4)
    logger.info(
        "Matching model training complete. MAE=%.4f n_samples=%d",
        mae,
        len(df),
    )

    os.makedirs(settings.model_store_path, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    logger.info("Matching model saved to %s", MODEL_PATH)

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    metadata = {
        "model_type": "matching",
        "version": datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S"),
        "mae": mae,
        "n_samples": int(len(df)),
        "feature_names": FEATURE_COLS,
        "trained_at": now_iso,
        "status": "ready",
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    await db.ml_model_metadata.update_one(
        {"model_type": "matching"},
        {"$set": metadata},
        upsert=True,
    )

    from app.serve.matching_predictor import invalidate_model_cache

    invalidate_model_cache()
    return metadata
