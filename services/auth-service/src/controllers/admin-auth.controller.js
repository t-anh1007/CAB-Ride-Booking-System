function createAdminAuthController(adminAuthService) {
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
    };
}

module.exports = {
    createAdminAuthController,
};
