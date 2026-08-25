import asyncio
import logging


def make_context(drivers=None, eta_minutes=12.0, price_quote=58000):
    return {
        'ride_id': 'BK123',
        'pickup': {'lat': 10.76, 'lng': 106.66},
        'drop': {'lat': 10.77, 'lng': 106.70},
        'available_drivers': drivers
        or [
            {'id': 'D1', 'distance_km': 5.0, 'rating': 4.5, 'status': 'ONLINE'},
            {'id': 'D2', 'distance_km': 2.0, 'rating': 4.5, 'status': 'ONLINE'},
        ],
        'traffic_level': 0.7,
        'demand_index': 1.5,
        'supply_index': 0.8,
        'eta_minutes': eta_minutes,
        'price_quote': price_quote,
        'sources': {},
        'missing_sources': [],
        'trace_id': 'trace-test',
    }


def test_agent_picks_nearest_when_equal_rating():
    from app.agent.decision import decide

    result = decide(make_context())
    assert result['chosen_driver']['id'] == 'D2'


def test_agent_weighs_rating_not_only_distance():
    from app.agent.decision import decide

    result = decide(
        make_context(
            [
                {'id': 'D1', 'distance_km': 2.0, 'rating': 4.0, 'status': 'ONLINE'},
                {'id': 'D2', 'distance_km': 2.2, 'rating': 4.9, 'status': 'ONLINE'},
            ]
        )
    )
    assert result['chosen_driver']['id'] == 'D2'


def test_agent_excludes_offline_drivers():
    from app.agent.decision import decide

    result = decide(
        make_context(
            [
                {'id': 'D1', 'distance_km': 1, 'rating': 5.0, 'status': 'OFFLINE'},
                {'id': 'D2', 'distance_km': 9, 'rating': 3.0, 'status': 'ONLINE'},
            ]
        )
    )
    assert result['chosen_driver']['id'] == 'D2'


def test_agent_falls_back_to_nearest_when_scorer_errors():
    from app.agent.decision import decide

    def failed_scorer(_context):
        raise RuntimeError('model unavailable')

    result = decide(make_context(), scorer=failed_scorer)
    assert result['strategy'] == 'fallback-nearest'
    assert result['chosen_driver']


def test_agent_missing_context_is_safe_and_logged(caplog):
    from app.agent.decision import decide

    caplog.set_level(logging.INFO)
    result = decide(make_context(eta_minutes=None, price_quote=None))
    assert result['chosen_driver']
    assert 'missing_sources' in result['meta']
    assert result['trace_id'] in caplog.text


def test_tool_retries_then_returns_none():
    from app.agent.tools import call_with_retry

    calls = {'count': 0}

    async def flaky():
        calls['count'] += 1
        raise RuntimeError('unavailable')

    assert asyncio.run(call_with_retry(flaky, timeout_seconds=0.01, delays=(0, 0))) is None
    assert calls['count'] == 3


def test_near_gps_distances_share_distance_component_so_rating_can_decide():
    from app.agent.decision import decide

    result = decide(
        make_context(
            [
                {'id': 'D1', 'distance_km': 2.0, 'rating': 4.0, 'status': 'ONLINE'},
                {'id': 'D2', 'distance_km': 2.2, 'rating': 4.9, 'status': 'ONLINE'},
            ]
        )
    )
    assert result['chosen_driver']['id'] == 'D2'


def test_missing_components_are_renormalized_and_offline_is_excluded():
    from app.agent.decision import decide

    result = decide(
        make_context(
            [
                {'id': 'D1', 'distance_km': 1, 'rating': 5, 'status': 'OFFLINE'},
                {'id': 'D2', 'distance_km': 9, 'rating': 3, 'status': 'ONLINE'},
            ],
            eta_minutes=None,
            price_quote=None,
        )
    )
    assert result['chosen_driver']['id'] == 'D2'


def test_tools_retry_non_success_then_none():
    from app.agent.tools import call_with_retry

    calls = {'count': 0}

    async def bad():
        calls['count'] += 1
        raise RuntimeError('non-2xx')

    assert asyncio.run(call_with_retry(bad, delays=(0, 0))) is None
    assert calls['count'] == 3


