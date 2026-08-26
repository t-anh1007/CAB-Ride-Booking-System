import http from "k6/http";
import { check, sleep } from "k6";
const pricing = __ENV.PRICING_URL || "http://host.docker.internal:3101";
const payload = { pickupAddress: "Load test pickup", destinationAddress: "Load test destination", pickupLat: 10.7769, pickupLng: 106.7009, dropLat: 10.781, dropLng: 106.697, vehicleType: "standard", distanceKm: 2, durationMin: 8 };
export const options = { stages: [{ duration: "1s", target: 5 }, { duration: "10s", target: 80 }, { duration: "20s", target: 80 }, { duration: "10s", target: 0 }], thresholds: { checks: ["rate>0.99"], http_req_failed: ["rate<0.05"] } };
function safeJson(response) { try { return response.json(); } catch (_) { return null; } }
function successfulPrice(response) { if (response.status !== 200) return false; const body = safeJson(response); const surgeMultiplier = Number(body?.data?.priceSnapshot?.surgeMultiplier); return body?.success === true && Number.isFinite(surgeMultiplier) && surgeMultiplier >= 1 && surgeMultiplier <= 3; }
export default function () { const response = http.post(pricing + "/api/v1/pricing/quote", JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }); check(response, { "pricing returns bounded surge": successfulPrice }); sleep(0.05); }
