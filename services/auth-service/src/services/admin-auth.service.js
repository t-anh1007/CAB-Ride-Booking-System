const { verifyPassword } = require('../lib/password');

function createAdminAuthService(options) {
    const {
        authAccountsRepository,
        adminCredentialsRepository,
        mfaService,
        sessionService,
        auditService,
        security,
        logger = console,
    } = options;

    const maxFailedAttempts = Math.max(1, (security && security.adminAuth && security.adminAuth.maxFailedAttempts) || 5);
    const lockMinutes = Math.max(1, (security && security.adminAuth && security.adminAuth.lockMinutes) || 15);

    return {
        async loginWithPassword({ destination, password, requestId, userAgent = null, ipAddress = null }) {
            let accountId = null;

            try {
                const account = await authAccountsRepository.findByDestination({
                    destination,
                    destinationType: 'email',
                });
                if (!account) {
                    throwUnauthorized('ADMIN_LOGIN_INVALID', 'Admin credentials are invalid');
                }

                const accountWithRoles = await authAccountsRepository.getAccountWithRoles(account.id);
                if (!accountWithRoles || !accountWithRoles.roles.includes('admin')) {
                    throwUnauthorized('ADMIN_LOGIN_INVALID', 'Admin credentials are invalid');
                }
                ensureAccountIsActive(accountWithRoles);

                accountId = accountWithRoles.id;
                const credential = await adminCredentialsRepository.findByAccountId(account.id);
                if (!credential) {
                    throwUnauthorized('ADMIN_LOGIN_INVALID', 'Admin credentials are invalid');
                }

                if (isLocked(credential.locked_until)) {
                    const error = new Error('Admin account is temporarily locked');
                    error.statusCode = 423;
                    error.code = 'ADMIN_ACCOUNT_LOCKED';
                    error.details = {
                        lockedUntil: credential.locked_until,
                    };
                    throw error;
                }

                const isPasswordValid = await verifyPassword(password, credential.password_hash);
                if (!isPasswordValid) {
                    const updated = await adminCredentialsRepository.incrementFailedAttempts(account.id);
                    if (updated && updated.failed_attempts >= maxFailedAttempts) {
                        const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
                        await adminCredentialsRepository.setLockUntil(account.id, lockedUntil);
                        logger.warn('Admin account locked due to repeated failed password attempts', {
                            requestId,
                            accountId: account.id,
                            lockedUntil: lockedUntil.toISOString(),
                            failedAttempts: updated.failed_attempts,
                        });
                    }
                    throwUnauthorized('ADMIN_LOGIN_INVALID', 'Admin credentials are invalid');
                }

                await adminCredentialsRepository.resetFailedAttempts(account.id);
                const enrollment = await mfaService.ensureTotpEnrollment({
                    accountId: accountWithRoles.id,
                    subjectId: accountWithRoles.subject_id,
                });
                const challenge = await mfaService.createChallenge({
                    accountId: accountWithRoles.id,
                    sessionDraft: {
                        accountId: accountWithRoles.id,
                        role: 'admin',
                        userAgent,
                        ipAddress,
                    },
                });

                logger.info('Admin password stage completed, MFA challenge issued', {
                    requestId,
                    accountId: accountWithRoles.id,
                });

                await recordAudit(auditService, {
                    requestId,
                    accountId: accountWithRoles.id,
                    actorRole: 'admin',
                    eventType: 'admin_login_password',
                    eventStatus: 'success',
                    ipAddress,
                    userAgent,
                });

                return {
                    authStatus: 'mfa_required',
                    message: 'Password verified. Complete MFA challenge to receive tokens.',
                    challengeToken: challenge.challengeToken,
                    challengeExpiresInSeconds: challenge.expiresInSeconds,
                    mfaSetup: enrollment.setup,
                };
            } catch (error) {
                await recordAudit(auditService, {
                    requestId,
                    accountId,
                    actorRole: 'admin',
                    eventType: 'admin_login_password',
                    eventStatus: 'failed',
                    ipAddress,
                    userAgent,
                    metadata: { destination, code: error.code || 'UNKNOWN_ERROR' },
                });
                throw error;
            }
        },

        async completeMfaChallenge({ challengeToken, totpCode, recoveryCode, requestId }) {
            let accountId = null;
            let userAgent = null;
            let ipAddress = null;

            try {
                const challenge = await mfaService.consumeChallenge(challengeToken);
                accountId = challenge.accountId;
                userAgent = challenge.sessionDraft ? challenge.sessionDraft.userAgent : null;
                ipAddress = challenge.sessionDraft ? challenge.sessionDraft.ipAddress : null;

                const accountWithRoles = await authAccountsRepository.getAccountWithRoles(accountId);
                if (!accountWithRoles || !accountWithRoles.roles.includes('admin')) {
                    throwUnauthorized('ADMIN_LOGIN_INVALID', 'Admin account is invalid');
                }
                ensureAccountIsActive(accountWithRoles);

                const verified = await mfaService.verifyMfaCode({
                    accountId,
                    totpCode,
                    recoveryCode,
                });
                const tokens = await sessionService.issueInitialSession({
                    account: accountWithRoles,
                    role: 'admin',
                    userAgent,
                    ipAddress,
                    authMethod: `admin_${verified.method}`,
                    requestId,
                });

                await recordAudit(auditService, {
                    requestId,
                    accountId,
                    sessionId: tokens.sessionId,
                    actorRole: 'admin',
                    eventType: 'admin_mfa_challenge',
                    eventStatus: 'success',
                    ipAddress,
                    userAgent,
                    metadata: { method: verified.method },
                });

                return {
                    authStatus: 'authenticated',
                    message: 'Admin login completed.',
                    mfaMethod: verified.method,
                    ...tokens,
                };
            } catch (error) {
                await recordAudit(auditService, {
                    requestId,
                    accountId,
                    actorRole: 'admin',
                    eventType: 'admin_mfa_challenge',
                    eventStatus: 'failed',
                    ipAddress,
                    userAgent,
                    metadata: { code: error.code || 'UNKNOWN_ERROR' },
                });
                throw error;
            }
        },
    };
}

function isLocked(lockedUntil) {
    if (!lockedUntil) {
        return false;
    }
    return new Date(lockedUntil).getTime() > Date.now();
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

    const error = new Error('Account is inactive');
    error.statusCode = 403;
    error.code = 'ACCOUNT_INACTIVE';
    throw error;
}

async function recordAudit(auditService, payload) {
    if (!auditService || typeof auditService.record !== 'function') {
        return;
    }
    await auditService.record(payload);
}

module.exports = {
    createAdminAuthService,
};
