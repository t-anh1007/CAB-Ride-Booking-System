async function ensureUserCredentialsTable(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_credentials (
            account_id UUID PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
            password_hash VARCHAR NOT NULL,
            display_name VARCHAR,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

function createAuthAccountsRepository(pool) {
    return {
        async findBySubjectId(subjectId) {
            const result = await pool.query(
                `SELECT id, subject_id, destination, destination_type, status, last_login_at, created_at, updated_at
                 FROM auth_accounts
                 WHERE subject_id = $1
                 LIMIT 1`,
                [subjectId]
            );
            return result.rows[0] || null;
        },

        async findByDestination({ destination, destinationType = 'phone' }) {
            const result = await pool.query(
                `SELECT id, subject_id, destination, destination_type, status, last_login_at, created_at, updated_at
                 FROM auth_accounts
                 WHERE destination = $1 AND destination_type = $2
                 LIMIT 1`,
                [destination, destinationType]
            );
            return result.rows[0] || null;
        },

        async createAccount({ destination, destinationType = 'phone', status = 'active' }) {
            const result = await pool.query(
                `INSERT INTO auth_accounts (destination, destination_type, status)
                 VALUES ($1, $2, $3)
                 RETURNING id, subject_id, destination, destination_type, status, last_login_at, created_at, updated_at`,
                [destination, destinationType, status]
            );
            return result.rows[0];
        },

        async upsertUserCredential({ accountId, passwordHash, displayName = null }) {
            await ensureUserCredentialsTable(pool);
            const result = await pool.query(
                `INSERT INTO user_credentials (account_id, password_hash, display_name)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (account_id) DO UPDATE
                 SET password_hash = EXCLUDED.password_hash,
                     display_name = EXCLUDED.display_name,
                     updated_at = NOW()
                 RETURNING account_id, display_name, created_at, updated_at`,
                [accountId, passwordHash, displayName]
            );
            return result.rows[0] || null;
        },

        async updateStatus(accountId, status) {
            const result = await pool.query(
                `UPDATE auth_accounts
                 SET status = $2, updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, subject_id, destination, destination_type, status, last_login_at, created_at, updated_at`,
                [accountId, status]
            );
            return result.rows[0] || null;
        },

        async assignRole({ accountId, role }) {
            const result = await pool.query(
                `INSERT INTO account_roles (account_id, role)
                 VALUES ($1, $2)
                 ON CONFLICT (account_id, role) DO NOTHING
                 RETURNING account_id, role, created_at`,
                [accountId, role]
            );
            return result.rows[0] || null;
        },

        async listRolesByAccountId(accountId) {
            const result = await pool.query(
                `SELECT role
                 FROM account_roles
                 WHERE account_id = $1
                 ORDER BY role ASC`,
                [accountId]
            );
            return result.rows.map((row) => row.role);
        },

        async getAccountWithRoles(accountId) {
            const accountResult = await pool.query(
                `SELECT id, subject_id, destination, destination_type, status, last_login_at, created_at, updated_at
                 FROM auth_accounts
                 WHERE id = $1
                 LIMIT 1`,
                [accountId]
            );

            const account = accountResult.rows[0];
            if (!account) {
                return null;
            }

            const roles = await this.listRolesByAccountId(accountId);
            return { ...account, roles };
        },

        async listAuthorizationBundleByRoles(roles = []) {
            const normalizedRoles = Array.isArray(roles)
                ? roles.map((role) => String(role || '').trim()).filter(Boolean)
                : [];

            if (normalizedRoles.length === 0) {
                return { scopes: [], permissions: [] };
            }

            const result = await pool.query(
                `SELECT ap.permission, ap.kind
                 FROM role_permissions rp
                 JOIN auth_permissions ap ON ap.permission = rp.permission
                 WHERE rp.role::text = ANY($1::text[])
                 ORDER BY ap.permission ASC`,
                [normalizedRoles]
            );

            const scopes = [];
            const permissions = [];
            for (const row of result.rows) {
                if (row.kind === 'scope') {
                    scopes.push(row.permission);
                } else if (row.kind === 'permission') {
                    permissions.push(row.permission);
                }
            }

            return { scopes, permissions };
        },
    };
}

module.exports = {
    createAuthAccountsRepository,
};
