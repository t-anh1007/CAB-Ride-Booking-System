function createOtpAuthController(otpAuthService) {
    return {
        register: async (req, res, next) => {
            try {
                const data = await otpAuthService.register({
                    email: req.body.email,
                    password: req.body.password,
                    name: req.body.name,
                    role: req.body.role || 'customer',
                    requestId: req.requestId,
                });

                return res.status(201).json({
                    success: true,
                    data,
                    error: null,
                    meta: { requestId: req.requestId },
                });
            } catch (error) {
                return next(error);
            }
        },

        requestOtp: async (req, res, next) => {
            try {
                const data = await otpAuthService.requestOtp({
                    role: req.body.role,
                    destination: req.body.destination,
                    channel: req.body.channel,
                    requestId: req.requestId,
                });

                return res.status(202).json({
                    success: true,
                    data,
                    error: null,
                    meta: { requestId: req.requestId },
                });
            } catch (error) {
                return next(error);
            }
        },

        verifyOtp: async (req, res, next) => {
            try {
                const data = await otpAuthService.verifyOtp({
                    role: req.body.role,
                    destination: req.body.destination,
                    code: req.body.code,
                    requestId: req.requestId,
                    userAgent: req.headers['user-agent'] || null,
                    ipAddress: req.ip || null,
                });
                const bootstrapMeta = data && data.bootstrap
                    ? {
                          status: data.bootstrap.status || null,
                          role: data.bootstrap.role || req.body.role || null,
                          service: data.bootstrap.service || null,
                      }
                    : null;

                return res.status(200).json({
                    success: true,
                    data,
                    error: null,
                    meta: {
                        requestId: req.requestId,
                        bootstrap: bootstrapMeta,
                    },
                });
            } catch (error) {
                return next(error);
            }
        },
    };
}

module.exports = {
    createOtpAuthController,
};
