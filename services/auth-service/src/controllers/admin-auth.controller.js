function createAdminAuthController(adminAuthService, auditRepository) {
    return {
        loginAdmin: async (req, res, next) => {
            try {
                const data = await adminAuthService.loginWithPassword({
                    destination: req.body.destination,
                    password: req.body.password,
                    requestId: req.requestId,
                    userAgent: req.headers['user-agent'] || null,
                    ipAddress: req.ip || null,
                });

                return res.status(200).json({
                    success: true,
                    data,
                    error: null,
                    meta: { requestId: req.requestId },
                });
            } catch (error) {
                return next(error);
            }
        },

        mfaChallenge: async (req, res, next) => {
            try {
                const data = await adminAuthService.completeMfaChallenge({
                    challengeToken: req.body.challengeToken,
                    totpCode: req.body.totpCode,
                    recoveryCode: req.body.recoveryCode,
                    requestId: req.requestId,
                });

                return res.status(200).json({
                    success: true,
                    data,
                    error: null,
                    meta: { requestId: req.requestId },
                });
            } catch (error) {
                return next(error);
            }
        },

        listAudit: async (req, res, next) => {
            try {
                const roles = String(req.headers['x-auth-roles'] || req.headers['x-auth-role'] || '')
                    .split(',')
                    .map((role) => role.trim().toLowerCase());
                const accountId = String(req.headers['x-auth-account-id'] || '').trim();
                if (req.headers['x-auth-context-source'] !== 'api-gateway' || !roles.includes('admin') || !accountId) {
                    const error = new Error('Admin permission is required');
                    error.statusCode = 403;
                    error.code = 'ADMIN_FORBIDDEN';
                    throw error;
                }

                const requestedLimit = Number(req.query.limit);
                const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 25;
                const entries = await auditRepository.listRecentByAccountId(accountId, limit);
                return res.status(200).json({
                    success: true,
                    data: {
                        items: entries.map((entry) => ({
                            id: entry.id,
                            eventType: entry.event_type,
                            eventStatus: entry.event_status,
                            actorRole: entry.actor_role,
                            createdAt: entry.created_at,
                        })),
                    },
                    error: null,
                    meta: { requestId: req.requestId },
                });
            } catch (error) {
                return next(error);
            }
        },
    };
}

module.exports = {
    createAdminAuthController,
};
