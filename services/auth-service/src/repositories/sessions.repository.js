function createSessionsRepository(pool) {
    return {
        async createSession({
            accountId,
            deviceId = null,
            userAgent = null,
            ipAddress = null,
            status = 'active',
            expiresAt = null,
        }) {
            const result = await pool.query(
                `INSERT INTO auth_sessions (account_id, device_id, user_agent, ip_address, status, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, account_id, device_id, user_agent, ip_address, status, revoked_at, expires_at, created_at, updated_at`,
                [accountId, deviceId, userAgent, ipAddress, status, expiresAt]
            );
            return result.rows[0];
        },

        async findById(sessionId) {
            const result = await pool.query(
                `SELECT id, account_id, device_id, user_agent, ip_address, status, revoked_at, expires_at, created_at, updated_at
                 FROM auth_sessions
                 WHERE id = $1
                 LIMIT 1`,
                [sessionId]
            );
            return result.rows[0] || null;
        },

        async listActiveByAccountId(accountId) {
            const result = await pool.query(
                `SELECT id, account_id, device_id, user_agent, ip_address, status, revoked_at, expires_at, created_at, updated_at
                 FROM auth_sessions
                 WHERE account_id = $1 AND status = 'active'
                 ORDER BY created_at DESC`,
                [accountId]
            );
            return result.rows;
        },

        async revokeSession(sessionId) {
            const result = await pool.query(
                `UPDATE auth_sessions
                 SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, account_id, status, revoked_at, updated_at`,
                [sessionId]
            );
            return result.rows[0] || null;
        },

        async revokeAllByAccountId(accountId) {
            const result = await pool.query(
                `UPDATE auth_sessions
                 SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
                 WHERE account_id = $1 AND status = 'active'
                 RETURNING id`,
                [accountId]
            );
            return result.rows.map((row) => row.id);
        },
    };
}

module.exports = {
    createSessionsRepository,
};
