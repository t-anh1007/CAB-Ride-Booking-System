import test from "node:test";
import assert from "node:assert/strict";
import { createApiClient, GatewayError } from "../src/api/client.js";

test("client refreshes once, carries credentials and retries an idempotent request", async () => {
  const calls = []; let token = "expired";
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/refresh")) return new Response(JSON.stringify({ success: true, data: { accessToken: "fresh" } }));
    return calls.filter((call) => call.url.endsWith("/bookings")).length === 1
      ? new Response(JSON.stringify({ success: false, message: "expired" }), { status: 401 })
      : new Response(JSON.stringify({ success: true, data: { id: "B1" } }));
  };
  const client = createApiClient({ baseUrl: "http://gateway/api/v1", getToken: () => token, getRefreshToken: () => "refresh-1", setToken: (value) => { token = value; }, fetchImpl });
  const result = await client.post("/bookings", { vehicleType: "car" }, { idempotent: true });
  assert.equal(result.data.id, "B1");
  assert.equal(calls.filter((call) => call.url.endsWith("/auth/refresh")).length, 1);
  assert.deepEqual(JSON.parse(calls[1].options.body), { refreshToken: "refresh-1" });
  assert.equal(calls[0].options.credentials, "include");
  assert.ok(calls[0].options.headers["Idempotency-Key"]);
});

test("client keeps structured gateway failures available to the UI", async () => {
  const client = createApiClient({ baseUrl: "http://gateway/api/v1", fetchImpl: async () => new Response(JSON.stringify({ success: false, message: "Unavailable", code: "SERVICE_UNAVAILABLE", data: { retryable: true } }), { status: 503 }) });
  await assert.rejects(() => client.get("/rides/stats"), (error) => error instanceof GatewayError && error.status === 503 && error.code === "SERVICE_UNAVAILABLE" && error.payload.data.retryable === true);
});
