/**
 * ETA Service client for ride-service.
 * ride-service stays independent and delegates ETA computation over REST.
 */

'use strict';

import { createMtlsFetch } from '../../../../platform/node/mtls-client.cjs';

const ETA_SERVICE_URL = (process.env.ETA_SERVICE_URL || 'http://eta-service:3110').replace(/\/$/, '');
const ETA_TIMEOUT_MS = Math.max(Number(process.env.ETA_SERVICE_TIMEOUT_MS || 2500), 500);
const AVG_DRIVER_SPEED_KMH = Math.max(Number(process.env.AVG_DRIVER_SPEED || 30), 1);
const etaFetch = createMtlsFetch({ env: process.env, prefix: 'INTERNAL_TLS' });

function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(lat2 - lat1);
  const lonDelta = toRadians(lon2 - lon1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.sin(lonDelta / 2) ** 2 * Math.cos(startLat) * Math.cos(endLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function haversineEtaMinutes(from, to, avgSpeedKmh = AVG_DRIVER_SPEED_KMH) {
  if (!from || !to) {
    return null;
  }

  try {
    const distanceKm = calculateDistance(from.lat, from.lng, to.lat, to.lng);
    if (distanceKm <= 0) {
      return 0;
    }
    return Math.max(1, Math.ceil((distanceKm / avgSpeedKmh) * 60));
  } catch {
    return null;
  }
}

async function postEta(pathname, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ETA_TIMEOUT_MS);

  try {
    const response = await etaFetch(`${ETA_SERVICE_URL}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ETA service responded ${response.status}`);
    }

    const body = await response.json();
    if (!body?.success) {
      throw new Error(body?.message || 'ETA service returned unsuccessful response');
    }

    return body.data ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

async function calculateETA(currentLocation, destination, opts = {}) {
  if (!currentLocation || !destination) {
    return null;
  }

  try {
    const result = await postEta('/api/v1/eta/calculate', {
      origin: currentLocation,
      destination,
      rideId: opts.rideId || null,
      segment: opts.segment || 'toDestination',
      skipCache: Boolean(opts.skipCache),
    });

    return result?.etaMinutes ?? null;
  } catch (error) {
    console.warn(`[ride-service/eta] ETA service unavailable, using fallback: ${error.message}`);
    return haversineEtaMinutes(currentLocation, destination);
  }
}

async function calculatePickupETA(currentLocation, pickup, opts = {}) {
  if (!currentLocation || !pickup) {
    return {
      etaToPickup: null,
      distanceToPickup: null,
    };
  }

  try {
    const result = await postEta('/api/v1/eta/pickup', {
      driverLocation: currentLocation,
      pickup,
      rideId: opts.rideId || null,
      skipCache: Boolean(opts.skipCache),
    });

    return {
      etaToPickup: result?.etaMinutes ?? null,
      distanceToPickup: result?.distanceKm ?? null,
    };
  } catch (error) {
    console.warn(`[ride-service/eta] pickup ETA fallback: ${error.message}`);
    const distanceKm = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      pickup.lat,
      pickup.lng
    );
    return {
      etaToPickup: haversineEtaMinutes(currentLocation, pickup),
      distanceToPickup: parseFloat(distanceKm.toFixed(2)),
    };
  }
}

async function calculateRideEstimates(currentLocation, pickup, destination, opts = {}) {
  if (!currentLocation || !pickup || !destination) {
    return {
      etaToPickup: null,
      etaToDestination: null,
      totalDistance: null,
      distanceToPickup: null,
      distanceToDestination: null,
    };
  }

  try {
    const result = await postEta('/api/v1/eta/ride-estimates', {
      driverLocation: currentLocation,
      pickup,
      destination,
      rideId: opts.rideId || null,
      skipCache: Boolean(opts.skipCache),
    });

    return {
      etaToPickup: result?.toPickup?.etaMinutes ?? null,
      etaToDestination: result?.toDestination?.etaMinutes ?? null,
      totalDistance: result?.totalDistanceKm ?? null,
      distanceToPickup: result?.toPickup?.distanceKm ?? null,
      distanceToDestination: result?.toDestination?.distanceKm ?? null,
    };
  } catch (error) {
    console.warn(`[ride-service/eta] ride estimate fallback: ${error.message}`);
    const distanceToPickup = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      pickup.lat,
      pickup.lng
    );
    const distanceToDestination = calculateDistance(
      pickup.lat,
      pickup.lng,
      destination.lat,
      destination.lng
    );

    return {
      etaToPickup: haversineEtaMinutes(currentLocation, pickup),
      etaToDestination: haversineEtaMinutes(pickup, destination),
      totalDistance: parseFloat((distanceToPickup + distanceToDestination).toFixed(2)),
      distanceToPickup: parseFloat(distanceToPickup.toFixed(2)),
      distanceToDestination: parseFloat(distanceToDestination.toFixed(2)),
    };
  }
}

export {
  calculateDistance,
  calculateETA,
  calculatePickupETA,
  calculateRideEstimates,
};
