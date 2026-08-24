const crypto = require('crypto');

const {
    generateTotpSecret,
    verifyTotpCode,
    generateRecoveryCodes,
    hashRecoveryCode,
} = require('../lib/totp');

function createMfaService(options) {
    const { pool, redisClient, security, env } = options;
    const challengeTtlSeconds = Math.max(1, security.adminMfa.challengeTtlSeconds || 300);
    const encryptionKey = resolveEncryptionKey(security.adminMfa.encryptionKey, env.nodeEnv);

    return {
        async ensureTotpEnrollment({ accountId, subjectId }) {
            const existing = await findPrimaryEnrollment(pool, accountId);
            if (existing) {
                return {
                    enrollment: existing,
                    setup: null,
                };
            }

            const accountLabel = subjectId || accountId;
            const generated = generateTotpSecret({
                accountLabel,
                issuer: security.adminMfa.issuer,
            });
            const enrollment = await createEnrollment(pool, accountId, encryptSecret(generated.base32, encryptionKey));
            const recoveryCodes = generateRecoveryCodes(security.adminMfa.recoveryCodesCount);
            await saveRecoveryCodes(pool, enrollment.id, recoveryCodes);

            return {
                enrollment,
                setup: {
                    totpSecret: env.nodeEnv === 'production' ? null : generated.base32,
                    otpauthUrl: generated.otpauthUrl,
                    recoveryCodes: env.nodeEnv === 'production' ? null : recoveryCodes,
                    recoveryCodesCount: recoveryCodes.length,
                },
            };
        },

        async createChallenge({ accountId, sessionDraft }) {
            const challengeToken = crypto.randomBytes(32).toString('base64url');
            const challengeKey = buildAdminChallengeKey(challengeToken);
            await redisClient.set(challengeKey, JSON.stringify({ accountId, sessionDraft }), 'EX', challengeTtlSeconds);

            return {
                challengeToken,
                expiresInSeconds: challengeTtlSeconds,
            };
        },

        async consumeChallenge(challengeToken) {
            const challengeKey = buildAdminChallengeKey(challengeToken);
            const raw = await redisClient.get(challengeKey);
            if (!raw) {
                const error = new Error('MFA challenge is invalid or expired');
                error.statusCode = 401;
                error.code = 'MFA_CHALLENGE_INVALID';
                throw error;
            }

            await redisClient.del(challengeKey);
            const parsed = JSON.parse(raw);
            return parsed;
        },

        async verifyMfaCode({ accountId, totpCode, recoveryCode }) {
            const enrollment = await findPrimaryEnrollment(pool, accountId);
            if (!enrollment) {
                const error = new Error('MFA enrollment not found');
                error.statusCode = 400;
                error.code = 'MFA_ENROLLMENT_MISSING';
                throw error;
            }

            if (recoveryCode) {
                const consumed = await tryConsumeRecoveryCode(pool, enrollment.id, recoveryCode);
                if (!consumed) {
                    const error = new Error('Recovery code is invalid');
                    error.statusCode = 401;
                    error.code = 'MFA_CODE_INVALID';
                    throw error;
                }
                return { method: 'recovery_code' };
            }

            const secretBase32 = decryptSecret(enrollment.secret_encrypted, encryptionKey);
            const validTotp = verifyTotpCode({
                secretBase32,
                token: totpCode,
                window: security.adminMfa.window,
            });
            if (!validTotp) {
                const error = new Error('TOTP code is invalid');
                error.statusCode = 401;
                error.code = 'MFA_CODE_INVALID';
                throw error;
            }

            await markEnrollmentVerified(pool, enrollment.id);
            return { method: 'totp' };
        },
    };
}

function resolveEncryptionKey(configuredKey, nodeEnv) {
    const normalizedConfiguredKey = String(configuredKey || '').trim();
    if (normalizedConfiguredKey) {
        return crypto.createHash('sha256').update(normalizedConfiguredKey).digest();
    }

    if (nodeEnv === 'production') {
        const error = new Error('AUTH_ADMIN_MFA_ENCRYPTION_KEY is required in production');
        error.code = 'MFA_ENCRYPTION_KEY_REQUIRED';
        throw error;
    }

    return crypto.createHash('sha256').update('cab-auth-dev-mfa-key').digest();
}

function encryptSecret(secret, encryptionKey) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `enc:v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptSecret(storedSecret, encryptionKey) {
    if (!storedSecret || typeof storedSecret !== 'string') {
        throw new Error('Stored MFA secret is invalid');
    }

    if (!storedSecret.startsWith('enc:v1:')) {
        return storedSecret;
    }

    const [, , ivPart, tagPart, encryptedPart] = storedSecret.split(':');
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        encryptionKey,
        Buffer.from(ivPart, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

function buildAdminChallengeKey(challengeToken) {
    return `admin:mfa:challenge:${challengeToken}`;
}

async function findPrimaryEnrollment(pool, accountId) {
    const result = await pool.query(
        `SELECT id, account_id, method, secret_encrypted, is_primary, verified_at, created_at, updated_at
         FROM mfa_enrollments
         WHERE account_id = $1 AND is_primary = TRUE
         LIMIT 1`,
        [accountId]
    );
    return result.rows[0] || null;
}

async function createEnrollment(pool, accountId, secretBase32) {
    const result = await pool.query(
        `INSERT INTO mfa_enrollments (account_id, method, secret_encrypted, is_primary)
         VALUES ($1, 'totp', $2, TRUE)
         RETURNING id, account_id, method, secret_encrypted, is_primary, verified_at, created_at, updated_at`,
        [accountId, secretBase32]
    );
    return result.rows[0];
}

async function saveRecoveryCodes(pool, enrollmentId, recoveryCodes) {
    for (const code of recoveryCodes) {
        const codeHash = hashRecoveryCode(code);
        await pool.query(
            `INSERT INTO mfa_recovery_codes (enrollment_id, code_hash)
             VALUES ($1, $2)
             ON CONFLICT (enrollment_id, code_hash) DO NOTHING`,
            [enrollmentId, codeHash]
        );
    }
}

async function tryConsumeRecoveryCode(pool, enrollmentId, recoveryCode) {
    const codeHash = hashRecoveryCode(recoveryCode);
    const result = await pool.query(
        `UPDATE mfa_recovery_codes
         SET used_at = NOW()
         WHERE enrollment_id = $1 AND code_hash = $2 AND used_at IS NULL
         RETURNING id`,
        [enrollmentId, codeHash]
    );
    return Boolean(result.rows[0]);
}

async function markEnrollmentVerified(pool, enrollmentId) {
    await pool.query(
        `UPDATE mfa_enrollments
         SET verified_at = COALESCE(verified_at, NOW()), updated_at = NOW()
         WHERE id = $1`,
        [enrollmentId]
    );
}

module.exports = {
    createMfaService,
};
