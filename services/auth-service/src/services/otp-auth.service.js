const crypto = require('crypto');
const { hashPassword } = require('../lib/password');

const {
    buildOtpChallengeKey,
    buildOtpCooldownKey,
    buildOtpAttemptsKey,
    buildOtpLockKey,
} = require('../lib/redis');

function generateOtpCode() {
    const value = crypto.randomInt(0, 1000000);
    return String(value).padStart(6, '0');
}

function createOtpAuthService(options) {
    const {
        redisClient,
        security,
        notificationClient,
        authAccountsRepository,
        bootstrapService,
        tokenService,
        auditService,
        logger = console,
        env,
    } = options;

    return {
        async register({ email, password, name, role = 'customer', requestId }) {
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const displayName = String(name || '').trim();
            const passwordHash = await hashPassword(password);

            let account = await authAccountsRepository.findByDestination({
                destination: normalizedEmail,
                destinationType: 'email',
            });
            const alreadyExisted = Boolean(account);

            if (!account) {
                account = await authAccountsRepository.createAccount({
                    destination: normalizedEmail,
                    destinationType: 'email',
                    status: 'active',
                });
            }

            await authAccountsRepository.assignRole({ accountId: account.id, role });

            if (typeof authAccountsRepository.upsertUserCredential === 'function') {
                await authAccountsRepository.upsertUserCredential({
                    accountId: account.id,
                    passwordHash,
                    displayName,
                });
            }

            const accountWithRoles = await authAccountsRepository.getAccountWithRoles(account.id);

            await recordAudit(auditService, {
                requestId,
                accountId: account.id,
                actorRole: role,
                eventType: 'user_register',
                eventStatus: 'success',
                metadata: {
                    email: normalizedEmail,
                    name: displayName,
                    role,
                    alreadyExisted,
                },
            });

            return {
                user_id: accountWithRoles.subject_id,
                account_id: accountWithRoles.id,
                email: accountWithRoles.destination,
                name: displayName,
                role,
                roles: accountWithRoles.roles || [role],
                status: accountWithRoles.status,
                created_at: accountWithRoles.created_at,
                already_existed: alreadyExisted,
                message: alreadyExisted
                    ? 'User already existed, returning existing user_id for repeatable tests.'
                    : 'User registered successfully.',
            };
        },

        async requestOtp({ role, destination, channel, requestId }) {
            try {
                // 1. CHECK IF ACCOUNT EXISTS FIRST (STRICT)
                const existingAccount = await authAccountsRepository.findByDestination({
                    destination,
                    destinationType: channelToDestinationType(channel),
                });

                if (!existingAccount) {
                    const error = new Error('Số điện thoại không tồn tại trong hệ thống. Vui lòng liên hệ quản trị viên.');
                    error.statusCode = 404;
                    error.code = 'ACCOUNT_NOT_FOUND';
                    throw error;
                }

                const keyContext = { role, destination };
                const challengeKey = buildOtpChallengeKey(keyContext);
                const cooldownKey = buildOtpCooldownKey(keyContext);
                const attemptsKey = buildOtpAttemptsKey(keyContext);
                const lockKey = buildOtpLockKey(keyContext);

                const [isLocked, cooldownTtl] = await Promise.all([
                    redisClient.exists(lockKey),
                    redisClient.ttl(cooldownKey),
                ]);
                if (isLocked) {
                    const error = new Error('OTP verification temporarily locked');
                    error.statusCode = 423;
                    error.code = 'OTP_LOCKED';
                    error.details = {
                        retryAfterSeconds: Math.max(0, await redisClient.ttl(lockKey)),
                    };
                    throw error;
                }

                if (cooldownTtl > 0) {
                    const error = new Error('OTP requests are throttled');
                    error.statusCode = 429;
                    error.code = 'OTP_THROTTLED';
                    error.details = {
                        retryAfterSeconds: cooldownTtl,
                    };
                    throw error;
                }

                const code = generateOtpCode();
                const challengePayload = {
                    role,
                    destination,
                    channel,
                    code,
                    issuedAt: new Date().toISOString(),
                };

                await redisClient
                    .multi()
                    .set(challengeKey, JSON.stringify(challengePayload), 'EX', security.otp.ttlSeconds)
                    .set(attemptsKey, '0', 'EX', security.otp.ttlSeconds)
                    .set(cooldownKey, '1', 'EX', security.otp.resendCooldownSeconds)
                    .exec();

                await notificationClient.sendOtp({
                    destination,
                    channel,
                    role,
                    code,
                    requestId,
                });

                const response = {
                    challengeStatus: 'accepted',
                    message: 'If the destination is eligible, an OTP will be delivered shortly.',
                    cooldownSeconds: security.otp.resendCooldownSeconds,
                    expiresInSeconds: security.otp.ttlSeconds,
                };

                if (env.nodeEnv !== 'production') {
                    response.debugOtpCode = code;
                }

                await recordAudit(auditService, {
                    requestId,
                    actorRole: role,
                    eventType: 'otp_request',
                    eventStatus: 'success',
                    metadata: { destination, channel },
                });

                return response;
            } catch (error) {
                await recordAudit(auditService, {
                    requestId,
                    actorRole: role,
                    eventType: 'otp_request',
                    eventStatus: 'failed',
                    metadata: { destination, channel, code: error.code || 'UNKNOWN_ERROR' },
                });
                throw error;
            }
        },

        async verifyOtp({ role, destination, code, requestId, userAgent = null, ipAddress = null }) {
            try {
                const keyContext = { role, destination };
                const challengeKey = buildOtpChallengeKey(keyContext);
                const cooldownKey = buildOtpCooldownKey(keyContext);
                const attemptsKey = buildOtpAttemptsKey(keyContext);
                const lockKey = buildOtpLockKey(keyContext);

                const [isLocked, lockTtl, challengeRaw] = await Promise.all([
                    redisClient.exists(lockKey),
                    redisClient.ttl(lockKey),
                    redisClient.get(challengeKey),
                ]);

                if (isLocked) {
                    const error = new Error('OTP verification temporarily locked');
                    error.statusCode = 423;
                    error.code = 'OTP_LOCKED';
                    error.details = {
                        retryAfterSeconds: Math.max(0, lockTtl),
                    };
                    throw error;
                }

                if (!challengeRaw) {
                    const error = new Error('OTP is invalid or expired');
                    error.statusCode = 400;
                    error.code = 'OTP_INVALID_OR_EXPIRED';
                    throw error;
                }

                let challenge;
                try {
                    challenge = JSON.parse(challengeRaw);
                } catch (_error) {
                    await redisClient.del(challengeKey, attemptsKey);
                    const error = new Error('OTP challenge state is invalid');
                    error.statusCode = 400;
                    error.code = 'OTP_INVALID_OR_EXPIRED';
                    throw error;
                }

                const expectedCode = String(challenge.code || '');
                if (expectedCode !== code) {
                    const attempts = await redisClient.incr(attemptsKey);
                    const attemptsTtl = await redisClient.ttl(challengeKey);

                    if (attempts >= security.otp.maxVerifyAttempts) {
                        const lockSeconds = Math.max(
                            1,
                            security.otp.lockWindowSeconds || 0,
                            attemptsTtl > 0 ? attemptsTtl : 0
                        );
                        await redisClient
                            .multi()
                            .set(lockKey, '1', 'EX', lockSeconds)
                            .del(challengeKey, attemptsKey)
                            .exec();

                        const error = new Error('OTP verification temporarily locked');
                        error.statusCode = 423;
                        error.code = 'OTP_LOCKED';
                        error.details = { retryAfterSeconds: lockSeconds };
                        throw error;
                    }

                    const error = new Error('OTP is invalid or expired');
                    error.statusCode = 400;
                    error.code = 'OTP_INVALID_OR_EXPIRED';
                    error.details = {
                        remainingAttempts: Math.max(0, security.otp.maxVerifyAttempts - attempts),
                    };
                    throw error;
                }

                await redisClient.del(challengeKey, attemptsKey, cooldownKey, lockKey);

                const account = await authAccountsRepository.findByDestination({
                    destination,
                    destinationType: channelToDestinationType(challenge.channel),
                });

                if (!account) {
                    const error = new Error('Tài khoản không tồn tại hoặc đã bị xóa');
                    error.statusCode = 404;
                    error.code = 'ACCOUNT_NOT_FOUND';
                    throw error;
                }
                ensureAccountIsActive(account);

                await authAccountsRepository.assignRole({ accountId: account.id, role });
                const accountWithRoles = await authAccountsRepository.getAccountWithRoles(account.id);
                ensureAccountIsActive(accountWithRoles);
                
                // SKIPPING BOOTSTRAP - Only use existing profiles
                const bootstrap = { status: 'skipped', reason: 'manual_registration_only' };
                const tokens = tokenService
                    ? await tokenService.issueOtpLoginTokens({
                          account: accountWithRoles,
                          role,
                          userAgent,
                          ipAddress,
                      requestId,
                      })
                    : null;

                await recordAudit(auditService, {
                    requestId,
                    accountId: accountWithRoles.id,
                    sessionId: tokens ? tokens.sessionId : null,
                    actorRole: role,
                    eventType: 'otp_verify',
                    eventStatus: 'success',
                    ipAddress,
                    userAgent,
                    metadata: { destination },
                });

                if (bootstrap && bootstrap.status === 'failed') {
                    await recordAudit(auditService, {
                        requestId,
                        accountId: accountWithRoles.id,
                        actorRole: role,
                        eventType: 'bootstrap_failure',
                        eventStatus: 'failed',
                        metadata: { destination, bootstrap },
                    });
                }

                return {
                    authStatus: 'verified',
                    message: 'OTP verified successfully.',
                    account: accountWithRoles,
                    bootstrap,
                    tokens,
                    accessToken: tokens ? tokens.accessToken : null,
                    refreshToken: tokens ? tokens.refreshToken : null,
                    tokenType: tokens ? tokens.tokenType : null,
                };
            } catch (error) {
                await recordAudit(auditService, {
                    requestId,
                    actorRole: role,
                    eventType: 'otp_verify',
                    eventStatus: 'failed',
                    ipAddress,
                    userAgent,
                    metadata: { destination, code: error.code || 'UNKNOWN_ERROR' },
                });
                throw error;
            }
        },
    };
}

async function bootstrapProfile({ bootstrapService, logger, requestId, role, account }) {
    if (!bootstrapService || !account || !account.subject_id) {
        return {
            status: 'skipped',
            role,
            reason: 'bootstrap_service_unavailable',
        };
    }

    const result = await bootstrapService.bootstrapProfile({
        role,
        subjectId: account.subject_id,
        accountId: account.id,
        requestId,
    });

    if (result.status === 'failed') {
        logger.error('Identity bootstrap failed after OTP verification', {
            requestId,
            role,
            subjectId: account.subject_id,
            accountId: account.id,
            bootstrap: result,
        });
    }

    return result;
}

function channelToDestinationType(channel) {
    return channel === 'email' ? 'email' : 'phone';
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
    createOtpAuthService,
};
