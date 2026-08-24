from pydantic import BaseModel, Field


class SurgeEvaluationRequest(BaseModel):
    zoneId: str = Field(..., description="Geohash zone identifier computed by pricing-service")
    requestId: str = Field(..., description="Unique request identifier for demand tracking")


class SurgeEvaluationResponse(BaseModel):
    zoneId: str
    supplyCount: int | None = Field(default=None, ge=0)
    demandCount: int | None = Field(default=None, ge=0)
    surgeMultiplier: float = Field(..., ge=1.0)
    surgeSource: str
    metricsSource: str | None = None
    modelVersion: str | None = None
    computedAt: str | None = None
    available: bool
