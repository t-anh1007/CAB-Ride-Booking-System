function createTokenService(options) {
    const { sessionService } = options;

    return {
        async issueOtpLoginTokens({ account, role, userAgent = null, ipAddress = null, requestId = null }) {
            return sessionService.issueInitialSession({
                account,
                role,
                userAgent,
                ipAddress,
                requestId,
            });
        },
    };
}

module.exports = {
    createTokenService,
};
