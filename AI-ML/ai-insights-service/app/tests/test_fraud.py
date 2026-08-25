def test_missing_fields_returns_400(client):
    response = client.post('/api/v1/fraud/score', json={'user_id': 'USR123'})
    assert response.status_code == 400
    assert 'missing required fields' in response.json()['detail']


def test_high_amount_velocity_and_booking_route_are_strictly_flagged(client, monkeypatch):
    from app.routers import fraud

    async def history(_user_id, _booking_id):
        return [50000.0, 60000.0, 55000.0], 6, 100.0

    monkeypatch.setattr(fraud, 'fetch_history', history)
    body = client.post(
        '/api/v1/fraud/score',
        json={'user_id': 'USR123', 'booking_id': 'BK9', 'amount': 5_000_000, 'payment_method': 'card'},
    ).json()

    assert body['fraud_score'] > 0.7
    assert body['flagged'] is True
    assert {'amount_anomaly', 'velocity_high', 'route_anomaly'} <= set(body['reasons'])


def test_mongo_failure_degrades_to_safe_normal_score(client, monkeypatch):
    from app.routers import fraud

    async def unavailable(*_args):
        raise RuntimeError('mongo unavailable')

    monkeypatch.setattr(fraud, 'fetch_history', unavailable)
    body = client.post(
        '/api/v1/fraud/score',
        json={'user_id': 'USR123', 'booking_id': 'BK10', 'amount': 55000, 'payment_method': 'cash'},
    ).json()

    assert body['flagged'] is False
