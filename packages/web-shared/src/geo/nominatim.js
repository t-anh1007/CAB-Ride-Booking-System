let serial = Promise.resolve();
let nextAt = 0;

const offlineDestinations = [
  { label: "Hồ Hoàn Kiếm, Hoàn Kiếm, Hà Nội", lat: 21.028511, lng: 105.85299 },
  { label: "Sân bay quốc tế Tân Sơn Nhất, Tân Bình, Hồ Chí Minh", lat: 10.818799, lng: 106.651856 },
  { label: "Chợ Bến Thành, Quận 1, Hồ Chí Minh", lat: 10.772543, lng: 106.698084 },
  { label: "Đại học Bách khoa Hà Nội, Hai Bà Trưng, Hà Nội", lat: 21.005517, lng: 105.843098 }
];

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function fallbackDestinations(query) {
  const normalizedQuery = normalizeSearchText(query);
  const matches = offlineDestinations.filter((destination) =>
    normalizeSearchText(destination.label).includes(normalizedQuery)
  );

  return matches.length > 0 ? matches : offlineDestinations;
}

export function searchAddress(query, {
  fetchImpl = fetch,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  const task = async () => {
    const delay = Math.max(0, nextAt - now());
    if (delay) await sleep(delay);
    nextAt = now() + 1000;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
      const response = await fetchImpl(url, { headers: { "User-Agent": "CAB-Booking-System/1.0" } });
      if (!response.ok) throw new Error(`Nominatim search failed: ${response.status}`);

      const rows = await response.json();
      return rows.map((row) => ({ label: row.display_name, lat: Number(row.lat), lng: Number(row.lon) }));
    } catch {
      return fallbackDestinations(query);
    }
  };

  const result = serial.then(task, task);
  serial = result.catch(() => {});
  return result;
}

export async function reverseGeocode(lat, lng, { fetchImpl = fetch } = {}) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const response = await fetchImpl(url, { headers: { "User-Agent": "CAB-Booking-System/1.0" } });
    if (!response.ok) return null;
    const row = await response.json();
    return row.display_name || null;
  } catch {
    return null;
  }
}
