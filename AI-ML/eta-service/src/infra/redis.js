/**
 * ETA AI Service – Redis Infrastructure
 * ─────────────────────────────────────
 * Shared ioredis client for:
 *   • Caching ETA results  (key: eta:<rideId>:<segment>)
 *   • Storing active rides  (key: ride:active:<rideId>)
 *   • Storing driver locations (key: driver:loc:<driverId>)
 *
 * This module is a SINGLETON – import it anywhere inside the AI layer.
 */

'use strict';

const Redis = require('ioredis');

// ─── Singleton instance ───────────────────────────────────────────────────────
let _client = null;

/**
 * Create / return the shared Redis client.
 * Reads REDIS_URL (or REDIS_HOST / REDIS_PORT / REDIS_PASSWORD) from env.
 *
 * @returns {import('ioredis').Redis}
 */
function getRedisClient() {
  if (_client) return _client;

  const redisUrl = process.env.REDIS_URL;

  const options = {
    // Reconnect up to 10 times with exponential back-off
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null; // stop retrying
      return Math.min(times * 150, 3000);
    },
    enableReadyCheck: true,
    lazyConnect: false,
  };

  if (redisUrl) {
    _client = new Redis(redisUrl, options);
  } else {
    _client = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ...options,
    });
  }

  _client.on('connect', () =>
    console.log('[ETA-Redis] Connected to Redis')
  );
  _client.on('ready', () =>
    console.log('[ETA-Redis] Redis client ready')
  );
  _client.on('error', (err) =>
    console.error('[ETA-Redis] Redis error:', err.message)
  );
  _client.on('close', () =>
    console.warn('[ETA-Redis] Redis connection closed')
  );
  _client.on('reconnecting', () =>
    console.log('[ETA-Redis] Reconnecting to Redis…')
  );

  return _client;
}

// ─── Key Builders ─────────────────────────────────────────────────────────────

/**
 * Redis key for a cached ETA result.
 * @param {string} rideId
 * @param {'toPickup'|'toDestination'} segment
 */
const etaCacheKey = (rideId, segment) => `eta:${rideId}:${segment}`;

/**
 * Redis key for an active ride snapshot.
 * @param {string} rideId
 */
const activeRideKey = (rideId) => `ride:active:${rideId}`;

/**
 * Redis key for a driver's latest location.
 * @param {string} driverId
 */
const driverLocationKey = (driverId) => `driver:loc:${driverId}`;

/**
 * Redis key for an ETA bias profile.
 * @param {string} profileKey
 */
const etaBiasProfileKey = (profileKey) => `eta:bias:profile:${profileKey}`;

// ─── Helper wrappers ──────────────────────────────────────────────────────────

/**
 * Store a JSON object in Redis with a TTL.
 * @param {string} key
 * @param {object} value
 * @param {number} ttlSeconds
 */
