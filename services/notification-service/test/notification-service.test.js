import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createNotificationApp } from "../src/app.js";
import { InMemoryNotificationRepository } from "../src/notification-repository.js";

test("internal send accepts notification and exposes delivery history", async (t) => {
  const runtime = await startRuntime();
  t.after(runtime.close);

  const createResponse = await fetchJson(`${runtime.baseUrl}/internal/notifications/send`, {
    method: "POST",
    body: JSON.stringify({
      userId: "customer-1",
      type: "RIDE_ASSIGNED",
      title: "Da tim thay tai xe",
      message: "Tai xe dang den diem don cua ban",
      channel: "push",
      relatedEntityType: "RIDE",
      relatedEntityId: "ride-1"
    })
  });

  assert.equal(createResponse.status, 202);
  assert.equal(createResponse.body.success, true);
  assert.equal(createResponse.body.data.status, "PENDING");

  const delivered = await waitFor(async () => {
    const response = await fetchJson(`${runtime.baseUrl}/api/v1/notifications?userId=customer-1`);
    const notification = response.body.data[0];

    return notification?.status === "SENT" ? notification : null;
  });

  assert.equal(delivered.type, "RIDE_ASSIGNED");
  assert.equal(delivered.channel, "push");
  assert.equal(delivered.attemptCount, 1);
});

test("duplicate notifications are deduplicated within the notification service", async (t) => {
  const runtime = await startRuntime();
  t.after(runtime.close);

  const payload = {
    userId: "customer-2",
    type: "PAYMENT_FAILED",
    title: "Thanh toan that bai",
    message: "Giao dich cua ban khong thanh cong",
    channel: "push",
    idempotencyKey: "payment-2-failed"
  };

  const first = await fetchJson(`${runtime.baseUrl}/internal/notifications/send`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const second = await fetchJson(`${runtime.baseUrl}/internal/notifications/send`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  assert.equal(first.status, 202);
  assert.equal(second.status, 200);
  assert.equal(second.body.meta.duplicate, true);
  assert.equal(second.body.data.notificationId, first.body.data.notificationId);
});

test("failed deliveries are retried with backoff until they succeed", async (t) => {
  let attempt = 0;
  const runtime = await startRuntime({
    dispatcher: {
      async dispatch(notification) {
        attempt += 1;

        if (attempt < 3) {
          throw new Error(`Simulated failure ${attempt}`);
        }

        return {
          channel: notification.channel,
          provider: "test-dispatcher",
          deliveryReference: `test-${notification.id}`,
          deliveredAt: new Date().toISOString()
        };
      }
    },
    baseRetryDelayMs: 15
  });
  t.after(runtime.close);

  await fetchJson(`${runtime.baseUrl}/internal/notifications/send`, {
    method: "POST",
    body: JSON.stringify({
      userId: "customer-3",
      type: "RIDE_STATUS_UPDATED",
      title: "Cap nhat trang thai chuyen di",
      message: "Tai xe sap toi diem don",
      channel: "push",
      relatedEntityType: "RIDE",
      relatedEntityId: "ride-3"
    })
  });

  const delivered = await waitFor(async () => {
    const response = await fetchJson(`${runtime.baseUrl}/api/v1/notifications?userId=customer-3`);
    const notification = response.body.data[0];

    return notification?.status === "SENT" ? notification : null;
  });

  assert.equal(delivered.attemptCount, 3);
  assert.equal(attempt, 3);
});

test("domain events are mapped into notification records without touching other services", async (t) => {
  const runtime = await startRuntime();
  t.after(runtime.close);

  const result = await runtime.notificationService.processDomainEvent({
    topic: "ride.status.changed",
    payload: {
      eventId: "event-ride-9",
      userId: "customer-9",
      rideId: "ride-9",
      status: "ARRIVING"
    }
  });

  assert.equal(result.accepted, true);

  const delivered = await waitFor(async () => {
    const response = await fetchJson(`${runtime.baseUrl}/api/v1/notifications?userId=customer-9`);
    const notification = response.body.data[0];

    return notification?.status === "SENT" ? notification : null;
  });

  assert.equal(delivered.type, "RIDE_STATUS_UPDATED");
  assert.equal(delivered.relatedEntityId, "ride-9");
});

test("channel specific validation stays inside notification service", async (t) => {
  const runtime = await startRuntime();
  t.after(runtime.close);

  const response = await fetchJson(`${runtime.baseUrl}/internal/notifications/send`, {
    method: "POST",
    body: JSON.stringify({
      userId: "customer-4",
      type: "PAYMENT_FAILED",
      title: "Thanh toan that bai",
      message: "Khong gui duoc email",
      channel: "email"
    })
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /destination\.email/);
});

async function startRuntime(options = {}) {
  const runtime = await createNotificationApp({
    repository: new InMemoryNotificationRepository(),
    maxAttempts: 3,
    baseRetryDelayMs: 10,
    ...options
  });
  const server = runtime.app.listen(0);

  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    ...runtime,
    baseUrl,
    async close() {
      await runtime.close();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function waitFor(predicate, { timeoutMs = 1_000, intervalMs = 20 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();

    if (value) {
      return value;
    }

    await delay(intervalMs);
  }

  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}
