import asyncio

import httpx

from app.config import settings

SUPPORTED_PRICING_VEHICLES = {'bike', 'standard', 'premium', 'suv'}
PRICING_VEHICLE_ALIASES = {'car': 'standard', 'car_plus': 'premium'}


async def call_with_retry(operation, timeout_seconds=2, delays=(0.5, 1.0)):
    for attempt in range(3):
        try:
            return await asyncio.wait_for(operation(), timeout=timeout_seconds)
        except Exception:
            if attempt == 2:
                return None
            await asyncio.sleep(delays[attempt])


async def _request(method, url, **kwargs):
    async def operation():
        async with httpx.AsyncClient() as client:
            response = await getattr(client, method)(url, **kwargs)
            response.raise_for_status()
            return response.json()

    return await call_with_retry(operation)


async def fetch_available_drivers(url=None):
    return await _request('get', url or settings.driver_service_url)


async def fetch_eta(origin, destination, url=None):
    return await _request(
        'post',
        url or settings.eta_service_url,
        json={'origin': origin, 'destination': destination},
    )


def _pricing_vehicle_type(vehicle_type):
    if vehicle_type in SUPPORTED_PRICING_VEHICLES:
        return vehicle_type
    return PRICING_VEHICLE_ALIASES.get(vehicle_type, 'standard')


def _destination_address(destination):
    if isinstance(destination, dict):
        return destination.get('address') or destination.get('destinationAddress') or f"{destination.get('lat')},{destination.get('lng')}"
    return ''


async def fetch_price(origin, destination, vehicle_type='car', url=None):
    origin = origin if isinstance(origin, dict) else {}
    destination = destination if isinstance(destination, dict) else {}
    return await _request(
        'post',
        url or settings.pricing_service_url,
        json={
            'pickupLat': origin.get('lat'),
            'pickupLng': origin.get('lng'),
            'dropLat': destination.get('lat'),
            'dropLng': destination.get('lng'),
            'destinationAddress': _destination_address(destination),
            'vehicleType': _pricing_vehicle_type(vehicle_type),
        },
    )
