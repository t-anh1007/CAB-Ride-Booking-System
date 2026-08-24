const express = require('express');

const { validationMiddleware } = require('../middleware/validation.middleware');
const { authRateLimitMiddleware } = require('../middleware/auth-rate-limit.middleware');
const { registerSchema, otpRequestSchema, otpVerifySchema } = require('../schemas/otp.schema');

function createPublicAuthRoutes(otpAuthController) {
    const router = express.Router();

    router.post(
        '/register',
        authRateLimitMiddleware,
        validationMiddleware(registerSchema),
        otpAuthController.register
    );

    router.post(
        '/login/otp/request',
        authRateLimitMiddleware,
        validationMiddleware(otpRequestSchema),
        otpAuthController.requestOtp
    );

    router.post(
        '/login/otp/verify',
        authRateLimitMiddleware,
        validationMiddleware(otpVerifySchema),
        otpAuthController.verifyOtp
    );

    return router;
}

module.exports = {
    createPublicAuthRoutes,
};
