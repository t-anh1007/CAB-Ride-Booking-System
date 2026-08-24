/**
 * ETA AI Service – Routing Providers
 * ────────────────────────────────────
 * Strategy pattern: each provider exports the same interface:
 *
 *   getRoute(origin, destination) → Promise<RouteResult>
 *
 * RouteResult shape:
 * {
 *   durationSeconds: number,   // travel time in seconds
 *   distanceMeters:  number,   // route distance in metres
 *   provider:        string,   // name of the provider used
 *   raw?:            object,   // raw API response (debugging)
 * }
 *
 * Providers implemented:
 *   - osrm          (self-hosted OSRM – default, free)
 *   - graphhopper   (self-hosted or cloud GraphHopper)
 *   - googlemaps    (Google Maps Distance Matrix API)
 *   - mapbox        (Mapbox Directions API)
 *
 * The factory function at the bottom selects the provider via
 * the ROUTING_PROVIDER environment variable.
 */

'use strict';

const axios = require('axios');

// ─── Shared HTTP timeout ───────────────────────────────────────────────────────
const HTTP_TIMEOUT_MS = 5_000;

// ─── Haversine fallback ───────────────────────────────────────────────────────
/**
 * Straight-line distance between two coordinates (km).
 * Used as absolute last resort when all providers fail.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fallbackResult(origin, destination, reason) {
  const avgSpeedKmh = parseFloat(process.env.FALLBACK_AVG_SPEED_KMH || '30');
  const distanceKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const durationSeconds = Math.round((distanceKm / avgSpeedKmh) * 3600);
  console.warn(`[ETA-Routing] Using haversine fallback – ${reason}`);
  return {
    durationSeconds,
    distanceMeters: Math.round(distanceKm * 1000),
    provider: 'haversine-fallback',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider 1: OSRM  (Open Source Routing Machine)
// Default public demo: http://router.project-osrm.org
// Self-host: https://github.com/Project-OSRM/osrm-backend
// ═══════════════════════════════════════════════════════════════════════════════
async function osrmGetRoute(origin, destination) {
  const baseUrl = (process.env.OSRM_BASE_URL || 'http://router.project-osrm.org').replace(/\/$/, '');
  // OSRM expects coordinates as lng,lat
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${baseUrl}/route/v1/driving/${coords}`;

  const { data } = await axios.get(url, {
    params: { overview: 'false', steps: 'false' },
    timeout: HTTP_TIMEOUT_MS,
  });

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM error: ${data.code || 'no routes'}`);
  }

  const route = data.routes[0];
  return {
    durationSeconds: Math.round(route.duration),
    distanceMeters: Math.round(route.distance),
    provider: 'osrm',
    raw: data,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider 2: GraphHopper
// Self-host: https://github.com/graphhopper/graphhopper
// Cloud:     https://www.graphhopper.com/
// ═══════════════════════════════════════════════════════════════════════════════
async function graphhopperGetRoute(origin, destination) {
  const baseUrl = (process.env.GRAPHHOPPER_BASE_URL || 'https://graphhopper.com/api/1').replace(/\/$/, '');
  const apiKey = process.env.GRAPHHOPPER_API_KEY;

  const params = {
    point: [`${origin.lat},${origin.lng}`, `${destination.lat},${destination.lng}`],
    vehicle: 'car',
    locale: 'en',
    instructions: false,
    calc_points: false,
    ...(apiKey ? { key: apiKey } : {}),
  };

  const { data } = await axios.get(`${baseUrl}/route`, {
    params,
    // axios encodes arrays as point=...&point=... which GraphHopper expects
    paramsSerializer: (p) =>
      Object.entries(p)
        .flatMap(([k, v]) =>
          Array.isArray(v) ? v.map((val) => `${k}=${encodeURIComponent(val)}`) : [`${k}=${encodeURIComponent(v)}`]
        )
        .join('&'),
    timeout: HTTP_TIMEOUT_MS,
  });

  if (!data.paths?.length) {
    throw new Error('GraphHopper: no paths returned');
  }

  const path = data.paths[0];
  return {
    // GraphHopper returns time in milliseconds
    durationSeconds: Math.round(path.time / 1000),
    distanceMeters: Math.round(path.distance),
    provider: 'graphhopper',
    raw: data,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider 3: Google Maps Distance Matrix API
// Docs: https://developers.google.com/maps/documentation/distance-matrix
// ═══════════════════════════════════════════════════════════════════════════════
async function googleMapsGetRoute(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set');

  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  const origins = `${origin.lat},${origin.lng}`;
  const destinations = `${destination.lat},${destination.lng}`;

  const { data } = await axios.get(url, {
    params: {
      origins,
      destinations,
      mode: 'driving',
      departure_time: 'now',   // enables traffic-aware duration
      key: apiKey,
    },
    timeout: HTTP_TIMEOUT_MS,
  });

  if (data.status !== 'OK') {
    throw new Error(`Google Maps error: ${data.status}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error(`Google Maps element error: ${element?.status || 'unknown'}`);
  }

  // Prefer duration_in_traffic (real-time) when available
  const durationSeconds =
    element.duration_in_traffic?.value ?? element.duration?.value;

  return {
    durationSeconds: Math.round(durationSeconds),
    distanceMeters: element.distance.value,
    provider: 'googlemaps',
    raw: data,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider 4: Mapbox Directions API
// Docs: https://docs.mapbox.com/api/navigation/directions/
// ═══════════════════════════════════════════════════════════════════════════════
async function mapboxGetRoute(origin, destination) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) throw new Error('MAPBOX_ACCESS_TOKEN is not set');

  // Mapbox expects lng,lat order
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}`;

  const { data } = await axios.get(url, {
    params: {
      access_token: token,
      geometries: 'geojson',
      overview: 'false',
      annotations: 'duration',
    },
    timeout: HTTP_TIMEOUT_MS,
  });

  if (!data.routes?.length) {
    throw new Error('Mapbox: no routes returned');
  }

  const route = data.routes[0];
  return {
    durationSeconds: Math.round(route.duration),
    distanceMeters: Math.round(route.distance),
    provider: 'mapbox',
    raw: data,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory – selects provider from ROUTING_PROVIDER env variable
// Falls back gracefully to haversine if provider call throws.
// ═══════════════════════════════════════════════════════════════════════════════

const PROVIDERS = {
  osrm: osrmGetRoute,
  graphhopper: graphhopperGetRoute,
  googlemaps: googleMapsGetRoute,
  mapbox: mapboxGetRoute,
};

/**
 * Get route info between two coordinates.
 * Tries the configured provider, falls back to haversine on failure.
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<{ durationSeconds: number, distanceMeters: number, provider: string, raw?: object }>}
 */
async function getRoute(origin, destination) {
  const providerName = (process.env.ROUTING_PROVIDER || 'osrm').toLowerCase();
  const providerFn = PROVIDERS[providerName];

  if (!providerFn) {
    console.warn(`[ETA-Routing] Unknown provider "${providerName}", falling back to haversine`);
    return fallbackResult(origin, destination, `unknown provider: ${providerName}`);
  }

  try {
    const result = await providerFn(origin, destination);
    console.log(
      `[ETA-Routing] ${result.provider}: ${result.durationSeconds}s / ${(result.distanceMeters / 1000).toFixed(2)}km`
    );
    return result;
  } catch (err) {
    console.error(`[ETA-Routing] Provider "${providerName}" failed:`, err.message);
    return fallbackResult(origin, destination, err.message);
  }
}

module.exports = {
  getRoute,
  // Individual providers exposed for unit-testing
  osrmGetRoute,
  graphhopperGetRoute,
  googleMapsGetRoute,
  mapboxGetRoute,
  haversineKm,
};
