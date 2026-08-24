const express = require('express');

const { loadEnv } = require('./config/env');
const { buildSecurityConfig } = require('./config/security');
const { getPostgresPool, checkPostgresHealth } = require('./lib/postgres');
const { getRedisClient, checkRedisHealth, configureRedisKeyConventions } = require('./lib/redis');
const { createJwtService } = require('./lib/jwt');
const { createAuthAccountsRepository } = require('./repositories/auth-accounts.repository');
const { createAdminCredentialsRepository } = require('./repositories/admin-credentials.repository');
const { createAuditRepository } = require('./repositories/audit.repository');
const { createSessionsRepository } = require('./repositories/sessions.repository');
const { createRefreshTokensRepository } = require('./repositories/refresh-tokens.repository');
const { createNotificationClientService } = require('./services/notification-client.service');
const { createBootstrapService } = require('./services/bootstrap.service');
const { createOtpAuthService } = require('./services/otp-auth.service');
const { createSessionService } = require('./services/session.service');
const { createMfaService } = require('./services/mfa.service');
const { createAdminAuthService } = require('./services/admin-auth.service');
const { createAdminBootstrapService } = require('./services/admin-bootstrap.service');
const { createAuditService } = require('./services/audit.service');
const { createTokenService } = require('./services/token.service');
const { createAdminAuthController } = require('./controllers/admin-auth.controller');
const { createOtpAuthController } = require('./controllers/otp-auth.controller');
const { createSessionController } = require('./controllers/session.controller');
const { createJwksController } = require('./controllers/jwks.controller');
const { createAdminAuthRoutes } = require('./routes/admin-auth.routes');
const { createPublicAuthRoutes } = require('./routes/public-auth.routes');
const { createSessionRoutes } = require('./routes/session.routes');
const { createJwksRoutes } = require('./routes/jwks.routes');
const { createMtlsFetch } = require('../../../platform/node/mtls-client.cjs');
const { requestIdMiddleware } = require('./middleware/request-id.middleware');
const { configureAuthRateLimit } = require('./middleware/auth-rate-limit.middleware');
const { errorHandlerMiddleware } = require('./middleware/error-handler.middleware');

function buildSuccessEnvelope(data, requestId) {
    return {
        success: true,
        data,
        error: null,
        meta: { requestId },
    };
}

