from datetime import datetime, timedelta, timezone


def test_recommendations_return_ranked_online_top_n(client):
    response = client.post(
        '/api/v1/recommendations/drivers',
        json={
            'drivers': [
                {'id': 'D1', 'distance_km': 1, 'rating': 4.1, 'eta_minutes': 3, 'status': 'ONLINE'},
                {'id': 'D2', 'distance_km': 2, 'rating': 4.9, 'eta_minutes': 4, 'status': 'ONLINE'},
                {'id': 'D3', 'distance_km': 3, 'rating': 4.5, 'eta_minutes': 5, 'status': 'ONLINE'},
                {'id': 'D4', 'distance_km': 4, 'rating': 3.0, 'eta_minutes': 8, 'status': 'ONLINE'},
                {'id': 'D5', 'distance_km': 0.1, 'rating': 5, 'eta_minutes': 1, 'status': 'OFFLINE'},
            ],
            'top_n': 3,
            'price_quote': 50000,
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert len(body['recommendations']) == 3
    assert 'D5' not in [item['id'] for item in body['recommendations']]
    assert [item['rank'] for item in body['recommendations']] == [1, 2, 3]
    assert body['recommendations'][0]['score'] >= body['recommendations'][1]['score']
    assert body['model_version']


def test_demand_forecast_has_requested_increasing_horizon(client):
    response = client.get('/api/v1/forecast/demand?zone=zone-a&horizon=6')
    body = response.json()

    assert response.status_code == 200
    assert body['zone'] == 'zone-a'
    assert body['horizon'] == 6
    assert len(body['forecast']) == 6
    timestamps = [datetime.fromisoformat(point['timestamp'].replace('Z', '+00:00')) for point in body['forecast']]
    assert timestamps == sorted(timestamps)
    assert all(point['value'] >= 0 for point in body['forecast'])
    assert body['model_version']


def test_recommendations_omit_unavailable_components_and_exclude_offline(client):
    body = client.post(
        '/api/v1/recommendations/drivers',
        json={
            'drivers': [
                {'id': 'D1', 'distance_km': 2.0, 'rating': 4.0, 'status': 'ONLINE'},
                {'id': 'D2', 'distance_km': 2.2, 'rating': 4.9, 'status': 'ONLINE'},
                {'id': 'D3', 'distance_km': 0.1, 'rating': 5, 'status': 'OFFLINE'},
            ],
            'top_n': 2,
        },
    ).json()

    assert [item['id'] for item in body['recommendations']] == ['D2', 'D1']


def test_forecast_uses_seven_day_hour_average(client, monkeypatch):
    from app.routers import forecast

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    projected_hour = now + timedelta(hours=1)

    async def history(_zone, _start):
        return [
            {'createdAt': projected_hour - timedelta(days=day)}
            for day in range(7)
            for _ in range(2)
        ]

    monkeypatch.setattr(forecast, 'load_booking_history', history)
    body = client.get('/api/v1/forecast/demand?zone=zone-a&horizon=2').json()

    assert body['degraded'] is False
    assert len(body['forecast']) == 2
    assert body['forecast'][0]['value'] == 2.0


def test_forecast_is_degraded_only_when_history_fails(client, monkeypatch):
    from app.routers import forecast

    async def unavailable(*_args):
        raise RuntimeError('mongo unavailable')

    monkeypatch.setattr(forecast, 'load_booking_history', unavailable)
    body = client.get('/api/v1/forecast/demand?zone=zone-a&horizon=1').json()

    assert body['degraded'] is True
    assert body['forecast'][0]['value'] == 1.0
