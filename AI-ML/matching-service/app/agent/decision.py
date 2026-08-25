import json
import logging
import math
from uuid import uuid4

logger = logging.getLogger(__name__)
GPS_PROXIMITY_KM = 0.25


def _normalize(values):
    low, high = min(values), max(values)
    if high == low:
        return [1.0 for _ in values]
    return [(value - low) / (high - low) for value in values]


def _number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def _inverse_distance_components(drivers):
    distances = [float(driver.get('distance_km', 999)) for driver in drivers]
    nearest = min(distances)
    equivalent = [
        nearest if distance - nearest <= GPS_PROXIMITY_KM else distance
        for distance in distances
    ]
    return _normalize([1 / max(distance, 0.001) for distance in equivalent])


def _fallback(drivers, trace_id, reasons, context):
    chosen = min(
        drivers,
        key=lambda driver: float(driver.get('distance_km', float('inf'))),
    )
    result = {
        'chosen_driver': chosen,
        'strategy': 'fallback-nearest',
        'trace_id': trace_id,
        'scores': [],
        'reasons': reasons,
        'meta': {'missing_sources': context.get('missing_sources', [])},
    }
    logger.info(
        json.dumps(
            {
                'trace_id': trace_id,
                'ride_id': context.get('ride_id'),
                'chosen_driver': chosen.get('id'),
                'scores': [],
                'strategy': result['strategy'],
                'reasons': reasons,
            }
        )
    )
    return result


def _quality_components(drivers, predictor_scores):
    values = []
    for driver in drivers:
        rating = _number(driver.get('rating'))
        if rating is not None:
            values.append(rating / 5)
            continue

        confidence = _number(predictor_scores.get(str(driver.get('id'))))
        values.append(confidence if confidence is not None else 0.0)
    return _normalize(values)


def decide(context, scorer=None):
    trace_id = context.get('trace_id') or str(uuid4())
    online = [
        driver
        for driver in context.get('available_drivers', [])
        if driver.get('status') == 'ONLINE'
    ]
    if not online:
        return {
            'chosen_driver': None,
            'strategy': 'fallback-nearest',
            'trace_id': trace_id,
            'scores': [],
            'reasons': ['no_online_driver'],
            'meta': {'missing_sources': context.get('missing_sources', [])},
        }

    try:
        predictor_scores = scorer(context) if scorer else {}
        if not isinstance(predictor_scores, dict):
            raise ValueError('predictor scorer must return a mapping')

        components = {
            'distance': _inverse_distance_components(online),
            'rating': _quality_components(online, predictor_scores),
        }
        weights = {'distance': 0.40, 'rating': 0.25}

        for name, key, weight in (
            ('eta', 'eta_minutes', 0.20),
            ('price', 'price_quote', 0.15),
        ):
            values = [driver.get(key, context.get(key)) for driver in online]
            if all(value is not None for value in values):
                components[name] = _normalize(
                    [1 / max(float(value), 0.001) for value in values]
                )
                weights[name] = weight

        total_weight = sum(weights.values())
        scores = []
        for index, driver in enumerate(online):
            detail = {
                name: round(values[index], 6)
                for name, values in components.items()
            }
            score = sum(
                weights[name] * detail[name] for name in weights
            ) / total_weight
            scores.append(
                {
                    'id': driver.get('id'),
                    'score': round(score, 6),
                    'components': detail,
                }
            )

        scores.sort(key=lambda item: item['score'], reverse=True)
        chosen = next(
            driver for driver in online if driver.get('id') == scores[0]['id']
        )
        missing = set(context.get('missing_sources', []))
        if context.get('eta_minutes') is None:
            missing.add('eta')
        if context.get('price_quote') is None:
            missing.add('pricing')

        result = {
            'chosen_driver': chosen,
            'strategy': 'multi-objective',
            'trace_id': trace_id,
            'scores': scores,
            'reasons': [],
            'meta': {'missing_sources': sorted(missing)},
        }
        logger.info(
            json.dumps(
                {
                    'trace_id': trace_id,
                    'ride_id': context.get('ride_id'),
                    'chosen_driver': chosen.get('id'),
                    'scores': scores,
                    'strategy': result['strategy'],
                    'reasons': [],
                }
            )
        )
        return result
    except Exception:
        return _fallback(online, trace_id, ['scorer_error'], context)


async def persist_decision(result, database):
    try:
        await database.agent_decisions.insert_one(result)
    except Exception:
        pass
