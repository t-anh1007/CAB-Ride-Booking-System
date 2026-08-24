const fs = require('fs');

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function parseList(value, fallback) {
    if (!value) {
        return fallback;
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function readSecret(name, fallback = '') {
    const filePath = String(process.env[`${name}_FILE`] || '').trim();
    if (filePath) {
        return fs.readFileSync(filePath, 'utf8').trim();
    }

    return String(process.env[name] ?? fallback);
}

function loadEnv() {
    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        serviceName: process.env.SERVICE_NAME || 'auth-service',
        port: parseInteger(process.env.PORT, 3000),
        requestIdHeader: process.env.REQUEST_ID_HEADER || 'x-request-id',
        postgres: {
            host: process.env.AUTH_DB_HOST || 'postgres',
            port: parseInteger(process.env.AUTH_DB_PORT, 5432),
            user: process.env.AUTH_DB_USER || 'postgres',
            password: readSecret('AUTH_DB_PASSWORD', 'postgres'),
            database: process.env.AUTH_DB_NAME || 'cab_auth',
            maxPoolSize: parseInteger(process.env.AUTH_DB_MAX_POOL_SIZE, 10),
        },
        redis: {
            host: process.env.AUTH_REDIS_HOST || 'redis',
            port: parseInteger(process.env.AUTH_REDIS_PORT, 6379),
            password: readSecret('AUTH_REDIS_PASSWORD', ''),
            db: parseInteger(process.env.AUTH_REDIS_DB, 0),
            keyPrefix: process.env.AUTH_REDIS_KEY_PREFIX || 'cab:auth:',
            keys: {
                rateLimitPrefix: process.env.AUTH_REDIS_RATE_LIMIT_PREFIX || 'ratelimit:auth',
                revokedSessionPrefix: process.env.AUTH_REDIS_REVOKED_SESSION_PREFIX || 'session:revoked',
            },
        },
        notificationService: {
            baseUrl: process.env.NOTIFICATION_SERVICE_BASE_URL || 'http://notification-service:3000',
            timeoutMs: parseInteger(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS, 5000),
        },
        userService: {
            baseUrl: process.env.USER_SERVICE_BASE_URL || 'http://user-service:3000',
            timeoutMs: parseInteger(process.env.USER_SERVICE_TIMEOUT_MS, 4000),
        },
        driverService: {
            baseUrl: process.env.DRIVER_SERVICE_BASE_URL || 'http://driver-service:3000',
            timeoutMs: parseInteger(process.env.DRIVER_SERVICE_TIMEOUT_MS, 4000),
        },
        jwt: {
            issuer: process.env.AUTH_JWT_ISSUER || 'cab-auth-service',
            audience: parseList(process.env.AUTH_JWT_AUDIENCE, ['cab-api']),
            accessTokenTtlMinutes: parseInteger(process.env.AUTH_ACCESS_TOKEN_TTL_MINUTES, 15),
            refreshTokenTtlDays: parseInteger(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS, 14),
            algorithm: process.env.AUTH_JWT_ALGORITHM || 'RS256',
            activeKid: process.env.AUTH_JWT_ACTIVE_KID || process.env.AUTH_JWT_KID || 'auth-key-local-1',
            activePrivateKeyPem: readSecret('AUTH_JWT_ACTIVE_PRIVATE_KEY_PEM', readSecret('AUTH_JWT_PRIVATE_KEY_PEM', '')),
            activePublicKeyPem: readSecret('AUTH_JWT_ACTIVE_PUBLIC_KEY_PEM', readSecret('AUTH_JWT_PUBLIC_KEY_PEM', '')),
            previousKid: process.env.AUTH_JWT_PREVIOUS_KID || '',
            previousPublicKeyPem: readSecret('AUTH_JWT_PREVIOUS_PUBLIC_KEY_PEM', ''),
        },
        adminBootstrap: {
            email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL || '',
            password: readSecret('AUTH_BOOTSTRAP_ADMIN_PASSWORD', ''),
        },
        otp: {
            ttlSeconds: parseInteger(process.env.AUTH_OTP_TTL_SECONDS, 300),
            resendCooldownSeconds: parseInteger(process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS, 1),
            maxVerifyAttempts: parseInteger(process.env.AUTH_OTP_MAX_VERIFY_ATTEMPTS, 5),
            lockWindowSeconds: parseInteger(process.env.AUTH_OTP_LOCK_WINDOW_SECONDS, 300),
        },
        adminMfa: {
            issuer: process.env.AUTH_ADMIN_MFA_ISSUER || 'cab-admin',
            window: parseInteger(process.env.AUTH_ADMIN_MFA_WINDOW, 1),
            recoveryCodesCount: parseInteger(process.env.AUTH_ADMIN_RECOVERY_CODES_COUNT, 8),
            challengeTtlSeconds: parseInteger(process.env.AUTH_ADMIN_MFA_CHALLENGE_TTL_SECONDS, 300),
            encryptionKey: readSecret('AUTH_ADMIN_MFA_ENCRYPTION_KEY', ''),
        },
        adminAuth: {
            maxFailedAttempts: parseInteger(process.env.AUTH_ADMIN_MAX_FAILED_ATTEMPTS, 5),
            lockMinutes: parseInteger(process.env.AUTH_ADMIN_LOCK_MINUTES, 15),
        },
        rateLimits: {
            otpRequestPerMinute: parseInteger(process.env.AUTH_RATE_LIMIT_OTP_REQUEST_PER_MINUTE, 1000),
            otpVerifyPerMinute: parseInteger(process.env.AUTH_RATE_LIMIT_OTP_VERIFY_PER_MINUTE, 1000),
            adminLoginPerMinute: parseInteger(process.env.AUTH_RATE_LIMIT_ADMIN_LOGIN_PER_MINUTE, 1000),
            mfaChallengePerMinute: parseInteger(process.env.AUTH_RATE_LIMIT_MFA_CHALLENGE_PER_MINUTE, 1000),
            refreshPerMinute: parseInteger(process.env.AUTH_RATE_LIMIT_REFRESH_PER_MINUTE, 1000),
        },
    };
}

module.exports = {
    loadEnv,
};
