function createRefreshTokensRepository(pool) {
    return {
        async createFamily({ accountId, sessionId, status = 'active' }) {
            const result = await pool.query(
                `INSERT INTO refresh_token_families (account_id, session_id, status)
                 VALUES ($1, $2, $3)
                 RETURNING id, account_id, session_id, status, revoked_reason, created_at, updated_at`,
                [accountId, sessionId, status]
            );
            return result.rows[0];
        },

        async findFamilyById(familyId) {
            const result = await pool.query(
                `SELECT id, account_id, session_id, status, revoked_reason, created_at, updated_at
                 FROM refresh_token_families
                 WHERE id = $1
                 LIMIT 1`,
                [familyId]
            );
            return result.rows[0] || null;
        },

        async revokeFamily({ familyId, reason = 'manual_revoke' }) {
            const result = await pool.query(
                `UPDATE refresh_token_families
                 SET status = 'revoked', revoked_reason = $2, updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, status, revoked_reason, updated_at`,
                [familyId, reason]
            );
            return result.rows[0] || null;
        },

        async createToken({
            familyId,
            sessionId,
            tokenHash,
            parentTokenId = null,
            expiresAt,
            metadata = {},
        }) {
            const result = await pool.query(
                `INSERT INTO refresh_tokens (family_id, session_id, token_hash, parent_token_id, expires_at, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                 RETURNING id, family_id, session_id, token_hash, parent_token_id, issued_at, expires_at, used_at, revoked_at, metadata`,
                [familyId, sessionId, tokenHash, parentTokenId, expiresAt, JSON.stringify(metadata)]
            );
            return result.rows[0];
        },

        async findByTokenHash(tokenHash) {
            const result = await pool.query(
                `SELECT id, family_id, session_id, token_hash, parent_token_id, issued_at, expires_at, used_at, revoked_at, metadata
                 FROM refresh_tokens
                 WHERE token_hash = $1
                 LIMIT 1`,
                [tokenHash]
            );
            return result.rows[0] || null;
        },

        async markTokenUsed(tokenId) {
            const result = await pool.query(
                `UPDATE refresh_tokens
                 SET used_at = NOW()
                 WHERE id = $1
                 RETURNING id, used_at`,
                [tokenId]
            );
            return result.rows[0] || null;
        },

        async revokeToken(tokenId) {
            const result = await pool.query(
                `UPDATE refresh_tokens
                 SET revoked_at = NOW()
                 WHERE id = $1
                 RETURNING id, revoked_at`,
                [tokenId]
            );
            return result.rows[0] || null;
        },

        async revokeAllTokensInFamily(familyId) {
            const result = await pool.query(
                `UPDATE refresh_tokens
                 SET revoked_at = NOW()
                 WHERE family_id = $1 AND revoked_at IS NULL
                 RETURNING id`,
                [familyId]
            );
            return result.rows.length;
        },

        async revokeAllFamiliesByAccountId({ accountId, reason = 'manual_revoke' }) {
            const result = await pool.query(
                `UPDATE refresh_token_families
                 SET status = 'revoked', revoked_reason = $2, updated_at = NOW()
                 WHERE account_id = $1 AND status <> 'revoked'
                 RETURNING id`,
                [accountId, reason]
            );
            return result.rows.length;
        },
    };
}

module.exports = {
    createRefreshTokensRepository,
};