def test_agent_router_schedules_mongo_persistence_without_sync_db_failure(monkeypatch):
    from app.routers import agent

    created = []

    async def build_test_context(*_args):
        return {'available_drivers': [{'id': 'D1', 'distance_km': 1, 'rating': 5, 'status': 'ONLINE'}]}

    monkeypatch.setattr(agent, 'build_context', build_test_context)
    monkeypatch.setattr(agent.asyncio, 'create_task', lambda task: created.append(task))
    result = asyncio.run(agent.decision({'ride_id': 'BK1', 'pickup': {}, 'drop': {}}))
    for task in created:
        task.close()

    assert result['chosen_driver']['id'] == 'D1'
    assert len(created) == 1


def test_tools_use_container_safe_configured_service_urls(monkeypatch):
    from app.agent import tools
    from app.config import settings

    assert settings.driver_service_url == 'http://driver-service:3107/api/v1/drivers/available'
    assert settings.eta_service_url == 'http://eta-service:3110/api/v1/eta/calculate'
    assert settings.pricing_service_url == 'http://pricing-service:3101/api/v1/pricing/quote'

    called = []

    async def request(method, url, **_kwargs):
        called.append((method, url))
        return {}

    monkeypatch.setattr(tools, '_request', request)
    monkeypatch.setattr(settings, 'driver_service_url', 'http://driver-test/available')
    monkeypatch.setattr(settings, 'eta_service_url', 'http://eta-test/calculate')
    monkeypatch.setattr(settings, 'pricing_service_url', 'http://pricing-test/quote')
    asyncio.run(tools.fetch_available_drivers())
    asyncio.run(tools.fetch_eta({}, {}))
    asyncio.run(tools.fetch_price({}, {}))
    assert called == [
        ('get', 'http://driver-test/available'),
        ('post', 'http://eta-test/calculate'),
        ('post', 'http://pricing-test/quote'),
    ]


def test_context_aggregates_zone_supply_and_surge_with_traffic(monkeypatch):
    from app.agent import context

    class Redis:
        async def keys(self, pattern):
            assert pattern == 'supply:zone:*'
            return [b'supply:zone:a', 'supply:zone:b']

        async def scard(self, key):
            return {b'supply:zone:a': 2, 'supply:zone:b': 6}[key]

        async def get(self, key):
            return {'surge_zone:a': b'1.0', 'surge_zone:b': '2.0'}[key]

    async def drivers():
        return {'data': {'drivers': []}}

    async def eta(*_args):
        return {'data': {'etaMinutes': 12}}

    async def price(*_args):
        return {'data': {'amount': 58000}}

    monkeypatch.setattr(context, 'get_redis', lambda: Redis())
    monkeypatch.setattr(context.tools, 'fetch_available_drivers', drivers)
    monkeypatch.setattr(context.tools, 'fetch_eta', eta)
    monkeypatch.setattr(context.tools, 'fetch_price', price)
    result = asyncio.run(context.build_context('BK1', {'lat': 1, 'lng': 2}, {'lat': 3, 'lng': 4}))
    assert result['supply_index'] == 8
    assert result['demand_index'] == 1.5
    assert result['traffic_level'] == 0.5
    assert 'supply_demand' not in result['missing_sources']


def test_context_marks_missing_supply_demand_without_crashing(monkeypatch):
    from app.agent import context

    async def unavailable():
        raise RuntimeError('redis down')

    async def none(*_args):
        return None

    monkeypatch.setattr(context, 'get_redis', unavailable)
    monkeypatch.setattr(context.tools, 'fetch_available_drivers', none)
    monkeypatch.setattr(context.tools, 'fetch_eta', none)
    monkeypatch.setattr(context.tools, 'fetch_price', none)
    result = asyncio.run(context.build_context('BK2', {}, {}))
    assert result['supply_index'] is None
    assert result['demand_index'] is None
    assert result['traffic_level'] is None
    assert 'supply_demand' in result['missing_sources']


