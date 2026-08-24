const { buildRateLimitKey } = require('../lib/redis');

const WINDOW_SECONDS = 60;
const rateLimitState = {
    redisClient: null,
    security: null,
};

function configureAuthRateLimit({ redisClient, security }) {
    rateLimitState.redisClient = redisClient || null;
    rateLimitState.security = security || null;
}

function authRateLimitMiddleware(req, _res, next) {
    const plan = buildRateLimitPlan(req, rateLimitState.security);
    if (!plan) {
        return next();
    }

    if (!rateLimitState.redisClient) {
        const error = new Error('Rate limiter is unavailable');
        error.statusCode = 503;
        error.code = 'RATE_LIMIT_UNAVAILABLE';
        return next(error);
    }

    return enforceRateLimit({
        redisClient: rateLimitState.redisClient,
        req,
        action: plan.action,
        limitPerMinute: plan.limitPerMinute,
        subject: plan.subject,
    })
        .then(() => next())
        .catch((error) => next(error));
}

function buildRateLimitPlan(req, security) {
    if (!security || !security.rateLimits) {
        return null;
    }

    const method = (req.method || '').toUpperCase();
    const path = req.path || '';

    if (method === 'POST' && path === '/login/otp/request') {
        return {
            action: 'otp_request',
            limitPerMinute: security.rateLimits.otpRequestPerMinute,
            subject: resolveOtpSubject(req),
        };
    }

    if (method === 'POST' && path === '/login/otp/verify') {
        return {
            action: 'otp_verify',
            limitPerMinute: security.rateLimits.otpVerifyPerMinute,
            subject: resolveOtpSubject(req),
        };
    }

    if (method === 'POST' && path === '/login/admin') {
        return {
            action: 'admin_login',
            limitPerMinute: security.rateLimits.adminLoginPerMinute,
            subject: resolveAdminSubject(req),
        };
    }

    if (method === 'POST' && path === '/mfa/challenge') {
        return {
            action: 'mfa_challenge',
            limitPerMinute: security.rateLimits.mfaChallengePerMinute,
            subject: resolveMfaChallengeSubject(req),
        };
    }

    if (method === 'POST' && path === '/refresh') {
        return {
            action: 'refresh',
            limitPerMinute: security.rateLimits.refreshPerMinute,
            subject: resolveDefaultSubject(req),
        };
    }

    if (method === 'POST' && path === '/oauth/token') {
        return {
            action: 'refresh',
            limitPerMinute: security.rateLimits.refreshPerMinute,
            subject: resolveDefaultSubject(req),
        };
    }

    if (method === 'POST' && path === '/oauth/revoke') {
        return {
            action: 'refresh',
            limitPerMinute: security.rateLimits.refreshPerMinute,
            subject: resolveDefaultSubject(req),
        };
    }

    return null;
}

function resolveOtpSubject(req) {
    const role = extractBodyString(req, 'role') || 'unknown_role';
    const destination = extractBodyString(req, 'destination') || 'unknown_destination';
    const ip = resolveDefaultSubject(req);
    return `${role}:${destination}:${ip}`;
}

function resolveAdminSubject(req) {
    const username = extractBodyString(req, 'destination') || extractBodyString(req, 'email') || 'unknown_admin';
    const ip = resolveDefaultSubject(req);
    return `${username}:${ip}`;
}

function resolveMfaChallengeSubject(req) {
    const challengeToken = extractBodyString(req, 'challengeToken') || 'unknown_challenge';
    const ip = resolveDefaultSubject(req);
    return `${challengeToken}:${ip}`;
}

function resolveDefaultSubject(req) {
    return req.ip || (req.headers && req.headers['x-forwarded-for']) || 'unknown_ip';
}

function extractBodyString(req, field) {
    if (!req.body || typeof req.body[field] !== 'string') {
        return '';
    }
    return req.body[field].trim();
}

async function enforceRateLimit({ redisClient, req, action, limitPerMinute, subject }) {
    if (!Number.isFinite(limitPerMinute) || limitPerMinute <= 0) {
        return;
    }

    const key = buildRateLimitKey({ action, subject });
    let hitCount;
    try {
        hitCount = await redisClient.incr(key);
        if (hitCount === 1) {
            await redisClient.expire(key, WINDOW_SECONDS);
        }
    } catch (_error) {
        const error = new Error('Rate limiter dependency unavailable');
        error.statusCode = 503;
        error.code = 'RATE_LIMIT_UNAVAILABLE';
        throw error;
    }

    if (hitCount <= limitPerMinute) {
        return;
    }

    const ttl = await redisClient.ttl(key).catch(() => WINDOW_SECONDS);
    const error = new Error('Request rate limit exceeded');
    error.statusCode = 429;
    error.code = 'AUTH_RATE_LIMITED';
    error.details = {
        action,
        limitPerMinute,
        retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS,
    };
    if (req.path === '/login/otp/request' || req.path === '/login/otp/verify') {
        error.code = 'OTP_THROTTLED';
    }
    throw error;
}

module.exports = {
    authRateLimitMiddleware,
    configureAuthRateLimit,
};
