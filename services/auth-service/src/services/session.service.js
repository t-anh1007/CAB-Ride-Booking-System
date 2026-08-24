const crypto = require('crypto');

const { buildRevokedSessionKey } = require('../lib/redis');

function createSessionService(options) {
    const {
        security,
        jwtService,
        redisClient,
        sessionsRepository,
        refreshTokensRepository,
        authAccountsRepository,
        auditService,
    } = options;

    return {
        async issueInitialSession({
            account,
            role,
            userAgent = null,
            ipAddress = null,
            authMethod = 'otp',
            requestId = null,
        }) {
            const refreshTtlSeconds = security.token.refreshTokenTtlDays * 24 * 60 * 60;
            const refreshExpiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);

            const session = await sessionsRepository.createSession({
                accountId: account.id,
                userAgent,
                ipAddress,
                status: 'active',
                expiresAt: refreshExpiresAt,
            });
            const family = await refreshTokensRepository.createFamily({
                accountId: account.id,
                sessionId: session.id,
                status: 'active',
            });

            const refreshToken = buildOpaqueRefreshToken();
            const refreshTokenHash = hashRefreshToken(refreshToken);
            await refreshTokensRepository.createToken({
                familyId: family.id,
                sessionId: session.id,
                tokenHash: refreshTokenHash,
                parentTokenId: null,
                expiresAt: refreshExpiresAt,
                metadata: { issuedFor: 'otp_login' },
            });

            const resolvedRoles = Array.isArray(account.roles) && account.roles.length > 0 ? account.roles : [role];
            const access = await jwtService.signAccessToken({
                subjectId: account.subject_id,
                sessionId: session.id,
                roles: resolvedRoles,
                accountId: account.id,
                ...(await authAccountsRepository.listAuthorizationBundleByRoles(resolvedRoles)),
                authMethod,
            });

            await recordAudit(auditService, {
                requestId,
                accountId: account.id,
                sessionId: session.id,
                actorRole: role,
                eventType: 'login_success',
                eventStatus: 'success',
                ipAddress,
                userAgent,
                metadata: { authMethod },
            });

            return {
                tokenType: 'Bearer',
                accessToken: access.token,
                accessTokenExpiresInSeconds: access.expiresInSeconds,
                refreshToken,
                refreshTokenExpiresInSeconds: refreshTtlSeconds,
                sessionId: session.id,
            };
        },

        async refreshSession({ refreshToken, userAgent = null, ipAddress = null, requestId = null, source = 'refresh' }) {
            const refreshTokenHash = hashRefreshToken(refreshToken);
            const tokenRow = await refreshTokensRepository.findByTokenHash(refreshTokenHash);

            if (!tokenRow) {
                await recordAudit(auditService, {
                    requestId,
                    eventType: 'refresh',
                    eventStatus: 'failed',
                    ipAddress,
                    userAgent,
                    metadata: { reason: 'token_not_found', source },
                });
                throwUnauthorized('REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
            }

            const family = await refreshTokensRepository.findFamilyById(tokenRow.family_id);
            if (!family || family.status !== 'active') {
                await recordAudit(auditService, {
                    requestId,
                    sessionId: tokenRow ? tokenRow.session_id : null,
                    eventType: 'refresh',
                    eventStatus: 'failed',
                    ipAddress,
                    userAgent,
                    metadata: { reason: 'family_invalid', source },
                });
                throwUnauthorized('REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
            }

            const isExpired = new Date(tokenRow.expires_at).getTime() <= Date.now();
            const isReused = Boolean(tokenRow.used_at) || Boolean(tokenRow.revoked_at) || isExpired;
            if (isReused) {
                await recordAudit(auditService, {
                    requestId,
                    accountId: family.account_id,
                    sessionId: tokenRow.session_id,
                    eventType: 'refresh_reuse_detected',
                    eventStatus: 'failed',
                    ipAddress,
                    userAgent,
                    metadata: { tokenId: tokenRow.id, familyId: tokenRow.family_id, source },
                });
                await handleTokenReuse({
                    refreshTokensRepository,
                    sessionsRepository,
                    redisClient,
                    familyId: tokenRow.family_id,
                    sessionId: tokenRow.session_id,
                });
                throwUnauthorized('REFRESH_TOKEN_REUSED', 'Refresh token reuse detected');
            }

            await refreshTokensRepository.markTokenUsed(tokenRow.id);

            const account = await authAccountsRepository.getAccountWithRoles(family.account_id);
            const session = await sessionsRepository.findById(tokenRow.session_id);
            if (!account || !session || session.status !== 'active') {
                await recordAudit(auditService, {
                    requestId,
                    accountId: family.account_id,
                    sessionId: tokenRow.session_id,
                    eventType: 'refresh',
                    eventStatus: 'failed',
                    ipAddress,
                    userAgent,
                    metadata: { reason: 'session_invalid', source },
                });
                throwUnauthorized('SESSION_INVALID', 'Session is no longer active');
            }
            ensureAccountIsActive(account);

            const nextRefreshToken = buildOpaqueRefreshToken();
            const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
            const refreshTtlSeconds = security.token.refreshTokenTtlDays * 24 * 60 * 60;
            const nextRefreshExpiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);

            await refreshTokensRepository.createToken({
                familyId: family.id,
                sessionId: session.id,
                tokenHash: nextRefreshTokenHash,
                parentTokenId: tokenRow.id,
                expiresAt: nextRefreshExpiresAt,
                metadata: {
                    issuedFor: 'refresh_rotation',
                    previousTokenId: tokenRow.id,
                    userAgent,
                    ipAddress,
                },
            });

            const access = await jwtService.signAccessToken({
                subjectId: account.subject_id,
                sessionId: session.id,
                roles: account.roles,
                accountId: account.id,
                ...(await authAccountsRepository.listAuthorizationBundleByRoles(account.roles)),
                authMethod: 'refresh_token',
            });

            await recordAudit(auditService, {
                requestId,
                accountId: account.id,
                sessionId: session.id,
                actorRole: account.roles[0] || null,
                eventType: 'refresh',
                eventStatus: 'success',
                ipAddress,
                userAgent,
                metadata: { previousTokenId: tokenRow.id, familyId: family.id, source },
            });

            return {
                tokenType: 'Bearer',
                accessToken: access.token,
                accessTokenExpiresInSeconds: access.expiresInSeconds,
                refreshToken: nextRefreshToken,
                refreshTokenExpiresInSeconds: refreshTtlSeconds,
                sessionId: session.id,
            };
        },

        async logoutSession({ refreshToken, requestId = null, source = 'logout' }) {
            const refreshTokenHash = hashRefreshToken(refreshToken);
            const tokenRow = await refreshTokensRepository.findByTokenHash(refreshTokenHash);

            if (!tokenRow) {
                await recordAudit(auditService, {
                    requestId,
                    eventType: 'logout',
                    eventStatus: 'success',
                    metadata: { revoked: false, reason: 'token_not_found', source },
                });
                return { logoutStatus: 'ok', revoked: false, reason: 'token_not_found' };
            }

            await refreshTokensRepository.revokeToken(tokenRow.id);
            await refreshTokensRepository.revokeFamily({
                familyId: tokenRow.family_id,
                reason: 'logout',
            });
            await sessionsRepository.revokeSession(tokenRow.session_id);
            await markSessionRevoked(redisClient, tokenRow.session_id, security.token.refreshTokenTtlDays * 24 * 60 * 60);

            await recordAudit(auditService, {
                requestId,
                sessionId: tokenRow.session_id,
                eventType: 'logout',
                eventStatus: 'success',
                metadata: { revoked: true, source },
            });

            return { logoutStatus: 'ok', revoked: true, sessionId: tokenRow.session_id };
        },

        async logoutAllSessions({ refreshToken, requestId = null }) {
            const refreshTokenHash = hashRefreshToken(refreshToken);
            const tokenRow = await refreshTokensRepository.findByTokenHash(refreshTokenHash);

            if (!tokenRow) {
                await recordAudit(auditService, {
                    requestId,
                    eventType: 'logout_all',
                    eventStatus: 'success',
                    metadata: { revokedSessionsCount: 0, revokedFamiliesCount: 0, reason: 'token_not_found' },
                });
                return {
                    logoutAllStatus: 'ok',
                    revokedSessionsCount: 0,
                    revokedFamiliesCount: 0,
                    reason: 'token_not_found',
                };
            }

            const family = await refreshTokensRepository.findFamilyById(tokenRow.family_id);
            if (!family) {
                await recordAudit(auditService, {
                    requestId,
                    eventType: 'logout_all',
                    eventStatus: 'success',
                    metadata: { revokedSessionsCount: 0, revokedFamiliesCount: 0, reason: 'family_not_found' },
                });
                return {
                    logoutAllStatus: 'ok',
                    revokedSessionsCount: 0,
                    revokedFamiliesCount: 0,
                    reason: 'family_not_found',
                };
            }

            const activeSessions = await sessionsRepository.listActiveByAccountId(family.account_id);
            const revokedSessionIds = await sessionsRepository.revokeAllByAccountId(family.account_id);
            const revokedFamiliesCount = await refreshTokensRepository.revokeAllFamiliesByAccountId({
                accountId: family.account_id,
                reason: 'logout_all',
            });

            const markerTtlSeconds = security.token.refreshTokenTtlDays * 24 * 60 * 60;
            await Promise.all(
                activeSessions.map((session) => markSessionRevoked(redisClient, session.id, markerTtlSeconds))
            );

            await recordAudit(auditService, {
                requestId,
                accountId: family.account_id,
                eventType: 'logout_all',
                eventStatus: 'success',
                metadata: { revokedSessionsCount: revokedSessionIds.length, revokedFamiliesCount },
            });

            return {
                logoutAllStatus: 'ok',
                revokedSessionsCount: revokedSessionIds.length,
                revokedFamiliesCount,
            };
        },

        async getCurrentAuthContext({ accessToken, requestId = null }) {
            let payload;
            try {
                payload = await jwtService.verifyAccessToken(accessToken);
            } catch (_error) {
                throwUnauthorized('ACCESS_TOKEN_INVALID', 'Access token is invalid or expired');
            }
            const account = await authAccountsRepository.findBySubjectId(payload.sub);

            if (!account) {
                await recordAudit(auditService, {
                    requestId,
                    eventType: 'auth_me',
                    eventStatus: 'failed',
                    metadata: { reason: 'account_not_found', subjectId: payload.sub },
                });
                throwUnauthorized('ACCOUNT_NOT_FOUND', 'Account does not exist');
            }

            ensureAccountIsActive(account);
            if (payload.aid && payload.aid !== account.id) {
                await recordAudit(auditService, {
                    requestId,
                    accountId: account.id,
                    eventType: 'auth_me',
                    eventStatus: 'failed',
                    metadata: { reason: 'account_mismatch', tokenAccountId: payload.aid },
                });
                throwUnauthorized('TOKEN_ACCOUNT_MISMATCH', 'Token account is invalid');
            }

            const roles = normalizeStringList(payload.roles, payload.role ? [payload.role] : []);
            const scopes = normalizeScopeClaim(payload.scope);
            const permissions = normalizeStringList(payload.permissions, []);
            const amr = normalizeStringList(payload.amr, []);

            await recordAudit(auditService, {
                requestId,
                accountId: account.id,
                sessionId: payload.sid || null,
                actorRole: roles[0] || null,
                eventType: 'auth_me',
                eventStatus: 'success',
            });

            return {
                subjectId: payload.sub,
                accountId: account.id,
                sessionId: payload.sid || null,
                role: roles[0] || null,
                roles,
                scopes,
                permissions,
                authMethod: amr[0] || null,
                amr,
            };
        },
    };
}

