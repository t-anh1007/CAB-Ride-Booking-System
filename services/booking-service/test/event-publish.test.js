import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import express from 'express';

import Booking from '../src/models/Booking.js';
import bookingRouter from '../src/routes/bookingRoutes.js';
import * as brokerModule from '../src/utils/messageBroker.js';

const fixedCreatedAt = new Date('2026-08-25T00:00:00.000Z');
const publishedContracts = [];
let baseUrl;
let server;

before(async () => {
  mock.method(Booking, 'findOne', async () => null);
  mock.method(Booking.prototype, 'save', async function saveBooking() {
    this.bookingId = 'BKG-EVENT-1';
    this.createdAt = fixedCreatedAt;
    this.updatedAt = fixedCreatedAt;
    return this;
  });
  mock.method(brokerModule.default, 'publish', async (topic, payload) => {
    publishedContracts.push({ topic, payload });
    return { published: true };
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
  publishedContracts.length = 0;
});

test('[TC25] successful booking publishes the complete ride.created contract', async () => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'idem-event-contract' },
    body: JSON.stringify({
      userId: 'USR-EVENT',
      pickup: { lat: 10.7769, lng: 106.7009, address: 'Pickup' },
      drop: { lat: 10.782, lng: 106.695, address: 'Drop' },
      vehicleType: 'car',
      paymentMethod: 'cash'
    })
  });

  assert.equal(response.status, 201);
  assert.equal(publishedContracts.length, 1);
  const event = publishedContracts[0];
  assert.equal(event.topic, 'ride.created');
  assert.equal(event.payload.type, 'RideCreated');
  assert.equal(event.payload.bookingId, 'BKG-EVENT-1');
  assert.equal(event.payload.rideId, 'BKG-EVENT-1');
  assert.deepEqual(JSON.parse(JSON.stringify(event.payload.pickup)), { lat: 10.7769, lng: 106.7009, address: 'Pickup' });
  assert.equal(new Date(event.payload.timestamp).toISOString(), fixedCreatedAt.toISOString());
});

test('[TC38, TC73] Kafka failure persists and replays one durable outbox record', async () => {
  assert.equal(
    typeof brokerModule.MessageBroker,
    'function',
    'MessageBroker must expose an injectable implementation for durable outbox recovery'
  );

  const records = [];
  let nextId = 1;
  const outboxCollection = {
    async createIndex() {},
    async insertOne(record) {
      const persisted = { _id: `outbox-${nextId}`, ...record };
      nextId += 1;
      records.push(persisted);
      return { acknowledged: true, insertedId: persisted._id };
    },
    find() {
      return {
        sort() {
          return { toArray: async () => records.map((record) => ({ ...record })) };
        }
      };
    },
    async deleteOne({ _id }) {
      const index = records.findIndex((record) => record._id === _id);
      if (index === -1) return { deletedCount: 0 };
      records.splice(index, 1);
      return { deletedCount: 1 };
    }
  };
  const sends = [];
  let kafkaAvailable = false;
  const producer = {
    async connect() {},
    async disconnect() {},
    async send(batch) {
      if (!kafkaAvailable) throw new Error('Kafka unavailable');
      sends.push(batch);
    }
  };
  const broker = new brokerModule.MessageBroker({
    producer,
    outboxCollection,
    now: () => '2026-08-25T00:00:00.000Z',
    autoReplay: false
  });
  const payload = {
    type: 'RideCreated',
    bookingId: 'BKG-OUTBOX-1',
    rideId: 'BKG-OUTBOX-1',
    pickup: { lat: 10.77, lng: 106.7 },
    timestamp: '2026-08-25T00:00:00.000Z'
  };

  const buffered = await broker.publish('ride.created', payload);

  assert.deepEqual(buffered, { published: false, buffered: true });
  assert.equal(records.length, 1);
  assert.deepEqual(
    { topic: records[0].topic, payload: records[0].payload, createdAt: records[0].createdAt },
    { topic: 'ride.created', payload, createdAt: '2026-08-25T00:00:00.000Z' }
  );

  const failedFlush = await broker.flushOutbox();
  assert.equal(failedFlush.published, 0);
  assert.equal(records.length, 1, 'failed replay must retain the durable record');

  kafkaAvailable = true;
  const successfulFlush = await broker.flushOutbox();
  assert.equal(successfulFlush.published, 1);
  assert.equal(records.length, 0, 'only the successfully published record is removed');
  assert.equal(sends.length, 1);
  assert.equal(sends[0].topic, 'ride.created');
  assert.deepEqual(JSON.parse(sends[0].messages[0].value), payload);
  await broker.close();
});


test('[TC38, TC73] failed startup connection still schedules automatic outbox recovery', async () => {
  const records = [];
  let available = false;
  let scheduled;
  let unrefCalled = false;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  globalThis.setInterval = (callback, delay) => {
    scheduled = { callback, delay, unref() { unrefCalled = true; } };
    return scheduled;
  };
  globalThis.clearInterval = () => {};

  const outboxCollection = {
    async insertOne(record) { records.push({ _id: 'startup-outbox-1', ...record }); },
    find() { return { sort() { return { toArray: async () => records.map((record) => ({ ...record })) }; } }; },
    async deleteOne({ _id }) {
      const index = records.findIndex((record) => record._id === _id);
      if (index === -1) return { deletedCount: 0 };
      records.splice(index, 1);
      return { deletedCount: 1 };
    }
  };
  const producer = {
    async connect() { throw new Error('Kafka unavailable at startup'); },
    async disconnect() {},
    async send() {
      if (!available) throw new Error('Kafka unavailable');
    }
  };

  try {
    const broker = new brokerModule.MessageBroker({ producer, outboxCollection, autoReplay: true });
    await broker.connect();
    assert.equal(scheduled?.delay, 10000);
    assert.equal(unrefCalled, true);

    const buffered = await broker.publish('ride.created', { bookingId: 'BKG-STARTUP-1' });
    assert.deepEqual(buffered, { published: false, buffered: true });
    assert.equal(records.length, 1);

    available = true;
    scheduled.callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(records.length, 0);
    await broker.close();
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});
