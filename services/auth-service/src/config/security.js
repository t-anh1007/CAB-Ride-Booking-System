function buildSecurityConfig(env) {
    return {
        token: {
            issuer: env.jwt.issuer,
            audience: env.jwt.audience,
            accessTokenTtlMinutes: env.jwt.accessTokenTtlMinutes,
            refreshTokenTtlDays: env.jwt.refreshTokenTtlDays,
            algorithm: env.jwt.algorithm,
            activeKid: env.jwt.activeKid,
            activePrivateKeyPem: env.jwt.activePrivateKeyPem,
            activePublicKeyPem: env.jwt.activePublicKeyPem,
            previousKid: env.jwt.previousKid,
            previousPublicKeyPem: env.jwt.previousPublicKeyPem,
        },
        otp: {
            ttlSeconds: env.otp.ttlSeconds,
            resendCooldownSeconds: env.otp.resendCooldownSeconds,
            maxVerifyAttempts: env.otp.maxVerifyAttempts,
            lockWindowSeconds: env.otp.lockWindowSeconds,
        },
        adminMfa: {
            issuer: env.adminMfa.issuer,
            window: env.adminMfa.window,
            recoveryCodesCount: env.adminMfa.recoveryCodesCount,
            challengeTtlSeconds: env.adminMfa.challengeTtlSeconds,
            encryptionKey: env.adminMfa.encryptionKey,
        },
        adminAuth: {
            maxFailedAttempts: env.adminAuth.maxFailedAttempts,
            lockMinutes: env.adminAuth.lockMinutes,
        },
        rateLimits: {
            otpRequestPerMinute: env.rateLimits.otpRequestPerMinute,
            otpVerifyPerMinute: env.rateLimits.otpVerifyPerMinute,
            adminLoginPerMinute: env.rateLimits.adminLoginPerMinute,
            mfaChallengePerMinute: env.rateLimits.mfaChallengePerMinute,
            refreshPerMinute: env.rateLimits.refreshPerMinute,
        },
        redisKeys: {
            rateLimitPrefix: env.redis.keys.rateLimitPrefix,
            revokedSessionPrefix: env.redis.keys.revokedSessionPrefix,
        },
    };
}

module.exports = {
    buildSecurityConfig,
};