async function handleTokenReuse({ refreshTokensRepository, sessionsRepository, redisClient, familyId, sessionId }) {
    await refreshTokensRepository.revokeFamily({
        familyId,
        reason: 'reuse_detected',
    });
    await refreshTokensRepository.revokeAllTokensInFamily(familyId);
    await sessionsRepository.revokeSession(sessionId);
    await markSessionRevoked(redisClient, sessionId, 24 * 60 * 60);
}

async function markSessionRevoked(redisClient, sessionId, ttlSeconds) {
    if (!redisClient || !sessionId) {
        return;
    }
    const key = buildRevokedSessionKey(sessionId);
    await redisClient.set(key, '1', 'EX', Math.max(60, ttlSeconds));
}

function buildOpaqueRefreshToken() {
    return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function throwUnauthorized(code, message) {
    const error = new Error(message);
    error.statusCode = 401;
    error.code = code;
    throw error;
}

function ensureAccountIsActive(account) {
    if (!account || account.status === 'active') {
        return;
    }

    throwUnauthorized('ACCOUNT_INACTIVE', 'Account is inactive');
}

function normalizeStringList(value, fallback) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return Array.isArray(fallback) ? fallback : [];
}

function normalizeScopeClaim(scope) {
    if (!scope) {
        return [];
    }
    return String(scope)
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

async function recordAudit(auditService, payload) {
    if (!auditService || typeof auditService.record !== 'function') {
        return;
    }
    await auditService.record(payload);
}

module.exports = {
    createSessionService,
    hashRefreshToken,
};
