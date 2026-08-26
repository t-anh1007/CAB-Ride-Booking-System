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

function createOutbox() {
  const records = [];
  let nextId = 1;
  const persist = (record) => {
    const value = { _id: `outbox-${nextId++}`, ...structuredClone(record) };
    records.push(value);
    return value;
  };
  return {
    records,
    collection: {
      async insertOne(record) {
        const value = persist(record);
        return { acknowledged: true, insertedId: value._id };
      },
      async insertMany(values) {
        values.forEach(persist);
        return { acknowledged: true, insertedCount: values.length };
      },
      find() {
        let limit = Infinity;
        const cursor = {
          sort() { return cursor; },
          limit(value) { limit = value; return cursor; },
          async toArray() { return records.slice(0, limit).map((record) => structuredClone(record)); }
        };
        return cursor;
      },
      async deleteMany({ _id: { $in } }) {
        const before = records.length;
        for (let index = records.length - 1; index >= 0; index -= 1) {
          if ($in.includes(records[index]._id)) records.splice(index, 1);
        }
        return { deletedCount: before - records.length };
      },
      async deleteOne({ _id }) {
        const index = records.findIndex((record) => record._id === _id);
        if (index < 0) return { deletedCount: 0 };
        records.splice(index, 1);
        return { deletedCount: 1 };
      }
    }
  };
}

test("[TC73] slow Kafka is removed from request-path latency", async () => {
  const outbox = createOutbox();
  const sends = [];
  const broker = new brokerModule.MessageBroker({
    outboxCollection: outbox.collection,
    dispatchDelayMs: 60_000,
    producer: {
      async send(batch) { await new Promise((resolve) => setTimeout(resolve, 250)); sends.push(batch); },
      async disconnect() {}
    }
  });
  const payload = { eventId: "evt-slow", bookingId: "BKG-SLOW" };
  const startedAt = performance.now();
  const result = broker.publish("ride.created", payload);
  const elapsedMs = performance.now() - startedAt;
  assert.ok(elapsedMs < 20, `enqueue took ${elapsedMs.toFixed(1)}ms`);
  assert.deepEqual(result, { published: false, buffered: false, queued: true });
  assert.equal(outbox.records.length, 0);
  assert.deepEqual(await broker.drainQueue(), { published: 1, buffered: 0 });
  assert.equal(sends.length, 1);
  assert.deepEqual(JSON.parse(sends[0].messages[0].value), payload);
  await broker.close();
});

test("[TC68, TC73] topic batches share one non-overlapping drain", async () => {
  const outbox = createOutbox();
  const sends = [];
  let active = 0;
  let maxActive = 0;
  const broker = new brokerModule.MessageBroker({
    outboxCollection: outbox.collection,
    dispatchDelayMs: 60_000,
    producer: {
      async send(batch) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        sends.push(batch);
        await new Promise((resolve) => setImmediate(resolve));
        active -= 1;
      },
      async disconnect() {}
    }
  });
  broker.publish("ride.created", { bookingId: "BKG-1" });
  broker.publish("ride.created", { bookingId: "BKG-2" });
  broker.publish("ride.cancelled", { bookingId: "BKG-3" });
  const first = broker.drainQueue();
  const second = broker.drainQueue();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.deepEqual(secondResult, firstResult);
  assert.deepEqual(firstResult, { published: 3, buffered: 0 });
  assert.equal(maxActive, 1);
  assert.deepEqual(sends.map((batch) => [batch.topic, batch.messages.length]), [
    ["ride.created", 2],
    ["ride.cancelled", 1]
  ]);
  await broker.close();
});

test("[TC73] queue overflow durably backpressures instead of dropping", async () => {
  const outbox = createOutbox();
  const sends = [];
  let releaseSend;
  const broker = new brokerModule.MessageBroker({
    outboxCollection: outbox.collection,
    dispatchCapacity: 1,
    dispatchDelayMs: 60_000,
    producer: {
      async send(batch) {
        sends.push(batch);
        await new Promise((resolve) => { releaseSend = resolve; });
      },
      async disconnect() {}
    }
  });
  assert.deepEqual(broker.publish("ride.created", { eventId: "evt-queued", bookingId: "BKG-QUEUED" }), {
    published: false, buffered: false, queued: true
  });
  const drain = broker.drainQueue();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(broker.inFlightCount, 1, "capacity must include the batch currently in flight");
  const overflow = await broker.publish("ride.created", { eventId: "evt-overflow", bookingId: "BKG-OVERFLOW" });
  assert.deepEqual(overflow, { published: false, buffered: true, queued: false });
  assert.equal(outbox.records.length, 1);
  assert.equal(outbox.records[0].payload.eventId, "evt-overflow");
  releaseSend();
  await drain;
  assert.equal(sends.length, 1);
  assert.equal(JSON.parse(sends[0].messages[0].value).eventId, "evt-queued");
  await broker.close();
});

