function createSessionController(sessionService) {
    return {
        refresh: async (req, res, next) => {
            try {
                const data = await sessionService.refreshSession({
                    refreshToken: req.body.refreshToken,
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

        oauthToken: async (req, res, next) => {
            try {
                const data = await sessionService.refreshSession({
                    refreshToken: req.body.refresh_token,
                    requestId: req.requestId,
                    userAgent: req.headers['user-agent'] || null,
                    ipAddress: req.ip || null,
                    source: 'oauth_token',
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

        logout: async (req, res, next) => {
            try {
                const data = await sessionService.logoutSession({
                    refreshToken: req.body.refreshToken,
                    requestId: req.requestId,
                    source: 'logout',
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

        oauthRevoke: async (req, res, next) => {
            try {
                const data = await sessionService.logoutSession({
                    refreshToken: req.body.token,
                    requestId: req.requestId,
                    source: 'oauth_revoke',
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

        logoutAll: async (req, res, next) => {
            try {
                const data = await sessionService.logoutAllSessions({
                    refreshToken: req.body.refreshToken,
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

        me: async (req, res, next) => {
            try {
                const accessToken = extractBearerToken(req.headers.authorization);
                if (!accessToken) {
                    const error = new Error('Missing Bearer access token');
                    error.statusCode = 401;
                    error.code = 'ACCESS_TOKEN_MISSING';
                    throw error;
                }

                const data = await sessionService.getCurrentAuthContext({
                    accessToken,
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
    };
}

function extractBearerToken(authorization) {
    if (!authorization || typeof authorization !== 'string') {
        return null;
    }

    const [scheme, token] = authorization.trim().split(/\s+/, 2);
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
        return null;
    }
    return token;
}

module.exports = {
    createSessionController,
};