def test_consumer_scores_multiple_georadius_candidates_and_publishes_selected(monkeypatch):
    from app.tasks import consumer

    class Redis:
        async def georadius(self, *args, **kwargs):
            assert args == ('drivers:geo', 106.66, 10.76, 5, 'km')
            assert kwargs == {'withdist': True, 'count': 10}
            return [(b'D-far', b'3.0'), ('D-near', 1.0)]

    class Producer:
        def __init__(self):
            self.sent = []

        async def send_and_wait(self, topic, event):
            self.sent.append((topic, event))

    scheduled = []

    def choose_nearest(context, scorer=None):
        assert [driver['id'] for driver in context['available_drivers']] == ['D-far', 'D-near']
        assert [driver['distance_km'] for driver in context['available_drivers']] == [3.0, 1.0]
        return {'chosen_driver': context['available_drivers'][1], 'trace_id': 'trace', 'scores': []}

    async def no_persist(_result):
        return None

    monkeypatch.setattr(consumer, 'get_redis', lambda: Redis())
    monkeypatch.setattr(consumer, 'decide', choose_nearest)
    monkeypatch.setattr(consumer, '_persist_safely', no_persist)
    monkeypatch.setattr(consumer.asyncio, 'create_task', lambda coroutine: scheduled.append(coroutine))
    producer = Producer()
    event = asyncio.run(consumer.process_ride_created({'bookingId': 'BK3', 'pickup': {'lat': 10.76, 'lng': 106.66}}, producer))
    for coroutine in scheduled:
        coroutine.close()
    assert event['type'] == 'DriverSelected'
    assert event['driverId'] == 'D-near'
    assert producer.sent[0][1]['driverId'] == 'D-near'


def test_pricing_tool_maps_coordinates_address_and_vehicle_contract(monkeypatch):
    from app.agent import tools

    captured = []

    async def request(method, url, **kwargs):
        captured.append((method, url, kwargs['json']))
        return {}

    monkeypatch.setattr(tools, '_request', request)
    origin = {'lat': 10.76, 'lng': 106.66}
    destination = {'lat': 10.77, 'lng': 106.70, 'address': 'District 1'}
    asyncio.run(tools.fetch_price(origin, destination, 'car'))
    asyncio.run(tools.fetch_price(origin, destination, 'premium'))
    assert captured[0][2] == {
        'pickupLat': 10.76,
        'pickupLng': 106.66,
        'dropLat': 10.77,
        'dropLng': 106.70,
        'destinationAddress': 'District 1',
        'vehicleType': 'standard',
    }
    assert captured[1][2]['vehicleType'] == 'premium'


def test_context_normalizes_raw_driver_contract_and_nested_price(monkeypatch):
    from app.agent import context

    raw_drivers = [
        {'driverId': 'D-explicit', 'distance_km': '2.5', 'rating': '4.7', 'status': 'ONLINE'},
        {'driverId': 'D-coordinate', 'location': {'lat': 0, 'lng': 0.01}, 'status': 'ONLINE'},
        {'driverId': 'D-invalid', 'location': {'lat': 'bad', 'lng': 0}, 'status': 'ONLINE'},
    ]

    async def drivers():
        return {'data': {'drivers': raw_drivers}}

    async def eta(*_args):
        return {'data': {'etaMinutes': 12}}

    async def price(*_args):
        return {'data': {'priceSnapshot': {'amount': 58000}}}

    monkeypatch.setattr(context.tools, 'fetch_available_drivers', drivers)
    monkeypatch.setattr(context.tools, 'fetch_eta', eta)
    monkeypatch.setattr(context.tools, 'fetch_price', price)
    result = asyncio.run(context.build_context('BK4', {'lat': 0, 'lng': 0}, {'lat': 1, 'lng': 1}))
    assert raw_drivers[0]['driverId'] == 'D-explicit'
    assert result['available_drivers'][0] == {
        'id': 'D-explicit', 'distance_km': 2.5, 'rating': 4.7, 'status': 'ONLINE'
    }
    coordinate_driver = result['available_drivers'][1]
    assert coordinate_driver['id'] == 'D-coordinate'
    assert 1.10 < coordinate_driver['distance_km'] < 1.12
    assert coordinate_driver['rating'] == 0.0
    assert len(result['available_drivers']) == 2
    assert result['price_quote'] == 58000
    assert 'pricing' not in result['missing_sources']


def test_context_marks_malformed_price_response_as_missing(monkeypatch):
    from app.agent import context

    async def drivers():
        return {'data': {'drivers': []}}

    async def eta(*_args):
        return {'data': {'etaMinutes': 12}}

    async def malformed_price(*_args):
        return {'data': {'amount': 58000}}

    monkeypatch.setattr(context.tools, 'fetch_available_drivers', drivers)
    monkeypatch.setattr(context.tools, 'fetch_eta', eta)
    monkeypatch.setattr(context.tools, 'fetch_price', malformed_price)
    result = asyncio.run(context.build_context('BK5', {'lat': 0, 'lng': 0}, {'lat': 1, 'lng': 1}))
    assert result['price_quote'] is None
    assert 'pricing' in result['missing_sources']


