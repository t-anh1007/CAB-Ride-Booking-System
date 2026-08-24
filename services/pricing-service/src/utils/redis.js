import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;

/**
 * Lấy (hoặc khởi tạo lần đầu) Redis client theo Singleton pattern.
 */
function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 5) {
          console.warn('[pricing-service/redis] Đã thử kết nối 5 lần thất bại, bỏ qua Redis.');
          return null;
        }
        return Math.min(times * 200, 2000);
      }
    });

    redisClient.on('connect', () => {
      console.info('[pricing-service/redis] ✅ Kết nối Redis thành công!');
    });

    redisClient.on('error', (err) => {
      console.error('[pricing-service/redis] ❌ Lỗi Redis:', err.message);
    });

    redisClient.connect().catch((err) => {
      console.error('[pricing-service/redis] Không thể kết nối Redis khi khởi động:', err.message);
    });
  }
  return redisClient;
}

// ── Quote locking (Tiêu chí 5 — Nhất quán giá estimate→booking) ─────────────

const QUOTE_TTL_SECONDS = 180; // 3 phút — đủ thời gian user xác nhận đặt xe

/**
 * Lưu snapshot giá vào Redis với TTL 180 giây.
 * Sau khi hết TTL, quote tự động hết hạn — user cần lấy giá mới.
 *
 * @param {string} quoteId - UUID duy nhất đại diện cho quote này
 * @param {object} quoteData - { amount, surgeMultiplier, vehicleType, distanceKm, durationMin, ... }
 */
export async function saveQuote(quoteId, quoteData) {
  try {
    const client = getRedisClient();
    const key = `quote:${quoteId}`;
    await client.setex(key, QUOTE_TTL_SECONDS, JSON.stringify(quoteData));
    console.info(`[pricing-service/redis] 💾 Quote saved: quoteId=${quoteId} TTL=${QUOTE_TTL_SECONDS}s`);
  } catch (err) {
    console.error('[pricing-service/redis] saveQuote thất bại:', err.message);
    // Không throw — quote lỗi không nên chặn cả getQuote
  }
}

/**
 * Đọc và XÓA quote khỏi Redis (one-time use).
 * Nếu quote không tồn tại hoặc đã hết hạn → trả về null.
 * Dùng GETDEL để đảm bảo atomic: không thể dùng cùng quote_id 2 lần.
 *
 * @param {string} quoteId
 * @returns {Promise<object|null>} quoteData hoặc null nếu không tìm thấy/hết hạn
 */
export async function getAndConsumeQuote(quoteId) {
  try {
    const client = getRedisClient();
    const key = `quote:${quoteId}`;
    // GETDEL — atomic: GET + DEL trong 1 command (Redis >= 6.2)
    const raw = await client.getdel(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    console.info(`[pricing-service/redis] ✅ Quote consumed: quoteId=${quoteId}`);
    return parsed;
  } catch (err) {
    console.error('[pricing-service/redis] getAndConsumeQuote thất bại:', err.message);
    return null;
  }
}

