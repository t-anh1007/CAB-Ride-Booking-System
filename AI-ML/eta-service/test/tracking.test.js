'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../src/app');
const etaService = require('../src/eta.service');
const redis = require('../src/infra/redis');

async function startServer(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

test('tracking ETA route returns computed tracking ETA payload', async (t) => {
  const original = etaService.calculateTrackingETA;
  etaService.calculateTrackingETA = async () => ({
    rideId: 'ride-1',
    driverId: 'driver-1',
    segment: 'toPickup',
    driverLocation: { lat: 10.77, lng: 106.7 },
    locationSource: 'redis-driver-location',
    activeRideFound: true,
    pickup: { lat: 10.78, lng: 106.69 },
    destination: { lat: 10.8, lng: 106.68 },
    eta: {
      etaMinutes: 4,
      distanceKm: 1.2,
    },
  });
  t.after(() => {
    etaService.calculateTrackingETA = original;
  });

  const { server, baseUrl } = await startServer(createApp());
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/v1/eta/tracking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rideId: 'ride-1',
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.driverId, 'driver-1');
  assert.equal(payload.data.locationSource, 'redis-driver-location');
  assert.equal(payload.data.eta.etaMinutes, 4);
});

test('tracking ETA route returns 404 when tracked driver location is missing', async (t) => {
  const original = etaService.calculateTrackingETA;
  etaService.calculateTrackingETA = async () => {
    const error = new Error('Tracked driver location not found');
    error.code = 'DRIVER_LOCATION_NOT_FOUND';
    throw error;
  };
  t.after(() => {
    etaService.calculateTrackingETA = original;
  });

  const { server, baseUrl } = await startServer(createApp());
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/v1/eta/tracking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rideId: 'ride-404',
    }),
  });

  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Tracked driver location not found');
});

test('driver location event route processes cached GPS update lane', async (t) => {
  const original = etaService.handleDriverLocationUpdated;
  etaService.handleDriverLocationUpdated = async ({ driverId, rideId, location }) => ({
    driverId,
    rideId,
    location,
    processedAt: '2026-04-23T00:00:00.000Z',
  });
  t.after(() => {
    etaService.handleDriverLocationUpdated = original;
  });

  const { server, baseUrl } = await startServer(createApp());
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/v1/eta/driver-location-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      driverId: 'driver-1',
      rideId: 'ride-1',
      location: { lat: 10.77, lng: 106.7 },
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.driverId, 'driver-1');
  assert.equal(payload.data.rideId, 'ride-1');
});

test('calculateTrackingETA uses cached driver location and active ride snapshot', async (t) => {
  process.env.ROUTING_PROVIDER = 'unknown';

  const originals = {
    getActiveRide: redis.getActiveRide,
    getDriverLocation: redis.getDriverLocation,
    getCachedETA: redis.getCachedETA,
    cacheETA: redis.cacheETA,
    getBiasProfile: redis.getBiasProfile,
  };

  redis.getActiveRide = async () => ({
    rideId: 'ride-1',
    driverId: 'driver-1',
    pickup: { lat: 10.78, lng: 106.69 },
    destination: { lat: 10.8, lng: 106.68 },
  });
  redis.getDriverLocation = async () => ({
    lat: 10.77,
    lng: 106.7,
    updatedAt: '2026-04-23T00:00:00.000Z',
  });
  redis.getCachedETA = async () => null;
  redis.cacheETA = async () => undefined;
  redis.getBiasProfile = async () => null;

  t.after(() => {
    redis.getActiveRide = originals.getActiveRide;
    redis.getDriverLocation = originals.getDriverLocation;
    redis.getCachedETA = originals.getCachedETA;
    redis.cacheETA = originals.cacheETA;
    redis.getBiasProfile = originals.getBiasProfile;
  });

  const result = await etaService.calculateTrackingETA({
    rideId: 'ride-1',
    segment: 'toPickup',
    skipCache: true,
  });

  assert.equal(result.driverId, 'driver-1');
  assert.equal(result.locationSource, 'redis-driver-location');
  assert.equal(result.activeRideFound, true);
  assert.equal(result.segment, 'toPickup');
  assert.equal(typeof result.eta.etaMinutes, 'number');
  assert.equal(typeof result.eta.distanceKm, 'number');
});
