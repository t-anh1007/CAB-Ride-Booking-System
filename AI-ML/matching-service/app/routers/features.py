from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.feature_store.matching_ingestion import (
    get_driver_feature_snapshot,
    upsert_driver_feature_snapshot,
)
from app.models.feature import DriverFeatureResponse, UpsertDriverFeatureRequest

router = APIRouter()


@router.put(
    "/drivers/{driver_id}",
    response_model=DriverFeatureResponse,
    summary="Upsert latest online feature snapshot for one driver",
)
async def upsert_driver_features(driver_id: str, payload: UpsertDriverFeatureRequest):
    if driver_id != payload.driver_id:
        raise HTTPException(status_code=400, detail="driver_id path must match request body")

    stored = await upsert_driver_feature_snapshot(
        driver_id=driver_id,
        features=payload.features.model_dump(exclude_none=True),
        source=payload.source,
    )
    return DriverFeatureResponse(
        driver_id=stored["driverId"],
        features=stored["features"],
        source=stored["source"],
        updated_at=stored["updatedAt"],
    )


@router.get(
    "/drivers/{driver_id}",
    response_model=DriverFeatureResponse,
    summary="Get latest online feature snapshot for one driver",
)
async def get_driver_features(driver_id: str):
    stored = await get_driver_feature_snapshot(driver_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Driver feature snapshot not found")

    return DriverFeatureResponse(
        driver_id=stored["driverId"],
        features=stored.get("features", {}),
        source=stored.get("source", "matching-feature-store"),
        updated_at=stored.get("updatedAt") or datetime.now(tz=timezone.utc),
    )
