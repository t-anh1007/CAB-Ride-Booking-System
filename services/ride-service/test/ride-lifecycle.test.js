import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import axios from 'axios';

const publishedEvents = [];
let baseUrl;
let RIDE_STATUS;
let rideService;
let server;

before(async () => {
  mock.module('../src/services/kafka.publisher.js', {
    namedExports: {
      publishRideEvent: async (topic, payload, key) => {
        publishedEvents.push({ topic, payload, key });
        return { published: true };
      }
    }
  });
  mock.method(axios, 'patch', async () => ({ status: 200, data: { success: true } }));

  const [{ createApp }, rideModule, modelModule] = await Promise.all([
    import('../src/app.js'),
    import('../src/services/ride.service.js'),
    import('../src/models/ride.model.js')
  ]);
  rideService = rideModule.default;
  RIDE_STATUS = modelModule.RIDE_STATUS;
  const app = createApp();
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/rides`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  mock.restoreAll();
});

beforeEach(async () => {
  await rideService.clearAllRides();
  publishedEvents.length = 0;
});

const ridePayload = (overrides = {}) => ({
  rideId: 'RIDE-T5-1',
  bookingId: 'BOOKING-T5-1',
  userId: 'USER-T5-1',
  driverId: 'DRIVER-T5-1',
  pickup: { lat: 10.77, lng: 106.7 },
  destination: { lat: 10.78, lng: 106.69 },
  status: RIDE_STATUS.SEARCHING,
  ...overrides
});

async function post(path, body, role, userId) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auth-role': role,
      'x-auth-subject-id': userId,
      'x-auth-user-id': userId
    },
    body: JSON.stringify(body ?? {})
  });
  return { status: response.status, body: await response.json() };
}

test('[TC27] real assign and accept routes perform SEARCHING to WAITING_FOR_ACCEPTANCE to ACCEPTED', async () => {
  await rideService.createRide(ridePayload({ driverId: null }));
  publishedEvents.length = 0;

  const assigned = await post('/RIDE-T5-1/assign-driver', { driverId: 'DRIVER-T5-1' }, 'Admin', 'ADMIN-T5-1');

  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.success, true);
  assert.equal(assigned.body.data.status, 'WAITING_FOR_ACCEPTANCE');
  assert.equal(assigned.body.data.driverId, 'DRIVER-T5-1');

  const accepted = await post('/RIDE-T5-1/accept', {}, 'Driver', 'DRIVER-T5-1');

  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.data.status, 'ACCEPTED');
  assert.ok(publishedEvents.some((event) => (
    event.topic === 'ride.status.changed' && event.payload.status === 'WAITING_FOR_ACCEPTANCE'
  )));
  assert.ok(publishedEvents.some((event) => (
    event.topic === 'ride.status.changed' && event.payload.status === 'ACCEPTED'
  )));
});

test('[TC32] illegal terminal transition is rejected without persistence or event', async () => {
  await rideService.createRide(ridePayload({ status: RIDE_STATUS.COMPLETED }));
  publishedEvents.length = 0;

  const response = await post('/RIDE-T5-1/start', {}, 'Driver', 'DRIVER-T5-1');

  assert.equal(response.status, 400);
  assert.match(response.body.message, /cannot start ride/i);
  assert.equal((await rideService.getRideById('RIDE-T5-1')).status, 'COMPLETED');
  assert.equal(publishedEvents.length, 0);
});

test('[TC32] completing an in-progress ride persists COMPLETED with a timestamp and event', async () => {
  await rideService.createRide(ridePayload({ status: RIDE_STATUS.IN_PROGRESS }));
  publishedEvents.length = 0;

  const response = await post('/RIDE-T5-1/complete', {}, 'Driver', 'DRIVER-T5-1');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'COMPLETED');
  assert.ok(Number.isFinite(Date.parse(response.body.data.completedAt)));
  assert.ok(publishedEvents.some((event) => (
    event.topic === 'ride.status.changed' && event.payload.status === 'COMPLETED'
  )));
});
