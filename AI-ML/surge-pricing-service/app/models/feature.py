from typing import Optional
from pydantic import BaseModel, Field


class FeatureIngestRequest(BaseModel):
    source: str = Field(
        ...,
        description="Nguồn dữ liệu: 'gps' | 'trip_history' | 'ratings'",
        examples=["trip_history"],
    )
    zoneId: str = Field(..., description="Khu vực địa lý (VD: zone_quan1)", examples=["zone_quan1"])
    features: dict = Field(
        ...,
        description="Feature vector dạng key-value",
        examples=[{
            "hour_of_day": 17,
            "day_of_week": 4,
            "demand_count": 42,
            "supply_count": 15,
            "avg_speed_kmh": 8.5,
            "rain_indicator": 0,
            "event_flag": 0,
        }],
    )
    label: Optional[float] = Field(
        None,
        description="Surge multiplier thực tế (ground truth) nếu có, dùng cho training",
        examples=[1.8],
    )


class FeatureIngestResponse(BaseModel):
    sampleId: str
    zoneId: str
    source: str
    capturedAt: str
    message: str


class ZoneMetricUpsertRequest(BaseModel):
    zoneId: str
    demand_count: int = Field(..., ge=0)
    supply_count: int = Field(..., ge=0)
    avg_speed_kmh: float = Field(30.0, ge=0)
    rain_indicator: int = Field(0, ge=0, le=1)
    event_flag: int = Field(0, ge=0, le=1)
    source: str = Field(default="surge-metrics", description="Producer/source of the zone metric snapshot")


class DemandSignalRequest(BaseModel):
    zoneId: str
    requestId: str
    source: str = Field(default="surge-demand-signal", description="Producer/source of the demand signal")
    ttlSeconds: int = Field(default=300, ge=30, le=3600)


class ZoneMetricResponse(BaseModel):
    zoneId: str
    demand_count: int = Field(..., ge=0)
    supply_count: int = Field(..., ge=0)
    avg_speed_kmh: float = Field(..., ge=0)
    rain_indicator: int = Field(..., ge=0, le=1)
    event_flag: int = Field(..., ge=0, le=1)
    hour_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    source: str
    metricsSource: str
    updatedAt: str
