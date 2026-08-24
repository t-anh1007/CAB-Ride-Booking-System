import Redis from 'ioredis';
import ngeohash from 'ngeohash';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const GEOHASH_PRECISION = 5; // ~2.4km radius per cell
const SUPPLY_TTL_SECONDS = 120; // 2 phút — tài xế tắt app sau 2 phút tự bị xóa

let redisClient = null;

/**
 * Lấy (hoặc khởi tạo lần đầu) Redis client theo Singleton pattern.
 * Sử dụng lazyConnect để không crash toàn bộ service khi Redis gặp sự cố.
 */
function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 5) {
          console.warn('[driver-service/redis] Đã thử kết nối 5 lần thất bại, bỏ qua Redis.');
          return null; // Dừng retry
        }
        return Math.min(times * 200, 2000);
      }
    });

    redisClient.on('connect', () => {
      console.log('[driver-service/redis] ✅ Kết nối Redis thành công!');
    });

    redisClient.on('error', (err) => {
      console.error('[driver-service/redis] ❌ Lỗi Redis:', err.message);
    });

    redisClient.connect().catch((err) => {
      console.error('[driver-service/redis] Không thể kết nối Redis khi khởi động:', err.message);
    });
  }
  return redisClient;
}

/**
 * Khi một tài xế cập nhật vị trí:
 * - Mã hóa tọa độ thành zone_id (Geohash)
 * - Thêm driverId vào Redis Set của zone đó
 * - Gia hạn TTL để tránh key bị xóa khi tài xế còn đang active
 *
 * @param {string} driverId
 * @param {number} lat
 * @param {number} lng
 */
export async function publishDriverToZone(driverId, lat, lng) {
  console.log(`[DEBUG] Calling publishDriverToZone for ${driverId} at ${lat}, ${lng}`);
  try {
    const client = getRedisClient();
    const zone = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
    const key = `supply:zone:${zone}`;

    await client.sadd(key, driverId);
    await client.expire(key, SUPPLY_TTL_SECONDS);

    console.log(`[driver-service/redis] Supply: Driver ${driverId} → zone ${zone} (${await client.scard(key)} tài xế)`);
  } catch (err) {
    // Lỗi Redis không được làm crash luồng chính
    console.error('[driver-service/redis] publishDriverToZone thất bại:', err.message);
  }
}

/**
 * Khi tài xế goOffline: xóa khỏi tất cả các zone mà họ đang có mặt.
 * Vì tài xế chỉ có 1 vị trí tại 1 thời điểm, chúng ta cần zone hiện tại của họ.
 *
 * @param {string} driverId
 * @param {number} lat
 * @param {number} lng
 */
export async function removeDriverFromZone(driverId, lat, lng) {
  try {
    if (lat == null || lng == null) return; // Chưa có vị trí, bỏ qua

    const client = getRedisClient();
    const zone = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
    const key = `supply:zone:${zone}`;

    await client.srem(key, driverId);
    console.log(`[driver-service/redis] Supply: Driver ${driverId} đã xóa khỏi zone ${zone}`);
  } catch (err) {
    console.error('[driver-service/redis] removeDriverFromZone thất bại:', err.message);
  }
}

/**
 * [NHIỆM VỤ 1] Lưu tọa độ Driver bằng GEOADD
 */
export async function publishDriverToGeo(driverId, lat, lng) {
  try {
    if (lat == null || lng == null) return;
    const client = getRedisClient();
    const key = 'drivers:geo';
    // GEOADD key longitude latitude member
    await client.geoadd(key, lng, lat, driverId);
    console.log(`[driver-service/redis] GEOADD: Driver ${driverId} -> [${lng}, ${lat}]`);
  } catch (err) {
    console.error('[driver-service/redis] GEOADD failed:', err.message);
  }
}
