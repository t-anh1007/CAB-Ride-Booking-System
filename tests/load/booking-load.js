import http from "k6/http";
import { check, fail, sleep } from "k6";

const gateway = __ENV.GATEWAY_URL || "http://host.docker.internal:3000";
const token = __ENV.TEST_JWT || "";
const testUserId = __ENV.TEST_USER_ID || "";
export const options = { stages: [{ duration: "30s", target: 10 }, { duration: "90s", target: 100 }], thresholds: { checks: ["rate>0.99"], http_req_failed: ["rate<0.05"], http_req_duration: ["p(95)<300"] } };

function safeJson(response) { try { return response.json(); } catch (_) { return null; } }
function localIdempotencyKey() { return ["k6", __VU, __ITER, Date.now(), Math.random().toString(36).slice(2), Math.random().toString(36).slice(2)].join("-"); }
function successfulBooking(response) { if (response.status !== 201) return false; const body = safeJson(response); return body?.success === true && typeof body?.data?.booking_id === "string" && body.data.booking_id.length > 0; }
export function setup() { if (!token) fail("TEST_JWT must be non-empty"); if (!testUserId) fail("TEST_USER_ID must be non-empty"); return { userId: testUserId }; }
export default function (data) { const body = JSON.stringify({ userId: data.userId, pickup: { lat: 10.7769, lng: 106.7009 }, drop: { lat: 10.781, lng: 106.697 }, vehicleType: "car" }); const response = http.post(gateway + "/api/v1/bookings", body, { headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, "Idempotency-Key": localIdempotencyKey() } }); check(response, { "booking is created": successfulBooking }); sleep(0.1); }
