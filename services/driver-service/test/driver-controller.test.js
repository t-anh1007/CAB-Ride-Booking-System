import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import express from 'express';
import ngeohash from 'ngeohash';

const drivers = new Map();
const geoWrites = [];
const supplyZones = new Map();
let baseUrl;
let server;

const asDocument = (record) => ({
  ...record,
  toObject() {
    const { toObject: _ignored, ...plain } = this;
    return plain;
  }
});

before(async () => {
  mock.module('../src/models/Driver.js', {
    namedExports: {
      DriverModel: {},
      findDriver: async (driverId) => drivers.get(driverId) ?? null,
      listAvailableDrivers: async () => [...drivers.values()].filter((driver) => (
        driver.status === 'ONLINE' && driver.availability === 'AVAILABLE'
      )),
      upsertDriver: async (driverId, payload) => {
        const next = asDocument({ ...(drivers.get(driverId) ?? { driverId }), ...payload });
        drivers.set(driverId, next);
        return next;
      },
      updateDriverStatus: async (driverId, updates) => {
        const current = drivers.get(driverId);
        if (!current) return null;
        const next = asDocument({ ...current, ...updates });
        drivers.set(driverId, next);
        return next;
      },
      updateDriverLocation: async (driverId, location) => {
        const current = drivers.get(driverId);
        if (!current) return null;
        const next = asDocument({ ...current, location: { ...location } });
        drivers.set(driverId, next);
        return next;
      }
    }
  });
  mock.module('../src/utils/redis.js', {
    namedExports: {
      publishDriverToGeo: async (driverId, lat, lng) => {
        geoWrites.push({ key: 'drivers:geo', driverId, lat, lng });
      },
      publishDriverToZone: async (driverId, lat, lng) => {
        const key = `supply:zone:${ngeohash.encode(lat, lng, 5)}`;
        const members = supplyZones.get(key) ?? new Set();
        members.add(driverId);
        supplyZones.set(key, members);
      },
      removeDriverFromZone: async (driverId, lat, lng) => {
        const key = `supply:zone:${ngeohash.encode(lat, lng, 5)}`;
        supplyZones.get(key)?.delete(driverId);
      }
    }
  });
  mock.module('../src/services/kafka-publisher.js', {
    namedExports: { publishDriverEvent: async () => ({ published: true }) }
  });

  const { default: router } = await import('../src/routes/index.js');
  const app = express();
  app.use(express.json());
  app.use('/drivers', router);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/drivers`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  mock.restoreAll();
});

beforeEach(() => {
  drivers.clear();
  geoWrites.length = 0;
  supplyZones.clear();
  drivers.set('DRIVER-T7-1', asDocument({
    driverId: 'DRIVER-T7-1',
    fullName: 'Driver Test',
    phone: '0900000000',
    vehicleType: 'car',
    vehiclePlate: '51A-00001',
    status: 'OFFLINE',
    availability: 'AVAILABLE',
    location: { lat: 10.7769, lng: 106.7009, address: 'Initial' }
  }));
});

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

test('[TC5] go-online returns ONLINE and writes geo plus supply state', async () => {
  const response = await request('POST', '/DRIVER-T7-1/go-online');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'ONLINE');
  assert.equal(response.body.data.availability, 'AVAILABLE');
  assert.deepEqual(geoWrites, [{
    key: 'drivers:geo',
    driverId: 'DRIVER-T7-1',
    lat: 10.7769,
    lng: 106.7009
  }]);
  assert.ok([...supplyZones.values()].some((members) => members.has('DRIVER-T7-1')));
});

test('[TC13, TC57] offline driver is removed from supply and absent from availability', async () => {
  await request('POST', '/DRIVER-T7-1/go-online');
  const offline = await request('POST', '/DRIVER-T7-1/go-offline');
  const available = await request('GET', '/available');

  assert.equal(offline.status, 200);
  assert.equal(offline.body.data.status, 'OFFLINE');
  assert.equal(available.status, 200);
  assert.deepEqual(available.body.data.drivers, []);
  assert.ok([...supplyZones.values()].every((members) => !members.has('DRIVER-T7-1')));
});

test('[TC23] online location update refreshes the corresponding supply zone', async () => {
  drivers.set('DRIVER-T7-1', asDocument({
    ...drivers.get('DRIVER-T7-1'),
    status: 'ONLINE'
  }));
  const location = { lat: 10.782, lng: 106.695, address: 'Updated' };

  const response = await request('PATCH', '/DRIVER-T7-1/location', location);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.location, location);
  const key = `supply:zone:${ngeohash.encode(location.lat, location.lng, 5)}`;
  assert.ok(supplyZones.get(key)?.has('DRIVER-T7-1'));
});