function createApp(options = {}) {
    const env = options.env || loadEnv();
    const fetchImpl = options.fetchImpl || createMtlsFetch({ env, prefix: 'INTERNAL_TLS' });
    const security = buildSecurityConfig(env);
    configureRedisKeyConventions(security.redisKeys);
    const postgresPool = options.postgresPool || getPostgresPool(env);
    const redisClient = options.redisClient || getRedisClient(env);
    const jwtService = options.jwtService || createJwtService({ env, security });
    const authAccountsRepository = options.authAccountsRepository || createAuthAccountsRepository(postgresPool);
    const adminCredentialsRepository =
        options.adminCredentialsRepository || createAdminCredentialsRepository(postgresPool);
    const auditRepository = options.auditRepository || createAuditRepository(postgresPool);
    const auditService = options.auditService || createAuditService({ auditRepository });
    const sessionsRepository = options.sessionsRepository || createSessionsRepository(postgresPool);
    const refreshTokensRepository =
        options.refreshTokensRepository || createRefreshTokensRepository(postgresPool);
    const notificationClient =
        options.notificationClient ||
        createNotificationClientService({
            notificationBaseUrl: env.notificationService.baseUrl,
            timeoutMs: env.notificationService.timeoutMs,
            requestIdHeader: env.requestIdHeader,
            fetchImpl,
        });
    const bootstrapService =
        options.bootstrapService ||
        createBootstrapService({
            userServiceBaseUrl: env.userService.baseUrl,
            driverServiceBaseUrl: env.driverService.baseUrl,
            userServiceTimeoutMs: env.userService.timeoutMs,
            driverServiceTimeoutMs: env.driverService.timeoutMs,
            requestIdHeader: env.requestIdHeader,
            fetchImpl,
        });
    const sessionService =
        options.sessionService ||
        createSessionService({
            security,
            jwtService,
            redisClient,
            sessionsRepository,
            refreshTokensRepository,
            authAccountsRepository,
            auditService,
        });
    const mfaService =
        options.mfaService ||
        createMfaService({
            pool: postgresPool,
            redisClient,
            security,
            env,
        });
    const adminAuthService =
        options.adminAuthService ||
        createAdminAuthService({
            authAccountsRepository,
            adminCredentialsRepository,
            mfaService,
            sessionService,
            auditService,
            security,
        });
    const adminBootstrapService =
        options.adminBootstrapService ||
        createAdminBootstrapService({
            authAccountsRepository,
            adminCredentialsRepository,
            adminBootstrap: env.adminBootstrap,
        });
    const otpAuthService =
        options.otpAuthService ||
        createOtpAuthService({
            redisClient,
            security,
            notificationClient,
            authAccountsRepository,
            bootstrapService,
            tokenService: options.tokenService || createTokenService({ sessionService }),
            auditService,
            env,
        });
    const adminAuthController = options.adminAuthController || createAdminAuthController(adminAuthService);
    const otpAuthController = options.otpAuthController || createOtpAuthController(otpAuthService);
    const sessionController = options.sessionController || createSessionController(sessionService);
    const jwksController = options.jwksController || createJwksController(jwtService);
    const app = express();
    configureAuthRateLimit({
        redisClient,
        security,
    });

    void adminBootstrapService.bootstrap().catch((error) => {
        console.error('Admin bootstrap failed', {
            code: error && error.code ? error.code : 'UNKNOWN_ERROR',
            message: error && error.message ? error.message : String(error),
        });
    });

    app.use(express.json());
    app.use(requestIdMiddleware({ requestIdHeader: env.requestIdHeader }));
    app.use(async (req, _res, next) => {
        try {
            const dependencyPlan = resolveDependencyPlan(req);
            if (!dependencyPlan) {
                return next();
            }

            if (dependencyPlan.requirePostgres) {
                try {
                    await checkPostgresHealth(postgresPool);
                } catch (_error) {
                    const error = new Error('Auth database is unavailable');
                    error.statusCode = 503;
                    error.code = 'AUTH_DB_UNAVAILABLE';
                    return next(error);
                }
            }

            if (dependencyPlan.requireRedis) {
                try {
                    await checkRedisHealth(redisClient);
                } catch (_error) {
                    const error = new Error('Redis is unavailable for auth flow');
                    error.statusCode = 503;
                    error.code = 'REDIS_UNAVAILABLE';
                    return next(error);
                }
            }

            return next();
        } catch (error) {
            return next(error);
        }
    });

    const authApiRouter = express.Router();
    authApiRouter.get('/health', (req, res) => {
        return res.status(200).json(buildSuccessEnvelope({ service: env.serviceName, status: 'ok', message: 'API V1 Auth is healthy' }, req.requestId));
    });
    authApiRouter.use(createAdminAuthRoutes(adminAuthController));
    authApiRouter.use(createPublicAuthRoutes(otpAuthController));
    authApiRouter.use(createSessionRoutes(sessionController));

    app.get('/health', async (req, res) => {
        const [postgresHealth, redisHealth] = await Promise.allSettled([
            checkPostgresHealth(postgresPool),
            checkRedisHealth(redisClient),
        ]);

        const dependencies = {
            postgres:
                postgresHealth.status === 'fulfilled'
                    ? { status: 'ok' }
                    : { status: 'down', error: postgresHealth.reason.message },
            redis:
                redisHealth.status === 'fulfilled'
                    ? { status: 'ok' }
                    : { status: 'down', error: redisHealth.reason.message },
        };

        const hasFailure = Object.values(dependencies).some((dependency) => dependency.status !== 'ok');
        const serviceStatus = hasFailure ? 'degraded' : 'ok';
        const statusCode = hasFailure ? 503 : 200;

        return res.status(statusCode).json(
            buildSuccessEnvelope(
                {
                    service: env.serviceName,
                    status: serviceStatus,
                    env: env.nodeEnv,
                    dependencies,
                    securityDefaults: {
                        accessTokenTtlMinutes: security.token.accessTokenTtlMinutes,
                        refreshTokenTtlDays: security.token.refreshTokenTtlDays,
                        otpTtlSeconds: security.otp.ttlSeconds,
                        otpCooldownSeconds: security.otp.resendCooldownSeconds,
                    },
                },
                req.requestId
            )
        );
    });

    app.use('/api/v1/auth', authApiRouter);
    app.use('/', createJwksRoutes(jwksController));

    app.get('/', (req, res) => {
        return res
            .status(200)
            .json(buildSuccessEnvelope({ service: env.serviceName, message: 'Auth service online' }, req.requestId));
    });

    app.get('/api/v1/protected/customer', (req, res) => res.json(buildSuccessEnvelope({ protected: true, role: 'customer' }, req.requestId)));
    app.get('/api/v1/protected/driver', (req, res) => res.json(buildSuccessEnvelope({ protected: true, role: 'driver' }, req.requestId)));
    app.get('/api/v1/protected/admin', (req, res) => res.json(buildSuccessEnvelope({ protected: true, role: 'admin' }, req.requestId)));

    app.use(errorHandlerMiddleware);

    return app;
}

module.exports = {
    createApp,
    resolveDependencyPlan,
};

const AUTH_API_PREFIX = '/api/v1/auth';

function normalizeAuthPath(req) {
    const path = req.path || '';
    if (path.startsWith(AUTH_API_PREFIX)) {
        const rest = path.slice(AUTH_API_PREFIX.length);
        return rest.length > 0 ? rest : '/';
    }
    return path;
}

function resolveDependencyPlan(req) {
    const method = (req.method || '').toUpperCase();
    const path = normalizeAuthPath(req);

    if (method === 'POST' && path === '/register') {
        return { requirePostgres: true, requireRedis: false };
    }

    if (method === 'POST' && (path === '/login/otp/request' || path === '/login/otp/verify')) {
        return { requirePostgres: false, requireRedis: true };
    }

    if (method === 'POST' && (path === '/refresh' || path === '/oauth/token')) {
        return { requirePostgres: true, requireRedis: true };
    }

    if (
        method === 'POST' &&
        (path === '/logout' || path === '/logout-all' || path === '/oauth/revoke')
    ) {
        return { requirePostgres: true, requireRedis: true };
    }

    if (method === 'POST' && (path === '/login/admin' || path === '/mfa/challenge')) {
        return { requirePostgres: true, requireRedis: false };
    }

    return null;
}
