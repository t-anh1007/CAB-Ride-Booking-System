function createAuditRepository(pool) {
    return {
        async createEntry({
            accountId = null,
            sessionId = null,
            eventType,
            eventStatus = 'success',
            requestId = null,
            correlationId = null,
            actorRole = null,
            ipAddress = null,
            userAgent = null,
            metadata = {},
        }) {
            const result = await pool.query(
                `INSERT INTO audit_logs (
                    account_id,
                    session_id,
                    event_type,
                    event_status,
                    request_id,
                    correlation_id,
                    actor_role,
                    ip_address,
                    user_agent,
                    metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                RETURNING id, account_id, session_id, event_type, event_status, request_id, correlation_id, actor_role, ip_address, user_agent, metadata, created_at`,
                [
                    accountId,
                    sessionId,
                    eventType,
                    eventStatus,
                    requestId,
                    correlationId,
                    actorRole,
                    ipAddress,
                    userAgent,
                    JSON.stringify(metadata),
                ]
            );
            return result.rows[0];
        },

        async listRecentByAccountId(accountId, limit = 50) {
            const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50;
            const result = await pool.query(
                `SELECT id, account_id, session_id, event_type, event_status, request_id, correlation_id, actor_role, ip_address, user_agent, metadata, created_at
                 FROM audit_logs
                 WHERE account_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2`,
                [accountId, safeLimit]
            );
            return result.rows;
        },
    };
}

module.exports = {
    createAuditRepository,
};
