const express = require('express');

const { validationMiddleware } = require('../middleware/validation.middleware');
const { authRateLimitMiddleware } = require('../middleware/auth-rate-limit.middleware');
const {
    refreshSchema,
    logoutSchema,
    logoutAllSchema,
    oauthTokenSchema,
    oauthRevokeSchema,
} = require('../schemas/session.schema');

function createSessionRoutes(sessionController) {
    const router = express.Router();

    router.post('/refresh', authRateLimitMiddleware, validationMiddleware(refreshSchema), sessionController.refresh);
    router.post('/oauth/token', authRateLimitMiddleware, validationMiddleware(oauthTokenSchema), sessionController.oauthToken);
    router.post('/logout', authRateLimitMiddleware, validationMiddleware(logoutSchema), sessionController.logout);
    router.post('/oauth/revoke', authRateLimitMiddleware, validationMiddleware(oauthRevokeSchema), sessionController.oauthRevoke);
    router.post('/logout-all', authRateLimitMiddleware, validationMiddleware(logoutAllSchema), sessionController.logoutAll);
    router.get('/me', authRateLimitMiddleware, sessionController.me);

    return router;
}

module.exports = {
    createSessionRoutes,
};