async function setJSON(key, value, ttlSeconds) {
  const redis = getRedisClient();
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

/**
 * Retrieve and parse a JSON object from Redis.
 * @param {string} key
 * @returns {object|null}
 */
async function getJSON(key) {
  const redis = getRedisClient();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Delete a key from Redis.
 * @param {string} key
 */
async function del(key) {
  const redis = getRedisClient();
  await redis.del(key);
}

/**
 * Gracefully disconnect the Redis client.
 * Call this on process shutdown.
 */
async function disconnect() {
  if (_client) {
    await _client.quit();
    _client = null;
    console.log('[ETA-Redis] Disconnected');
  }
}

// ─── Active Ride helpers ───────────────────────────────────────────────────────

const RIDE_TTL = parseInt(process.env.DRIVER_LOCATION_TTL_SECONDS || '300', 10);

/**
 * Save an active ride snapshot to Redis.
 * @param {string} rideId
 * @param {object} rideSnapshot  – { rideId, driverId, pickup, destination, status, … }
 */
async function saveActiveRide(rideId, rideSnapshot) {
  await setJSON(activeRideKey(rideId), rideSnapshot, RIDE_TTL);
}

/**
 * Retrieve an active ride snapshot from Redis.
 * @param {string} rideId
 * @returns {object|null}
 */
async function getActiveRide(rideId) {
  return getJSON(activeRideKey(rideId));
}

/**
 * Remove an active ride from Redis (ride completed / cancelled).
 * @param {string} rideId
 */
async function removeActiveRide(rideId) {
  await del(activeRideKey(rideId));
}

// ─── Driver Location helpers ───────────────────────────────────────────────────

const LOC_TTL = parseInt(process.env.DRIVER_LOCATION_TTL_SECONDS || '300', 10);

/**
 * Persist the latest driver GPS location.
 * @param {string} driverId
 * @param {{ lat: number, lng: number, address?: string, updatedAt?: string }} location
 */
async function saveDriverLocation(driverId, location) {
  const payload = {
    ...location,
    updatedAt: location.updatedAt || new Date().toISOString(),
  };
  await setJSON(driverLocationKey(driverId), payload, LOC_TTL);
}

/**
 * Retrieve the latest driver GPS location.
 * @param {string} driverId
 * @returns {{ lat: number, lng: number, address?: string, updatedAt: string }|null}
 */
async function getDriverLocation(driverId) {
  return getJSON(driverLocationKey(driverId));
}

/**
 * Remove a driver location entry (driver goes offline).
 * @param {string} driverId
 */
async function removeDriverLocation(driverId) {
  await del(driverLocationKey(driverId));
}

// ─── ETA Cache helpers ─────────────────────────────────────────────────────────

const ETA_TTL = parseInt(process.env.ETA_CACHE_TTL_SECONDS || '30', 10);

/**
 * Cache an ETA result.
 * @param {string} rideId
 * @param {'toPickup'|'toDestination'} segment
 * @param {object} etaResult  – { etaMinutes, distanceKm, durationSeconds, provider, … }
 */
async function cacheETA(rideId, segment, etaResult) {
  await setJSON(etaCacheKey(rideId, segment), etaResult, ETA_TTL);
}

/**
 * Read a cached ETA result.
 * @param {string} rideId
 * @param {'toPickup'|'toDestination'} segment
 * @returns {object|null}
 */
async function getCachedETA(rideId, segment) {
  return getJSON(etaCacheKey(rideId, segment));
}

/**
 * Invalidate cached ETA entries for a ride (call after location update).
 * @param {string} rideId
 */
async function invalidateETA(rideId) {
  await Promise.all([
    del(etaCacheKey(rideId, 'toPickup')),
    del(etaCacheKey(rideId, 'toDestination')),
  ]);
}

// ─── AI ETA bias profile helpers ────────────────────────────────────────────

const BIAS_PROFILE_TTL = parseInt(process.env.ETA_BIAS_PROFILE_TTL_SECONDS || '86400', 10);

/**
 * Save an ETA bias profile keyed by route/time context.
 * @param {string} profileKey
 * @param {{ biasFactor: number, metadata?: object, updatedAt?: string }} profile
 */
async function saveBiasProfile(profileKey, profile) {
  const payload = {
    ...profile,
    updatedAt: profile.updatedAt || new Date().toISOString(),
  };
  await setJSON(etaBiasProfileKey(profileKey), payload, BIAS_PROFILE_TTL);
}

/**
 * Load an ETA bias profile for contextual AI correction.
 * @param {string} profileKey
 * @returns {Promise<{ biasFactor: number, metadata?: object, updatedAt: string }|null>}
 */
async function getBiasProfile(profileKey) {
  return getJSON(etaBiasProfileKey(profileKey));
}

/**
 * Delete an ETA bias profile.
 * @param {string} profileKey
 */
async function removeBiasProfile(profileKey) {
  await del(etaBiasProfileKey(profileKey));
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Client
  getRedisClient,
  disconnect,

  // Low-level helpers
  setJSON,
  getJSON,
  del,

  // Active rides
  saveActiveRide,
  getActiveRide,
  removeActiveRide,

  // Driver locations
  saveDriverLocation,
  getDriverLocation,
  removeDriverLocation,

  // ETA cache
  cacheETA,
  getCachedETA,
  invalidateETA,

  // ETA bias profiles
  saveBiasProfile,
  getBiasProfile,
  removeBiasProfile,

  // Key builders (exposed for testing / debugging)
  etaCacheKey,
  activeRideKey,
  driverLocationKey,
  etaBiasProfileKey,
};
