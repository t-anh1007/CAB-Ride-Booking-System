from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from app.database import get_mongo_db, get_redis
from app.serve.fraud_scorer import MODEL_VERSION, THRESHOLD, score

router = APIRouter()


async def fetch_history(user_id, booking_id):
    bookings = get_mongo_db().client['cab_booking_booking'].bookings
    cursor = bookings.find({'userId': user_id}, {'amount': 1}).sort('createdAt', -1).limit(50)
    amounts = [float(row.get('amount', 0)) async for row in cursor]
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    velocity = await bookings.count_documents({'userId': user_id, 'createdAt': {'$gte': one_hour_ago}})
    booking = await bookings.find_one({'_id': booking_id}) or await bookings.find_one({'bookingId': booking_id}) or {}
    distance = booking.get('distance_km') or booking.get('distanceKm') or booking.get('route', {}).get('distance_km')
    return amounts, velocity, distance


async def record_feature(feature, value):
    try:
        redis = get_redis()
        await redis.lpush(f'drift:{feature}', value)
        await redis.ltrim(f'drift:{feature}', 0, 999)
    except Exception:
        pass


@router.post('/api/v1/fraud/score')
async def fraud_score(payload: dict):
    required = [field for field in ('user_id', 'booking_id', 'amount', 'payment_method') if payload.get(field) in (None, '')]
    if required:
        raise HTTPException(status_code=400, detail=f'missing required fields: {required}')

    try:
        amounts, velocity, distance = await fetch_history(payload['user_id'], payload['booking_id'])
    except Exception:
        amounts, velocity, distance = [], 0, None

    value, reasons = score(float(payload['amount']), amounts, velocity, payload.get('distance_km', distance))
    await record_feature('amount', float(payload['amount']))
    return {
        'fraud_score': value,
        'flagged': value > THRESHOLD,
        'threshold': THRESHOLD,
        'reasons': reasons,
        'model_version': MODEL_VERSION,
    }
