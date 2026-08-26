const express = require('express');

const { validationMiddleware } = require('../middleware/validation.middleware');
const { authRateLimitMiddleware } = require('../middleware/auth-rate-limit.middleware');
const { adminLoginSchema, mfaChallengeSchema } = require('../schemas/admin-auth.schema');

function createAdminAuthRoutes(adminAuthController) {
    const router = express.Router();

    router.post('/login/admin', authRateLimitMiddleware, validationMiddleware(adminLoginSchema), adminAuthController.loginAdmin);
    router.post('/mfa/challenge', authRateLimitMiddleware, validationMiddleware(mfaChallengeSchema), adminAuthController.mfaChallenge);
    router.get('/admin/audit', adminAuthController.listAudit);

    return router;
}

module.exports = {
    createAdminAuthRoutes,
};
