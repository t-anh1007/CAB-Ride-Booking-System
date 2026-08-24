from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DriverFeatureSnapshotPayload(BaseModel):
    driver_rating: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    driver_completed_trips: Optional[int] = Field(default=None, ge=0)
    driver_acceptance_rate: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    historical_matching_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    eta_seconds: Optional[int] = Field(default=None, ge=0)
    surge_multiplier: Optional[float] = Field(default=None, ge=0.0)
    driver_busy_time: Optional[float] = Field(default=None, ge=0.0)


class UpsertDriverFeatureRequest(BaseModel):
    driver_id: str = Field(..., description="Driver identifier")
    features: DriverFeatureSnapshotPayload
    source: str = Field(default="matching-feature-store", description="Producer/source of the feature snapshot")


class DriverFeatureResponse(BaseModel):
    driver_id: str
    features: DriverFeatureSnapshotPayload
    source: str
    updated_at: datetime
