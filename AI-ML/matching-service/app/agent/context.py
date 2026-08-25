import asyncio
import inspect
import json
import math
from uuid import uuid4

from app.agent import tools
from app.database import get_redis


def _unwrap_data(value):
    while isinstance(value, dict) and 'data' in value:
        value = value['data']
    return value


def _normalize_redis_value(value):
    if isinstance(value, bytes):
        value = value.decode('utf-8')
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            try:
                value = float(value)
            except ValueError:
                pass
    return value


def _zone_from_supply_key(key):
    value = _normalize_redis_value(key)
    return str(value).removeprefix('supply:zone:')


def _number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def _haversine_km(origin, destination):
    if not isinstance(origin, dict) or not isinstance(destination, dict):
        return None
    origin_lat, origin_lng = _number(origin.get('lat')), _number(origin.get('lng'))
    destination_lat, destination_lng = _number(destination.get('lat')), _number(destination.get('lng'))
    if None in (origin_lat, origin_lng, destination_lat, destination_lng):
        return None
    lat_delta = math.radians(destination_lat - origin_lat)
    lng_delta = math.radians(destination_lng - origin_lng)
    a = math.sin(lat_delta / 2) ** 2 + math.cos(math.radians(origin_lat)) * math.cos(math.radians(destination_lat)) * math.sin(lng_delta / 2) ** 2
    a = min(1.0, max(0.0, a))
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _normalize_driver(driver, pickup):
    if not isinstance(driver, dict):
        return None
    driver_id = driver.get('id') or driver.get('driverId')
    if isinstance(driver_id, bytes):
        driver_id = driver_id.decode('utf-8')
    if not driver_id:
        return None
    distance = _number(driver.get('distance_km', driver.get('distanceKm')))
    if distance is None or distance < 0:
        distance = _haversine_km(pickup, driver.get('location'))
    if distance is None or distance < 0:
        return None
    return {
        'id': str(driver_id),
        'distance_km': distance,
        'rating': _number(driver.get('rating')) or 0.0,
        'status': driver.get('status') or 'OFFLINE',
    }


def _normalize_drivers(value, pickup):
    return [normalized for driver in (value or []) if (normalized := _normalize_driver(driver, pickup))]


def _price_amount(price_data):
    if not isinstance(price_data, dict):
        return None
    snapshot = price_data.get('priceSnapshot')
    return snapshot.get('amount') if isinstance(snapshot, dict) else None


def _surge_multiplier(raw_value):
    value = _normalize_redis_value(raw_value)
    if isinstance(value, dict):
        value = value.get('multiplier')
    return _number(value)


async def _supply_demand():
    """Aggregate operational indexes because the context API has no zone id."""
    try:
        redis = get_redis()
        if inspect.isawaitable(redis):
            redis = await redis
        supply_keys = await redis.keys('supply:zone:*')
        if not supply_keys:
            return None, None, None

        supplies = await asyncio.gather(*(redis.scard(key) for key in supply_keys))
        surge_keys = [f'surge_zone:{_zone_from_supply_key(key)}' for key in supply_keys]
        raw_surges = await asyncio.gather(*(redis.get(key) for key in surge_keys))
        surges = [value for raw in raw_surges if (value := _surge_multiplier(raw)) is not None]

        supply_index = sum(int(value) for value in supplies)
        demand_index = sum(surges) / len(surges) if surges else None
        traffic_level = None if demand_index is None else min(1.0, max(0.0, demand_index - 1.0))
        return demand_index, supply_index, traffic_level
    except Exception:
        return None, None, None


async def build_context(ride_id, pickup, drop, vehicle_type='car'):
    drivers_response, eta_response, price_response, supply_demand = await asyncio.gather(
        tools.fetch_available_drivers(),
        tools.fetch_eta(pickup, drop),
        tools.fetch_price(pickup, drop, vehicle_type),
        _supply_demand(),
    )

    drivers_data = _unwrap_data(drivers_response)
    eta_data = _unwrap_data(eta_response)
    price_data = _unwrap_data(price_response)
    raw_drivers = drivers_data.get('drivers', []) if isinstance(drivers_data, dict) else drivers_data
    drivers = _normalize_drivers(raw_drivers, pickup)
    price_quote = _price_amount(price_data)
    demand_index, supply_index, traffic_level = supply_demand
    missing = [
        name
        for name, value in {'drivers': drivers_response, 'eta': eta_response}.items()
        if value is None
    ]
    if price_response is None or price_quote is None:
        missing.append('pricing')
    if demand_index is None or supply_index is None:
        missing.append('supply_demand')

    return {
        'ride_id': ride_id,
        'pickup': pickup,
        'drop': drop,
        'available_drivers': drivers,
        'traffic_level': traffic_level,
        'eta_minutes': eta_data.get('etaMinutes') if isinstance(eta_data, dict) else None,
        'price_quote': price_quote,
        'demand_index': demand_index,
        'supply_index': supply_index,
        'sources': {
            'drivers': 'driver-service',
            'eta': 'eta-service',
            'pricing': 'pricing-service',
            'supply_demand': 'redis',
        },
        'missing_sources': missing,
        'trace_id': str(uuid4()),
    }
