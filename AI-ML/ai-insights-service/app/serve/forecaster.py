from datetime import datetime, timedelta, timezone

MODEL_VERSION = 'demand-moving-average-1.0.0'


def _as_datetime(value):
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace('Z', '+00:00'))


def forecast(history, horizon, now=None):
    current_hour = (now or datetime.now(timezone.utc)).replace(minute=0, second=0, microsecond=0)
    counts = {hour: 0 for hour in range(24)}

    for row in history:
        created_at = _as_datetime(row.get('createdAt'))
        counts[created_at.hour] += 1

    return [
        {
            'timestamp': (current_hour + timedelta(hours=index)).isoformat().replace('+00:00', 'Z'),
            'value': round(counts[(current_hour + timedelta(hours=index)).hour] / 7, 4),
        }
        for index in range(1, horizon + 1)
    ]
