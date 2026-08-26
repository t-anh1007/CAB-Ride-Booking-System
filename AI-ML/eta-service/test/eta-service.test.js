'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

process.env.OSRM_BASE_URL = 'http://127.0.0.1:1';
const config = require('../src/eta.config');
const { getRoute } = require('../src/providers/routing.providers');

test('ETA config uses OSRM then Haversine defaults', () => {
  assert.deepEqual(config.routingProviders, ['osrm', 'haversine']);
  assert.equal(config.fallbackAvgSpeedKmh, 28);
  assert.equal(config.maxDistanceKm, 500);
});

test('identical coordinates have zero ETA through deterministic fallback', async () => {
  const route = await getRoute({ lat: 10.76, lng: 106.66 }, { lat: 10.76, lng: 106.66 });
  assert.equal(route.provider, 'haversine');
  assert.equal(route.durationSeconds, 0);
  assert.equal(route.distanceMeters, 0);
});

test('failed OSRM falls back to Haversine at the configured city speed', async () => {
  const route = await getRoute({ lat: 0, lng: 0 }, { lat: 0, lng: 0.045 });
  assert.equal(route.provider, 'haversine');
  assert.ok(route.durationSeconds > 0 && route.durationSeconds < 60 * 60);
});

test('outlier routes are clamped at 500km', async () => {
  const route = await getRoute({ lat: 0, lng: 0 }, { lat: 10, lng: 0 });
  assert.equal(route.provider, 'haversine');
  assert.equal(route.clamped, true);
  assert.equal(route.distanceMeters, 500000);
});

test('ETA routing source contains no Google or Mapbox references', () => {
  const source = fs.readFileSync(require.resolve('../src/providers/routing.providers'), 'utf8').toLowerCase();
  assert.equal(source.includes('google'), false);
  assert.equal(source.includes('mapbox'), false);
});
