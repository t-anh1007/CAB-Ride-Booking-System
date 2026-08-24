function createAdminCredentialsRepository(pool) {
    return {
        async findByAccountId(accountId) {
            const result = await pool.query(
                `SELECT account_id, password_hash, password_updated_at, mfa_required, failed_attempts, locked_until, created_at, updated_at
                 FROM admin_credentials
                 WHERE account_id = $1
                 LIMIT 1`,
                [accountId]
            );
            return result.rows[0] || null;
        },

        async upsertCredential({ accountId, passwordHash, mfaRequired = true }) {
            const result = await pool.query(
                `INSERT INTO admin_credentials (account_id, password_hash, mfa_required)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (account_id) DO UPDATE
                 SET password_hash = EXCLUDED.password_hash,
                     mfa_required = EXCLUDED.mfa_required,
                     password_updated_at = NOW(),
                     updated_at = NOW()
                 RETURNING account_id, password_hash, password_updated_at, mfa_required, failed_attempts, locked_until, created_at, updated_at`,
                [accountId, passwordHash, mfaRequired]
            );
            return result.rows[0];
        },

        async incrementFailedAttempts(accountId) {
            const result = await pool.query(
                `UPDATE admin_credentials
                 SET failed_attempts = failed_attempts + 1, updated_at = NOW()
                 WHERE account_id = $1
                 RETURNING account_id, failed_attempts, locked_until`,
                [accountId]
            );
            return result.rows[0] || null;
        },

        async setLockUntil(accountId, lockedUntil) {
            const result = await pool.query(
                `UPDATE admin_credentials
                 SET locked_until = $2, updated_at = NOW()
                 WHERE account_id = $1
                 RETURNING account_id, failed_attempts, locked_until`,
                [accountId, lockedUntil]
            );
            return result.rows[0] || null;
        },

        async resetFailedAttempts(accountId) {
            const result = await pool.query(
                `UPDATE admin_credentials
                 SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
                 WHERE account_id = $1
                 RETURNING account_id, failed_attempts, locked_until`,
                [accountId]
            );
            return result.rows[0] || null;
        },
    };
}

module.exports = {
    createAdminCredentialsRepository,
};
