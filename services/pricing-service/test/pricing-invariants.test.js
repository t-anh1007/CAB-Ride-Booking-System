import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, mock, test } from 'node:test';

let delayMs = 0;
let evaluateSurge;
let getQuote;
let PricingRule;
let server;
let surgeReply;

before(async () => {
  server = http.createServer((_request, response) => {
    const timer = setTimeout(() => {
      if (response.destroyed) return;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(surgeReply));
    }, delayMs);
    response.on('close', () => clearTimeout(timer));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.SURGE_PRICING_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SURGE_PRICING_TIMEOUT_MS = '20';

  mock.module('../src/utils/redis.js', {
    namedExports: {
      saveQuote: async () => true,
      getAndConsumeQuote: async () => null
    }
  });
  ({ evaluateSurge } = await import('../src/utils/surge-service.js'));
  ({ getQuote } = await import('../src/controllers/pricingController.js'));
  ({ default: PricingRule } = await import('../src/models/PricingRule.js'));
  mock.method(PricingRule, 'findOne', async () => ({
    vehicleType: 'standard',
    baseFare: 20000,
    perKm: 10000,
    perMinute: 2000
  }));
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  mock.restoreAll();
});

beforeEach(() => {
  delayMs = 0;
  surgeReply = {
    available: true,
    supplyCount: 1,
    demandCount: 0,
    surgeMultiplier: 1,
    surgeSource: 'ai-xgboost'
  };
});

test('[TC16] zero demand never produces a multiplier below one', async () => {
  surgeReply.surgeMultiplier = 0.4;

  const result = await evaluateSurge({ zoneId: 'w3gv2', requestId: 'REQ-FLOOR' });

  assert.equal(result.supplyCount, 1);
  assert.equal(result.demandCount, 0);
  assert.equal(result.surgeMultiplier, 1);
});

test('[TC42] demand pressure raises surge while the multiplier remains capped at three', async () => {
  surgeReply.demandCount = 2;
  surgeReply.surgeMultiplier = 4.5;

  const result = await evaluateSurge({ zoneId: 'w3gv2', requestId: 'REQ-CAP' });

  assert.ok(result.surgeMultiplier > 1);
  assert.equal(result.surgeMultiplier, 3);
});

test('[TC8] quote amount is positive and at least the configured base fare', async () => {
  surgeReply.surgeMultiplier = 1.2;
  const req = {
    headers: { 'x-request-id': 'REQ-QUOTE' },
    body: {
      pickupLat: 10.7769,
      pickupLng: 106.7009,
      dropLat: 10.782,
      dropLng: 106.695,
      distanceKm: 5,
      durationMin: 10,
      vehicleType: 'standard'
    }
  };
  const res = responseRecorder();

  await getQuote(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.ok(res.payload.data.priceSnapshot.amount > 0);
  assert.ok(res.payload.data.priceSnapshot.amount >= 20000);
});

test('[TC30, TC63, TC72] surge timeout returns a valid formula fallback quote', async () => {
  delayMs = 80;
  surgeReply = {
    available: true,
    supplyCount: 1,
    demandCount: 2,
    surgeMultiplier: 2,
    surgeSource: 'ai-xgboost'
  };
  const req = {
    headers: { 'x-request-id': 'REQ-FALLBACK' },
    body: {
      pickupLat: 10.7769,
      pickupLng: 106.7009,
      dropLat: 10.782,
      dropLng: 106.695,
      distanceKm: 5,
      durationMin: 10,
      vehicleType: 'standard'
    }
  };
  const res = responseRecorder();

  await getQuote(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.priceSnapshot.metrics.surgeSource, 'formula-fallback');
  assert.ok(res.payload.data.priceSnapshot.surgeMultiplier >= 1);
  assert.ok(res.payload.data.priceSnapshot.surgeMultiplier <= 3);
});

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}
