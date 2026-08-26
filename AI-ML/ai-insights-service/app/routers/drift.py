from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import settings
from app.database import get_redis
from app.kafka_producer import publish_event
from app.serve.drift import psi

router = APIRouter()


async def load_windows(feature):
    redis = get_redis()
    # LPUSH places the newest observations first; the older half is the baseline.
    values = [float(value) for value in await redis.lrange(f'drift:{feature}', 0, 999)]
    midpoint = max(1, len(values) // 2)
    return values[midpoint:], values[:midpoint]


async def publish_alert(topic, payload):
    return await publish_event(topic, payload)


@router.get('/api/v1/drift/status')
async def status(feature: str = 'amount'):
    try:
        baseline, current = await load_windows(feature)
    except Exception:
        baseline, current = [], []

    value = psi(baseline, current)
    detected = value > 0.2
    if detected:
        await publish_alert(
            'ai.drift.alert',
            {'feature': feature, 'psi': value, 'timestamp': datetime.now(timezone.utc).isoformat()},
        )

    return {
        'feature': feature,
        'psi': value,
        'drift_detected': detected,
        'baseline_window': len(baseline),
        'current_window': len(current),
        'model_version': settings.model_version,
    }
