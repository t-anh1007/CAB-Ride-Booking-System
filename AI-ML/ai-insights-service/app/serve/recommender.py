MODEL_VERSION = 'driver-recommender-1.0.0'
GPS_PROXIMITY_KM = 0.25


def _normalize(values):
    low, high = min(values), max(values)
    if high == low:
        return [1.0 for _ in values]
    return [(value - low) / (high - low) for value in values]


def _inverse_distance_components(drivers):
    distances = [float(driver.get('distance_km', 999)) for driver in drivers]
    nearest = min(distances)
    equivalent = [nearest if distance - nearest <= GPS_PROXIMITY_KM else distance for distance in distances]
    return _normalize([1 / max(distance, 0.001) for distance in equivalent])


def recommend(drivers, top_n, price_quote=None):
    online = [driver for driver in drivers if driver.get('status') == 'ONLINE']
    if not online:
        return []

    components = {
        'distance': _inverse_distance_components(online),
        'rating': _normalize([float(driver.get('rating', 0)) / 5 for driver in online]),
    }
    weights = {'distance': 0.40, 'rating': 0.25}

    for name, key, weight in (('eta', 'eta_minutes', 0.20), ('price', 'price_quote', 0.15)):
        values = [driver.get(key, price_quote if key == 'price_quote' else None) for driver in online]
        if all(value is not None for value in values):
            components[name] = _normalize([1 / max(float(value), 0.001) for value in values])
            weights[name] = weight

    total_weight = sum(weights.values())
    ranked = []
    for index, driver in enumerate(online):
        score = sum(weights[name] * components[name][index] for name in weights) / total_weight
        ranked.append({'id': driver.get('id'), 'score': round(score, 6)})

    ranked.sort(key=lambda item: item['score'], reverse=True)
    return [{**item, 'rank': index + 1} for index, item in enumerate(ranked[:max(0, top_n)])]
