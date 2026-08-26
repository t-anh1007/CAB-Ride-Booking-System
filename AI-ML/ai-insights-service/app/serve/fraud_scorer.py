MODEL_VERSION = 'fraud-rules-1.0.0'
THRESHOLD = 0.7


def score(amount, history_amounts, txn_last_hour, distance_km=None):
    values = [float(value) for value in history_amounts]
    mean = sum(values) / len(values) if values else float(amount)
    variance = sum((value - mean) ** 2 for value in values) / len(values) if values else 1.0
    std = variance ** 0.5
    amount_z = min(1.0, abs(float(amount) - mean) / (3 * std)) if std else 0.0
    velocity = min(1.0, txn_last_hour / 5.0)
    route_anomaly = min(1.0, (distance_km or 0) / 100.0)
    reasons = (["amount_anomaly"] if amount_z > .5 else []) + (["velocity_high"] if velocity > .5 else []) + (["route_anomaly"] if route_anomaly > .5 else [])
    return round(min(1.0, .35 * amount_z + .35 * velocity + .30 * route_anomaly), 4), reasons
