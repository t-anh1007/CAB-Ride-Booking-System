const Redis = require('ioredis');

let sharedRedisClient = null;
const redisKeyConfig = {
    rateLimitPrefix: 'ratelimit:auth',
    revokedSessionPrefix: 'session:revoked',
};

function createRedisClient(env) {
    return new Redis({
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password || undefined,
        db: env.redis.db,
        keyPrefix: env.redis.keyPrefix,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
    });
}

function getRedisClient(env) {
    if (!sharedRedisClient) {
        sharedRedisClient = createRedisClient(env);
    }

    return sharedRedisClient;
}

async function checkRedisHealth(client) {
    const response = await client.ping();
    if (response !== 'PONG') {
        throw new Error('Unexpected Redis PING response');
    }
    return { status: 'ok' };
}

function configureRedisKeyConventions(overrides = {}) {
    if (typeof overrides.rateLimitPrefix === 'string' && overrides.rateLimitPrefix.trim()) {
        redisKeyConfig.rateLimitPrefix = overrides.rateLimitPrefix.trim();
    }
    if (typeof overrides.revokedSessionPrefix === 'string' && overrides.revokedSessionPrefix.trim()) {
        redisKeyConfig.revokedSessionPrefix = overrides.revokedSessionPrefix.trim();
    }
}

function normalizeKeyPart(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function buildOtpChallengeKey({ role, destination }) {
    return `otp:challenge:${normalizeKeyPart(role)}:${normalizeKeyPart(destination)}`;
}

function buildOtpCooldownKey({ role, destination }) {
    return `otp:cooldown:${normalizeKeyPart(role)}:${normalizeKeyPart(destination)}`;
}

function buildOtpAttemptsKey({ role, destination }) {
    return `otp:attempts:${normalizeKeyPart(role)}:${normalizeKeyPart(destination)}`;
}

function buildOtpLockKey({ role, destination }) {
    return `otp:lock:${normalizeKeyPart(role)}:${normalizeKeyPart(destination)}`;
}

function buildRevokedSessionKey(sessionId) {
    return `${redisKeyConfig.revokedSessionPrefix}:${normalizeKeyPart(sessionId)}`;
}

function buildRateLimitKey({ action, subject }) {
    return `${redisKeyConfig.rateLimitPrefix}:${normalizeKeyPart(action)}:${normalizeKeyPart(subject)}`;
}

async function closeRedisClient() {
    if (!sharedRedisClient) {
        return;
    }

    await sharedRedisClient.quit();
    sharedRedisClient = null;
}

module.exports = {
    createRedisClient,
    getRedisClient,
    checkRedisHealth,
    buildOtpChallengeKey,
    buildOtpCooldownKey,
    buildOtpAttemptsKey,
    buildOtpLockKey,
    buildRevokedSessionKey,
    buildRateLimitKey,
    configureRedisKeyConventions,
    closeRedisClient,
};
