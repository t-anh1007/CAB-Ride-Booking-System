import asyncio

from fastapi import APIRouter

from app.agent.context import build_context
from app.agent.decision import decide, persist_decision
from app.database import get_mongo_db

router = APIRouter(prefix='/api/v1/agent', tags=['Agent'])


async def _persist_safely(result):
    try:
        await persist_decision(result, get_mongo_db())
    except Exception:
        pass


@router.get('/context/{ride_id}')
async def context(ride_id: str, pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float):
    return await build_context(
        ride_id,
        {'lat': pickup_lat, 'lng': pickup_lng},
        {'lat': drop_lat, 'lng': drop_lng},
    )


@router.post('/decide')
async def decision(payload: dict):
    agent_context = payload
    if 'available_drivers' not in payload:
        agent_context = await build_context(
            payload['ride_id'],
            payload['pickup'],
            payload['drop'],
            payload.get('vehicle_type', 'car'),
        )

    result = decide(agent_context)
    asyncio.create_task(_persist_safely(result))
    return result
