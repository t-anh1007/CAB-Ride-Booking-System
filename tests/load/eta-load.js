import http from "k6/http";
import { check, fail, sleep } from "k6";
const eta = __ENV.ETA_URL || "http://host.docker.internal:3110";
const rideId = __ENV.ETA_RIDE_ID || "load-eta-hot-cache";
const segment = "toDestination";
const payload = { origin: { lat: 10.7769, lng: 106.7009 }, destination: { lat: 10.781, lng: 106.697 }, rideId, segment };
export const options = { vus: 50, duration: "1m", thresholds: { checks: ["rate>0.99"], http_req_duration: ["p(95)<200"], http_req_failed: ["rate<0.05"] } };
function safeJson(response) { try { return response.json(); } catch (_) { return null; } }
function successfulEta(response) { if (response.status !== 200) return false; const body = safeJson(response); return body?.success === true && Number.isFinite(Number(body?.data?.etaMinutes)); }
export function setup() { const response = http.post(eta + "/api/v1/eta/calculate", JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }); if (!check(response, { "ETA warm-up populates cache": successfulEta })) fail("ETA warm-up must succeed"); return payload; }
export default function (warmPayload) { const response = http.post(eta + "/api/v1/eta/calculate", JSON.stringify(warmPayload), { headers: { "Content-Type": "application/json" } }); check(response, { "ETA hot-cache request succeeds": successfulEta }); sleep(0.05); }
