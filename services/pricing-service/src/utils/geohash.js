import ngeohash from 'ngeohash';

const GEOHASH_PRECISION = 5; // ~2.4km — đồng bộ với driver-service

/**
 * Chuyển đổi tọa độ địa lý thành zone ID (chuỗi Geohash).
 * Cả driver-service và pricing-service đều phải dùng cùng precision
 * để đảm bảo cùng tọa độ → cùng zone_id → đếm Supply/Demand nhất quán.
 *
 * @param {number} lat - Vĩ độ
 * @param {number} lng - Kinh độ
 * @returns {string} zone_id, ví dụ: "w3gv2"
 */
export function latLngToZone(lat, lng) {
  return ngeohash.encode(lat, lng, GEOHASH_PRECISION);
}

/**
 * Lưới 3x3 zone (ô trung tâm + 8 ô lân cận) quanh một tọa độ, kèm tâm & bán kính
 * (nửa cạnh ngắn của ô, mét) để vẽ trên bản đồ admin.
 */
export function surgeZoneGrid(lat, lng) {
  const center = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
  return [center, ...ngeohash.neighbors(center)].map((zoneId) => {
    const [minLat, minLng, maxLat, maxLng] = ngeohash.decode_bbox(zoneId);
    const midLat = (minLat + maxLat) / 2;
    const heightM = (maxLat - minLat) * 111_320;
    const widthM = (maxLng - minLng) * 111_320 * Math.cos((midLat * Math.PI) / 180);
    return {
      zoneId,
      center: { lat: midLat, lng: (minLng + maxLng) / 2 },
      radiusM: Math.round(Math.min(heightM, widthM) / 2)
    };
  });
}
