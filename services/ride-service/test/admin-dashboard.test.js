import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import axios from 'axios';

let baseUrl;
let rideService;
let server;

before(async () => {
  mock.module('../src/services/kafka.publisher.js', {
    namedExports: { publishRideEvent: async () => ({ published: true }) }
  });
  mock.method(axios, 'patch', async () => ({ status: 200, data: { success: true } }));
  const [{ createApp }, rideModule] = await Promise.all([
    import('../src/app.js'),
    import('../src/services/ride.service.js')
  ]);
  rideService = rideModule.default;
  server = await new Promise((resolve) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/rides`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  mock.restoreAll();
});

beforeEach(() => rideService.clearAllRides());

async function get(path, role = 'Admin') {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'x-auth-role': role, 'x-auth-subject-id': 'ADMIN-1', 'x-auth-user-id': 'ADMIN-1' }
  });
  return { status: response.status, body: await response.json() };
}

const seed = (i, userId, status, priceSnapshot) => rideService.createRide({
  rideId: `RIDE-AD-${i}`,
  bookingId: `BOOKING-AD-${i}`,
  userId,
  pickup: { lat: 10.77, lng: 106.7, address: `Pickup ${i}` },
  destination: { lat: 10.78, lng: 106.69, address: `Drop ${i}` },
  priceSnapshot,
  status
});

test('stats include today/yesterday KPIs: rides, revenue from completed fares, new customers', async () => {
  await seed(1, 'U1', 'IN_PROGRESS', 50000);
  await seed(2, 'U1', 'SEARCHING', 30000);
  await seed(3, 'U2', 'IN_PROGRESS', 70000);
  // in-memory store returns the live object; mark it completed today
  Object.assign(await rideService.getRideById('RIDE-AD-1'), { status: 'COMPLETED', completedAt: new Date().toISOString() });

  const { status, body } = await get('/stats');
  assert.equal(status, 200);
  assert.equal(body.data.totalRides, 3);
  assert.deepEqual(body.data.today, { rides: 3, revenue: 50000, newCustomers: 2 });
  assert.deepEqual(body.data.yesterday, { rides: 0, revenue: 0, newCustomers: 0 });
  assert.equal(body.data.deltas.rides, null);
  assert.match(body.data.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('stats accept ?date and reject malformed dates', async () => {
  await seed(1, 'U1', 'SEARCHING', 10000);
  const past = await get('/stats?date=2020-01-01');
  assert.equal(past.status, 200);
  assert.equal(past.body.data.date, '2020-01-01');
  assert.deepEqual(past.body.data.today, { rides: 0, revenue: 0, newCustomers: 0 });

  const bad = await get('/stats?date=nope');
  assert.equal(bad.status, 422);
});

test('recent rides is admin-only and returns newest first with dashboard fields', async () => {
  for (let i = 1; i <= 6; i += 1) {
    await seed(i, `U${i}`, 'SEARCHING', i * 1000);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  const { status, body } = await get('/recent?limit=5');
  assert.equal(status, 200);
  assert.equal(body.data.items.length, 5);
  assert.equal(body.data.items[0].rideId, 'RIDE-AD-6');
  assert.deepEqual(Object.keys(body.data.items[0]).sort(), ['createdAt', 'destination', 'fare', 'pickup', 'rideId', 'status']);
  assert.equal(body.data.items[0].fare, 6000);
  assert.equal(body.data.items[0].pickup.address, 'Pickup 6');

  const denied = await get('/recent', 'Customer');
  assert.equal(denied.status, 403);
});
