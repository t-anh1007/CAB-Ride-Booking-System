import json
import logging

from aiokafka import AIOKafkaProducer

from app.config import settings

logger = logging.getLogger(__name__)
_producer = None


def _serialize_json(payload):
    return json.dumps(payload, separators=(',', ':'), default=str).encode('utf-8')


async def connect_kafka():
    global _producer
    if _producer is not None:
        return True

    candidate = None
    try:
        candidate = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            request_timeout_ms=settings.kafka_request_timeout_ms,
            value_serializer=_serialize_json,
        )
        await candidate.start()
        _producer = candidate
        return True
    except Exception as exc:
        logger.warning('Kafka unavailable: %s', exc)
        if candidate is not None:
            try:
                await candidate.stop()
            except Exception:
                pass
        return False


async def close_kafka():
    global _producer
    producer, _producer = _producer, None
    if producer is None:
        return

    try:
        await producer.stop()
    except Exception as exc:
        logger.warning('Kafka shutdown degraded: %s', exc)


async def publish_event(topic, payload):
    if _producer is None:
        return False

    try:
        await _producer.send_and_wait(topic, payload)
        return True
    except Exception as exc:
        logger.warning('Kafka publish degraded: %s', exc)
        return False
