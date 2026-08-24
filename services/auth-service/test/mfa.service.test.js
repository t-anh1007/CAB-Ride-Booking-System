const test = require('node:test');
const assert = require('node:assert/strict');
const speakeasy = require('speakeasy');

const { createMfaService } = require('../src/services/mfa.service');

test('mfa service stores encrypted TOTP secret and can verify it', async () => {
    let enrollment = null;
    let verified = false;

    const pool = {
        async query(sql, params) {
            if (sql.includes('SELECT id, account_id, method, secret_encrypted')) {
                return { rows: enrollment ? [enrollment] : [] };
            }

            if (sql.includes('INSERT INTO mfa_enrollments')) {
                enrollment = {
                    id: 'enroll-1',
                    account_id: params[0],
                    method: 'totp',
                    secret_encrypted: params[1],
                    is_primary: true,
                    verified_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                return { rows: [enrollment] };
            }

            if (sql.includes('INSERT INTO mfa_recovery_codes')) {
                return { rows: [] };
            }

            if (sql.includes('UPDATE mfa_enrollments')) {
                verified = true;
                enrollment = {
                    ...enrollment,
                    verified_at: new Date().toISOString(),
                };
                return { rows: [] };
            }

            if (sql.includes('UPDATE mfa_recovery_codes')) {
                return { rows: [] };
            }

            throw new Error(`Unexpected SQL in test: ${sql}`);
        },
    };

    const redisClient = {
        async set() {},
        async get() { return null; },
        async del() {},
    };

    const service = createMfaService({
        pool,
        redisClient,
        security: {
            adminMfa: {
                issuer: 'cab-admin',
                window: 1,
                recoveryCodesCount: 4,
                challengeTtlSeconds: 300,
                encryptionKey: 'test-mfa-encryption-key',
            },
        },
        env: {
            nodeEnv: 'development',
        },
    });

    const enrollmentResult = await service.ensureTotpEnrollment({
        accountId: 'account-1',
        subjectId: 'admin@example.com',
    });

    assert.ok(enrollment.secret_encrypted.startsWith('enc:v1:'), 'secret must be encrypted before persistence');
    assert.notEqual(enrollment.secret_encrypted, enrollmentResult.setup.totpSecret);

    const token = speakeasy.totp({
        secret: enrollmentResult.setup.totpSecret,
        encoding: 'base32',
    });

    const verificationResult = await service.verifyMfaCode({
        accountId: 'account-1',
        totpCode: token,
    });

    assert.equal(verificationResult.method, 'totp');
    assert.equal(verified, true);
});