test("[TC38, TC73] Kafka failure spills exact batches, opens circuit, and replays later", async () => {
  const outbox = createOutbox();
  let nowMs = 1000;
  let available = false;
  let attempts = 0;
  const successful = [];
  const broker = new brokerModule.MessageBroker({
    outboxCollection: outbox.collection,
    clock: () => nowMs,
    circuitOpenMs: 2000,
    dispatchDelayMs: 60_000,
    producer: {
      async send(batch) {
        attempts += 1;
        if (!available) throw new Error("Kafka unavailable");
        successful.push(batch);
      },
      async disconnect() {}
    }
  });
  broker.publish("ride.created", { eventId: "evt-a", bookingId: "BKG-A" });
  broker.publish("ride.created", { eventId: "evt-b", bookingId: "BKG-B" });
  assert.deepEqual(await broker.drainQueue(), { published: 0, buffered: 2 });
  assert.equal(attempts, 1);
  assert.deepEqual(outbox.records.map((record) => record.payload.eventId), ["evt-a", "evt-b"]);

  const duringCircuit = await broker.publish("ride.created", { eventId: "evt-c", bookingId: "BKG-C" });
  assert.deepEqual(duringCircuit, { published: false, buffered: true, queued: false });
  assert.equal(attempts, 1, "open circuit must not retry Kafka");
  assert.deepEqual(outbox.records.map((record) => record.payload.eventId), ["evt-a", "evt-b", "evt-c"]);

  available = true;
  nowMs = 3001;
  assert.deepEqual(await broker.flushOutbox(), { published: 3 });
  assert.equal(outbox.records.length, 0);
  assert.equal(successful.length, 1);
  assert.deepEqual(successful[0].messages.map((message) => JSON.parse(message.value).eventId), ["evt-a", "evt-b", "evt-c"]);
  await broker.close();
});

test("[TC73] close drains queued events to durable outbox before disconnect", async () => {
  const outbox = createOutbox();
  let disconnected = false;
  const broker = new brokerModule.MessageBroker({
    outboxCollection: outbox.collection,
    dispatchDelayMs: 60_000,
    producer: {
      async send() { throw new Error("Kafka unavailable"); },
      async disconnect() { disconnected = true; }
    }
  });
  broker.publish("ride.created", { eventId: "evt-close-a", bookingId: "BKG-CLOSE-A" });
  broker.publish("ride.created", { eventId: "evt-close-b", bookingId: "BKG-CLOSE-B" });
  await broker.close();
  assert.equal(disconnected, true);
  assert.equal(broker.queue.length, 0);
  assert.deepEqual(outbox.records.map((record) => record.payload.eventId), ["evt-close-a", "evt-close-b"]);
});


test('[TC38, TC73] failed startup connection still schedules default durable replay', async () => {
  const outbox = createOutbox();
  let nowMs = 1000;
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

  const broker = new brokerModule.MessageBroker({
    producer: {
      async connect() { throw new Error('Kafka unavailable at startup'); },
      async send(batch) {
        if (!available) throw new Error('Kafka unavailable');
        return batch;
      },
      async disconnect() {}
    },
    outboxCollection: outbox.collection,
    autoReplay: true,
    clock: () => nowMs,
    dispatchDelayMs: 60_000,
    circuitOpenMs: 2000
  });

  try {
    assert.equal(brokerModule.default.autoReplay, true, 'service singleton must enable replay by default');
    await broker.connect();
    assert.equal(scheduled?.delay, 10000);
    assert.equal(unrefCalled, true);

    broker.publish('ride.created', { eventId: 'evt-startup', bookingId: 'BKG-STARTUP' });
    assert.deepEqual(await broker.drainQueue(), { published: 0, buffered: 1 });
    assert.equal(outbox.records.length, 1);

    available = true;
    nowMs = 3001;
    scheduled.callback();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(outbox.records.length, 0, 'scheduled replay removes only successfully delivered records');
  } finally {
    await broker.close();
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});
