function haversineDistanceKm([fromLat, fromLng], [toLat, toLng]) {
  const radians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(toLat - fromLat);
  const longitudeDelta = radians(toLng - fromLng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchRoute(from, to, { fetchImpl = fetch } = {}) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`OSRM route failed: ${response.status}`);

    const json = await response.json();
    const route = json.routes?.[0];
    if (!route) throw new Error("OSRM route missing");

    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      fallback: false
    };
  } catch {
    const distanceKm = Math.max(0.1, Number(haversineDistanceKm(from, to).toFixed(2)));
    return {
      distanceKm,
      durationMin: Math.max(1, Math.ceil((distanceKm / 25) * 60)),
      geometry: [from, to],
      fallback: true
    };
  }
}
