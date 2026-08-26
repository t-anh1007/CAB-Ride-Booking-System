import asyncio
import json
import logging

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from app.agent.decision import decide, persist_decision
from app.config import settings
from app.database import get_mongo_db, get_redis
from app.serve.matching_predictor import predict_matching_scores

logger = logging.getLogger(__name__)


async def _persist_safely(result):
    try:
        await persist_decision(result, get_mongo_db())
    except Exception:
        pass


def _as_text(value):
    return value.decode('utf-8') if isinstance(value, bytes) else str(value)


def _nearby_candidates(entries):
    candidates = []
    for entry in entries:
        if not isinstance(entry, (tuple, list)) or len(entry) < 2:
            continue

        driver_id, raw_distance = entry[0], entry[1]
        try:
            distance_km = float(raw_distance)
        except (TypeError, ValueError):
            continue

        candidates.append(
            {
                'id': _as_text(driver_id),
                'distance_km': distance_km,
                'rating': None,
                'status': 'ONLINE',
            }
        )
    return candidates


def _predictor_candidates(drivers):
    candidates = []
    for driver in drivers:
        candidate = {
            'driver_id': driver['id'],
            'distance_km': driver['distance_km'],
        }
        if driver.get('rating') is not None:
            candidate['driver_rating'] = driver['rating']
        candidates.append(candidate)
    return candidates


def _predictor_scorer(drivers):
    candidates = _predictor_candidates(drivers)

    def score(_context):
        predictions = predict_matching_scores(candidates)
        return {
            str(prediction['driver_id']): prediction['confidence_score']
            for prediction in predictions
        }

    return score


async def process_ride_created(data, producer):
    booking_id = data.get('bookingId') or data.get('rideId')
    pickup = data.get('pickup') or {}
    if not booking_id or not pickup:
        logger.warning('Missing booking id or pickup payload for ride-created event')
        return None

    nearby = await get_redis().georadius(
        'drivers:geo',
        pickup.get('lng'),
        pickup.get('lat'),
        5,
        'km',
        withdist=True,
        count=10,
    )
    drivers = _nearby_candidates(nearby or [])
    if not drivers:
        logger.warning('No drivers online within 5km for booking %s', booking_id)
        return None

    context = {
        'ride_id': booking_id,
        'available_drivers': drivers,
        'missing_sources': ['eta', 'pricing'],
        'trace_id': data.get('eventId'),
    }
    result = decide(context, scorer=_predictor_scorer(drivers))
    chosen = result['chosen_driver']
    if not chosen:
        return None

    asyncio.create_task(_persist_safely(result))
    event = {
        'eventId': data.get('eventId') or f'evt-{booking_id[:8]}',
        'type': 'DriverSelected',
        'bookingId': booking_id,
        'rideId': booking_id,
        'driverId': chosen['id'],
        'userId': data.get('userId'),
        'timestamp': data.get('timestamp'),
    }
    await producer.send_and_wait(settings.ride_assigned_topic, event)
    return event


async def start_matching_consumer():
    consumer = AIOKafkaConsumer(
        'ride.created',
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id='matching-service-group',
        auto_offset_reset='earliest',
    )
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        value_serializer=lambda value: json.dumps(value).encode('utf-8'),
    )

    while True:
        try:
            await consumer.start()
            break
        except Exception as exc:
            logger.warning('Kafka not ready; retrying in 5 seconds: %s', exc)
            await asyncio.sleep(5)

    await producer.start()
    try:
        async for message in consumer:
            try:
                data = json.loads(message.value.decode('utf-8'))
                if (data.get('type') or data.get('event_type')) == 'RideCreated':
                    await process_ride_created(data, producer)
            except Exception as exc:
                logger.error('Matching message failed: %s', exc)
    finally:
        await consumer.stop()
        await producer.stop()
