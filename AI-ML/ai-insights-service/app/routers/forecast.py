from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.database import get_mongo_db
from app.serve.forecaster import MODEL_VERSION, forecast

router = APIRouter()


async def load_booking_history(zone, start):
    cursor = get_mongo_db().client['cab_booking_booking'].bookings.find(
        {'zone': zone, 'createdAt': {'$gte': start}},
        {'createdAt': 1},
    )
    return [row async for row in cursor]


@router.get('/api/v1/forecast/demand')
async def demand(zone: str, horizon: int = Query(6, ge=1, le=168)):
    try:
        history = await load_booking_history(zone, datetime.now(timezone.utc) - timedelta(days=7))
        data = forecast(history, horizon)
        degraded = False
    except Exception:
        data = [{**item, 'value': 1.0} for item in forecast([], horizon)]
        degraded = True

    return {
        'zone': zone,
        'horizon': horizon,
        'forecast': data,
        'degraded': degraded,
        'model_version': MODEL_VERSION,
    }
