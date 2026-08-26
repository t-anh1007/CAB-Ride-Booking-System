import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import express from 'express';

import Booking from '../src/models/Booking.js';
import bookingRouter from '../src/routes/bookingRoutes.js';
import messageBroker from '../src/utils/messageBroker.js';

const fixedCreatedAt = new Date('2026-08-25T00:00:00.000Z');
const persistedByIdempotencyKey = new Map();
let baseUrl;
let findOneCount;
let publishCount;
let saveAttemptCount;
let successfulSaveCount;
let server;

before(async () => {
  mock.method(Booking, 'findOne', async ({ idempotencyKey }) => {
    findOneCount += 1;
    return persistedByIdempotencyKey.get(idempotencyKey) ?? null;
  });
  mock.method(Booking, 'find', ({ userId }) => ({
    sort: () => ({
      limit: async (limit) => [...persistedByIdempotencyKey.values()]
        .filter((booking) => booking.userId === userId)
        .reverse()
        .slice(0, limit)
    })
  }));
  mock.method(Booking.prototype, 'save', async function saveBooking() {
    saveAttemptCount += 1;
    await new Promise((resolve) => setImmediate(resolve));
    if (this.idempotencyKey === 'idem-unrelated-e11000') {
      const error = new Error('duplicate key bookingId_1');
      error.code = 11000;
      error.keyPattern = { bookingId: 1 };
      throw error;
    }
    if (persistedByIdempotencyKey.has(this.idempotencyKey)) {
      const error = new Error('duplicate key idempotencyKey_1 ' + this.idempotencyKey);
      error.code = 11000;
      error.keyPattern = { idempotencyKey: 1 };
      error.keyValue = { idempotencyKey: this.idempotencyKey };
      throw error;
    }
    successfulSaveCount += 1;
    this.bookingId = 'BKG-T3-' + successfulSaveCount;
    this.createdAt = fixedCreatedAt;
    this.updatedAt = fixedCreatedAt;
    persistedByIdempotencyKey.set(this.idempotencyKey, this);
    return this;
  });
  mock.method(messageBroker, 'publish', async () => { publishCount += 1; });
  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingRouter);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = 'http://127.0.0.1:' + server.address().port + '/bookings';
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  mock.restoreAll();
});

beforeEach(() => {
  persistedByIdempotencyKey.clear();
  findOneCount = 0;
  publishCount = 0;
  saveAttemptCount = 0;
  successfulSaveCount = 0;
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
  const response = await fetch(baseUrl + suffix, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}

test('[TC11] missing pickup is rejected before persistence', async () => {
  const body = validBooking(); delete body.pickup;
  const response = await request('POST', '', { body, idempotencyKey: 'idem-tc11' });
  assert.equal(response.status, 400); assert.match(response.body.message, /pickup/i);
  assert.equal(saveAttemptCount, 0); assert.equal(findOneCount, 0);
});

test('[TC12] non-numeric coordinates are rejected before persistence', async () => {
  const body = validBooking(); body.pickup.lat = '10.7769';
  const response = await request('POST', '', { body, idempotencyKey: 'idem-tc12' });
  assert.equal(response.status, 422); assert.match(response.body.message, /numeric|lat\/lng/i);
  assert.equal(saveAttemptCount, 0); assert.equal(findOneCount, 0);
});

test('[TC3, TC6, TC31] unique create saves first without a pre-read and publishes once', async () => {
  const response = await request('POST', '', { body: validBooking(), idempotencyKey: 'idem-create' });
  assert.equal(response.status, 201); assert.equal(response.body.data.status, 'REQUESTED');
  assert.equal(response.body.data.bookingId, 'BKG-T3-1'); assert.equal(response.body.data.booking_id, 'BKG-T3-1');
  assert.equal(response.body.data.createdAt, fixedCreatedAt.toISOString()); assert.equal(response.body.data.created_at, fixedCreatedAt.toISOString());
  assert.equal(findOneCount, 0); assert.equal(saveAttemptCount, 1); assert.equal(publishCount, 1);
});

test('[TC4, TC31] GET user bookings preserves aliases and applies the requested limit', async () => {
  await request('POST', '', { body: validBooking('USR-LIST'), idempotencyKey: 'idem-list-1' });
  await request('POST', '', { body: validBooking('USR-LIST'), idempotencyKey: 'idem-list-2' });
  const response = await request('GET', '?user_id=USR-LIST&limit=1');
  assert.equal(response.status, 200); assert.equal(response.body.data.length, 1);
  for (const booking of response.body.data) { assert.equal(booking.booking_id, booking.bookingId); assert.equal(booking.created_at, booking.createdAt); }
});

test('[TC19] sequential duplicate catches idempotency E11000, returns 200, and never republishes', async () => {
  const first = await request('POST', '', { body: validBooking(), idempotencyKey: 'idem-repeat' });
  const second = await request('POST', '', { body: validBooking(), idempotencyKey: 'idem-repeat' });
  assert.deepEqual([first.status, second.status], [201, 200]);
  assert.equal(first.body.data.bookingId, second.body.data.bookingId);
  assert.equal(saveAttemptCount, 2); assert.equal(successfulSaveCount, 1); assert.equal(findOneCount, 1); assert.equal(publishCount, 1);
});

test('[TC19] concurrent duplicate race persists and publishes one booking identity', async () => {
  const [left, right] = await Promise.all([
    request('POST', '', { body: validBooking(), idempotencyKey: 'idem-race' }),
    request('POST', '', { body: validBooking(), idempotencyKey: 'idem-race' })
  ]);
  assert.deepEqual([left.status, right.status].sort(), [200, 201]);
  assert.equal(left.body.data.bookingId, right.body.data.bookingId);
  assert.equal(saveAttemptCount, 2); assert.equal(successfulSaveCount, 1); assert.equal(findOneCount, 1); assert.equal(publishCount, 1);
});

test('[TC19] unrelated E11000 remains an error and is never treated as idempotency', async () => {
  const response = await request('POST', '', { body: validBooking(), idempotencyKey: 'idem-unrelated-e11000' });
  assert.equal(response.status, 500); assert.match(response.body.message, /bookingId_1/);
  assert.equal(findOneCount, 0); assert.equal(publishCount, 0);
});
