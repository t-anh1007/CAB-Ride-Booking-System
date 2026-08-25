import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import express from 'express';

import Booking from '../src/models/Booking.js';
import bookingRouter from '../src/routes/bookingRoutes.js';
import messageBroker from '../src/utils/messageBroker.js';

const fixedCreatedAt = new Date('2026-08-25T00:00:00.000Z');
const persistedByIdempotencyKey = new Map();
let baseUrl;
let publishCount;
let saveCount;
let server;

before(async () => {
  mock.method(Booking, 'findOne', async ({ idempotencyKey }) => (
    persistedByIdempotencyKey.get(idempotencyKey) ?? null
  ));
  mock.method(Booking, 'find', ({ userId }) => ({
    sort: async () => [...persistedByIdempotencyKey.values()]
      .filter((booking) => booking.userId === userId)
      .reverse()
  }));
  mock.method(Booking.prototype, 'save', async function saveBooking() {
    saveCount += 1;
    this.bookingId = `BKG-T3-${saveCount}`;
    this.createdAt = fixedCreatedAt;
    this.updatedAt = fixedCreatedAt;
    persistedByIdempotencyKey.set(this.idempotencyKey, this);
    return this;
  });
  mock.method(messageBroker, 'publish', async () => {
    publishCount += 1;
  });

  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingRouter);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/bookings`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  mock.restoreAll();
});

beforeEach(() => {
  persistedByIdempotencyKey.clear();
  publishCount = 0;
  saveCount = 0;
});

const validBooking = (userId = 'USR-T3-001') => ({
  userId,
  pickup: { lat: 10.7769, lng: 106.7009, address: 'Pickup' },
  drop: { lat: 10.782, lng: 106.695, address: 'Drop' },
  vehicleType: 'car',
  paymentMethod: 'cash'
});

async function request(method, suffix = '', { body, idempotencyKey } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const response = await fetch(`${baseUrl}${suffix}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

test('[TC11] POST rejects a missing pickup with a pickup-specific 400 response', async () => {
  const body = validBooking();
  delete body.pickup;

  const response = await request('POST', '', { body, idempotencyKey: 'idem-tc11' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /pickup/i);
});

test('[TC12] POST rejects a non-numeric pickup coordinate with 422', async () => {
  const body = validBooking();
  body.pickup.lat = '10.7769';

  const response = await request('POST', '', { body, idempotencyKey: 'idem-tc12' });

  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /numeric|lat\/lng/i);
});

test('[TC3, TC6, TC31] valid POST returns REQUESTED with compatible camelCase and stable snake_case aliases', async () => {
  const response = await request('POST', '', {
    body: validBooking(),
    idempotencyKey: 'idem-create'
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'REQUESTED');
  assert.equal(response.body.data.bookingId, 'BKG-T3-1');
  assert.equal(response.body.data.createdAt, fixedCreatedAt.toISOString());
  assert.equal(response.body.data.booking_id, 'BKG-T3-1');
  assert.equal(response.body.data.created_at, fixedCreatedAt.toISOString());
});

test('[TC4, TC31] GET user bookings preserves the envelope and aliases every item', async () => {
  await request('POST', '', { body: validBooking('USR-LIST'), idempotencyKey: 'idem-list-1' });
  await request('POST', '', { body: validBooking('USR-LIST'), idempotencyKey: 'idem-list-2' });

  const response = await request('GET', '?user_id=USR-LIST');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Retrieved user bookings');
  assert.equal(response.body.data.length, 2);
  for (const booking of response.body.data) {
    assert.equal(booking.booking_id, booking.bookingId);
    assert.equal(booking.created_at, booking.createdAt);
    assert.equal(booking.status, 'REQUESTED');
  }
});

test('[TC19] duplicate Idempotency-Key returns one booking identity with one save', async () => {
  const first = await request('POST', '', { body: validBooking(), idempotencyKey: 'idem-repeat' });
  const second = await request('POST', '', { body: validBooking(), idempotencyKey: 'idem-repeat' });

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.body.data.bookingId, second.body.data.bookingId);
  assert.equal(saveCount, 1);
  assert.equal(persistedByIdempotencyKey.size, 1);
  assert.equal(publishCount, 1);
});
