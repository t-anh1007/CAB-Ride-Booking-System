import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRealtimeEvent } from "../src/realtime/normalize-event.js";

test("flattens the gateway realtime envelope so ride screens can read its payload", () => {
  assert.deepEqual(
    normalizeRealtimeEvent({
      type: "ride.assigned",
      payload: {
        rideId: "ride-123",
        driver: { name: "Test Driver" },
        status: "ASSIGNED"
      }
    }),
    {
      type: "ride.assigned",
      payload: {
        rideId: "ride-123",
        driver: { name: "Test Driver" },
        status: "ASSIGNED"
      },
      rideId: "ride-123",
      driver: { name: "Test Driver" },
      status: "ASSIGNED"
    }
  );
});
