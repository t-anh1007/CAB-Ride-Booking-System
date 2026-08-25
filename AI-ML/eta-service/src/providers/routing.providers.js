'use strict';

const axios = require('axios');
const config = require('../eta.config');

function haversineKm(lat1, lng1, lat2, lng2) {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return radiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function haversineResult(origin, destination) {
  const rawDistanceKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const distanceKm = Math.min(rawDistanceKm, config.maxDistanceKm);

  return {
    durationSeconds: Math.round((distanceKm / config.fallbackAvgSpeedKmh) * 3600),
    distanceMeters: Math.round(distanceKm * 1000),
    provider: 'haversine',
    clamped: rawDistanceKm > config.maxDistanceKm,
  };
}

async function osrmGetRoute(origin, destination) {
  const baseUrl = config.osrmBaseUrl.replace(/\/$/, '');
  const coordinates = origin.lng + ',' + origin.lat + ';' + destination.lng + ',' + destination.lat;
  const { data } = await axios.get(baseUrl + '/route/v1/driving/' + coordinates, {
    params: { overview: 'false', steps: 'false' },
    timeout: config.osrmTimeoutMs,
  });

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('OSRM error: ' + (data.code || 'no routes'));
  }

  const route = data.routes[0];
  if (route.distance / 1000 > config.maxDistanceKm) {
    return { ...haversineResult(origin, destination), clamped: true };
  }

  return {
    durationSeconds: Math.round(route.duration),
    distanceMeters: Math.round(route.distance),
    provider: 'osrm',
    clamped: false,
  };
}

async function getRoute(origin, destination) {
  if (origin.lat === destination.lat && origin.lng === destination.lng) {
    return haversineResult(origin, destination);
  }

  try {
    return await osrmGetRoute(origin, destination);
  } catch {
    return haversineResult(origin, destination);
  }
}

module.exports = { getRoute, osrmGetRoute, haversineKm, haversineResult };
