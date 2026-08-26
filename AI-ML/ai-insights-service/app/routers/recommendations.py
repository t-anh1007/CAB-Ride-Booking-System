from fastapi import APIRouter

from app.routers.fraud import record_feature
from app.serve.recommender import MODEL_VERSION, recommend

router = APIRouter()


@router.post('/api/v1/recommendations/drivers')
async def recommendations(payload: dict):
    drivers = payload.get('drivers') or []
    for driver in drivers:
        if driver.get('distance_km') is not None:
            await record_feature('distance_km', float(driver['distance_km']))

    return {
        'recommendations': recommend(drivers, int(payload.get('top_n', 3)), payload.get('price_quote')),
        'model_version': MODEL_VERSION,
    }
