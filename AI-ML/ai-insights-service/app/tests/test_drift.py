import asyncio


def test_psi_distinguishes_stable_and_shifted_populations():
    from app.serve.drift import psi

    baseline = [50000 + (index % 10) * 1000 for index in range(100)]
    assert psi(baseline, list(baseline)) < 0.1
    shifted = [500000 + (index % 10) * 5000 for index in range(100)]
    assert psi(baseline, shifted) > 0.2


def test_drift_endpoint_publishes_alert_above_threshold(client, monkeypatch):
    from app.routers import drift

    async def windows(_feature):
        baseline = [50000 + (index % 10) * 1000 for index in range(100)]
        shifted = [500000 + (index % 10) * 5000 for index in range(100)]
        return baseline, shifted

    sent = []

    async def publish(topic, payload):
        sent.append((topic, payload))

    monkeypatch.setattr(drift, 'load_windows', windows)
    monkeypatch.setattr(drift, 'publish_alert', publish)
    response = client.get('/api/v1/drift/status?feature=amount')
    body = response.json()

    assert response.status_code == 200
    assert body['drift_detected'] is True
    assert body['psi'] > 0.2
    assert sent and sent[0][0] == 'ai.drift.alert'
    assert body['model_version']


def test_kafka_publisher_serializes_json_and_degrades(monkeypatch):
    from app import kafka_producer

    class Producer:
        def __init__(self, **kwargs):
            self.serializer = kwargs['value_serializer']
            self.started = False

        async def start(self):
            self.started = True

        async def stop(self):
            self.started = False

        async def send_and_wait(self, topic, payload):
            self.topic = topic
            self.payload = self.serializer(payload)

    monkeypatch.setattr(kafka_producer, 'AIOKafkaProducer', Producer)
    monkeypatch.setattr(kafka_producer, '_producer', None)

    assert asyncio.run(kafka_producer.connect_kafka()) is True
    assert asyncio.run(kafka_producer.publish_event('ai.drift.alert', {'psi': 0.3})) is True
    assert kafka_producer._producer.payload == b'{"psi":0.3}'
    asyncio.run(kafka_producer.close_kafka())
    assert asyncio.run(kafka_producer.publish_event('ai.drift.alert', {})) is False


def test_load_windows_uses_lpush_order_with_oldest_as_baseline(monkeypatch):
    from app.routers import drift

    class Redis:
        async def lrange(self, key, start, end):
            assert (key, start, end) == ('drift:amount', 0, 999)
            return [b'40', '30', b'20', '10']

    monkeypatch.setattr(drift, 'get_redis', lambda: Redis())
    baseline, current = asyncio.run(drift.load_windows('amount'))
    assert baseline == [20.0, 10.0]
    assert current == [40.0, 30.0]


def test_kafka_connect_uses_bounded_configured_request_timeout(monkeypatch):
    from app import kafka_producer
    from app.config import settings

    captured = {}

    class Producer:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def start(self):
            return None

        async def stop(self):
            return None

    monkeypatch.setattr(kafka_producer, 'AIOKafkaProducer', Producer)
    monkeypatch.setattr(kafka_producer, '_producer', None)
    assert settings.kafka_request_timeout_ms == 2000
    assert asyncio.run(kafka_producer.connect_kafka()) is True
    assert captured['request_timeout_ms'] == 2000
    asyncio.run(kafka_producer.close_kafka())
