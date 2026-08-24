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
