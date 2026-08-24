import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;

/**
 * Singleton Redis client cho booking-service.
 */
function getRedisClient() {
    if (!redisClient) {
        redisClient = new Redis(REDIS_URL, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            connectTimeout: 5000,
            retryStrategy(times) {
                if (times > 5) {
                    console.warn('[booking-service/redis] Đã thử kết nối 5 lần thất bại, bỏ qua Redis.');
                    return null;
                }
                return Math.min(times * 200, 2000);
            }
        });

        redisClient.on('connect', () => {
            console.info('[booking-service/redis] ✅ Kết nối Redis thành công!');
        });

        redisClient.on('error', (err) => {
            console.error('[booking-service/redis] ❌ Lỗi Redis:', err.message);
        });

        redisClient.connect().catch((err) => {
            console.error('[booking-service/redis] Không thể kết nối Redis khi khởi động:', err.message);
        });
    }
    return redisClient;
}

/**
 * [Tiêu chí 5] Đọc và XÓA quote khỏi Redis (one-time use).
 * Sử dụng GETDEL để đảm bảo tính nguyên tử — không thể dùng cùng quoteId 2 lần.
 *
 * Nếu quote không tồn tại hoặc đã hết hạn (TTL = 0) → trả null
 * → booking-service sẽ reject với 409 "Giá đã hết hạn"
 *
 * @param {string} quoteId
 * @returns {Promise<object|null>}
 */
export async function getAndConsumeQuote(quoteId) {
    try {
        const client = getRedisClient();
        const key = `quote:${quoteId}`;
        // GETDEL — Redis >= 6.2, atomic GET + DEL
        const raw = await client.getdel(key);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        console.info(`[booking-service/redis] ✅ Quote consumed: quoteId=${quoteId} amount=${parsed.amount}`);
        return parsed;
    } catch (err) {
        console.error('[booking-service/redis] getAndConsumeQuote thất bại:', err.message);
        return null;
    }
}
