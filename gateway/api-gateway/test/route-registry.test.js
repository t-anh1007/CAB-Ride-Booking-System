import test from "node:test";
import assert from "node:assert/strict";

import { createRouteRegistry } from "../src/route-registry.js";

function resolveBookingCreate(env) {
  return createRouteRegistry({ env }).resolve({
    method: "POST",
    originalUrl: "/api/v1/bookings"
  });
}

function assertStandardPolicy(route) {
  assert.deepEqual(route.rateLimit, {
    name: "booking-create",
    limit: 10,
    windowMs: 10_000,
    identity: "user-or-ip"
  });
  assert.deepEqual(route.quota, {
    name: "booking-create-daily",
    limit: 100,
    windowMs: 24 * 60 * 60_000,
    identity: "user-or-ip"
  });
}

test("booking-create keeps standard policy when load-test mode is disabled", () => {
  assertStandardPolicy(resolveBookingCreate({ NODE_ENV: "development" }));
});

test("booking-create raises explicit middleware limits for local load testing", () => {
  const route = resolveBookingCreate({
    NODE_ENV: "development",
    GATEWAY_LOAD_TEST_MODE: "true"
  });

  assert.deepEqual(route.rateLimit, {
    name: "booking-create",
    limit: 100_000,
    windowMs: 10_000,
    identity: "user-or-ip"
  });
  assert.deepEqual(route.quota, {
    name: "booking-create-daily",
    limit: 1_000_000,
    windowMs: 24 * 60 * 60_000,
    identity: "user-or-ip"
  });
});

test("booking-create ignores load-test mode in production", () => {
  assertStandardPolicy(resolveBookingCreate({
    NODE_ENV: "production",
    GATEWAY_LOAD_TEST_MODE: "true"
  }));
});