def test_context_uses_surge_json_multiplier_and_legacy_numbers(monkeypatch):
    from app.agent import context

    class Redis:
        async def keys(self, _pattern):
            return ['supply:zone:a', 'supply:zone:b']

        async def scard(self, key):
            return {'supply:zone:a': 2, 'supply:zone:b': 6}[key]

        async def get(self, key):
            return {
                'surge_zone:a': b'{"multiplier": 1.8, "zoneId": "a"}',
                'surge_zone:b': '1.2',
            }[key]

    monkeypatch.setattr(context, 'get_redis', lambda: Redis())
    demand, supply, traffic = asyncio.run(context._supply_demand())
    assert demand == 1.5
    assert supply == 8
    assert traffic == 0.5


def test_normalize_driver_rejects_negative_distance_and_uses_location_fallback():
    from app.agent import context

    fallback = context._normalize_driver(
        {'driverId': 'D1', 'distance_km': -1, 'location': {'lat': 0, 'lng': 0.01}, 'status': 'ONLINE'},
        {'lat': 0, 'lng': 0},
    )
    excluded = context._normalize_driver({'driverId': 'D2', 'distance_km': -1, 'status': 'ONLINE'}, {'lat': 0, 'lng': 0})
    assert 1.10 < fallback['distance_km'] < 1.12
    assert excluded is None


def test_pricing_vehicle_aliases_preserve_supported_values():
    from app.agent.tools import _pricing_vehicle_type

    assert _pricing_vehicle_type('car') == 'standard'
    assert _pricing_vehicle_type('car_plus') == 'premium'
    assert [_pricing_vehicle_type(value) for value in ('bike', 'standard', 'premium', 'suv')] == ['bike', 'standard', 'premium', 'suv']


def test_agent_uses_predictor_confidence_when_rating_is_unavailable():
    from app.agent.decision import decide

    result = decide(
        make_context(
            [
                {'id': 'D1', 'distance_km': 2, 'rating': None, 'status': 'ONLINE'},
                {'id': 'D2', 'distance_km': 2, 'rating': None, 'status': 'ONLINE'},
            ],
            eta_minutes=None,
            price_quote=None,
        ),
        scorer=lambda _context: {'D1': 0.1, 'D2': 0.9},
    )
    assert result['chosen_driver']['id'] == 'D2'
    assert result['scores'][0]['components']['rating'] == 1.0


def test_consumer_passes_predictor_confidence_mapping_to_decision(monkeypatch):
    from app.tasks import consumer

    class Redis:
        async def georadius(self, *_args, **_kwargs):
            return [('D1', 2.0), ('D2', 2.0)]

    class Producer:
        async def send_and_wait(self, _topic, _event):
            return None

    captured = {}
    scheduled = []

    def predictor(candidates):
        captured['predictor_candidates'] = candidates
        return [
            {'driver_id': 'D1', 'confidence_score': 0.1},
            {'driver_id': 'D2', 'confidence_score': 0.9},
        ]

    def deciding(context, scorer=None):
        captured['mapping'] = scorer(context)
        return {'chosen_driver': context['available_drivers'][1], 'trace_id': 'trace', 'scores': []}

    async def no_persist(_result):
        return None

    monkeypatch.setattr(consumer, 'get_redis', lambda: Redis())
    monkeypatch.setattr(consumer, 'predict_matching_scores', predictor)
    monkeypatch.setattr(consumer, 'decide', deciding)
    monkeypatch.setattr(consumer, '_persist_safely', no_persist)
    monkeypatch.setattr(consumer.asyncio, 'create_task', lambda coroutine: scheduled.append(coroutine))
    event = asyncio.run(consumer.process_ride_created({'bookingId': 'BK6', 'pickup': {'lat': 0, 'lng': 0}}, Producer()))
    for coroutine in scheduled:
        coroutine.close()
    assert captured['predictor_candidates'] == [
        {'driver_id': 'D1', 'distance_km': 2.0},
        {'driver_id': 'D2', 'distance_km': 2.0},
    ]
    assert captured['mapping'] == {'D1': 0.1, 'D2': 0.9}
    assert event['driverId'] == 'D2'
