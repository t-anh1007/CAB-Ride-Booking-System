import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("k6 scenarios use safe strict-success checks and current local contracts", async () => {
  const [booking, eta, pricing, readme, ignore] = await Promise.all([
    source("./booking-load.js"), source("./eta-load.js"), source("./spike-pricing.js"), source("./README.md"), source("../../.gitignore")
  ]);
  assert.doesNotMatch(booking, /randomUUID|jslib\.k6\.io/); assert.match(booking, /localIdempotencyKey/); assert.match(booking, /__VU/); assert.match(booking, /__ITER/); assert.match(booking, /Math\.random/);
  assert.match(booking, /TEST_JWT/); assert.match(booking, /TEST_USER_ID/); assert.match(booking, /userId/); assert.match(booking, /vehicleType:\s*["']car/); assert.match(booking, /Idempotency-Key/); assert.match(booking, /safeJson/); assert.match(booking, /if \(response\.status !== 201\) return false;/); assert.match(booking, /data\?\.booking_id/); assert.doesNotMatch(booking, /\[201,\s*400/);
  assert.match(booking, /duration:\s*["']30s["']\s*,\s*target:\s*10/); assert.match(booking, /duration:\s*["']90s["']\s*,\s*target:\s*100/); assert.match(booking, /checks:\s*\[\s*["']rate>0\.99/); assert.match(booking, /p\(95\).*300/);
  for (const [name, sourceText] of [["eta", eta], ["pricing", pricing]]) { assert.match(sourceText, /safeJson/); assert.match(sourceText, /if \(response\.status !== 200\) return false;/, name); assert.match(sourceText, /checks:\s*\[\s*["']rate>0\.99/, name); }
  assert.match(eta, /rideId/); assert.match(eta, /segment/); assert.match(eta, /export function setup/); assert.match(eta, /data\?\.etaMinutes/); assert.match(eta, /p\(95\).*200/);
  assert.match(pricing, /pickupAddress/); assert.match(pricing, /destinationAddress/); assert.match(pricing, /vehicleType:\s*["']standard/); assert.match(pricing, /data\?\.priceSnapshot\?\.surgeMultiplier/); assert.doesNotMatch(pricing, /\?\?\s*1/); assert.doesNotMatch(pricing, /p\(95\).*300/);
  assert.match(pricing, /duration:\s*["']1s["']\s*,\s*target:\s*5/); assert.match(pricing, /duration:\s*["']10s["']\s*,\s*target:\s*80/); assert.match(pricing, /surgeMultiplier >= 1/); assert.match(pricing, /surgeMultiplier <= 3/);
  assert.match(readme, /TEST_USER_ID/); assert.match(readme, /GATEWAY_LOAD_TEST_MODE/); assert.match(readme, /production/); assert.match(readme, /REQUESTED/); assert.match(readme, /ride-service/); assert.match(readme, /1\.47s/); assert.match(ignore, /tests\/load\/results\/\*/);
});
