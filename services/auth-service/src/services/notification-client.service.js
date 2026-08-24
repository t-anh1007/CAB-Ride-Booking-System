function createNotificationClientService(options) {
    const {
        notificationBaseUrl,
        requestIdHeader = 'x-request-id',
        timeoutMs = 5000,
        fetchImpl = fetch,
    } = options;

    return {
        async sendOtp({ destination, channel, role, code, requestId }) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const destinationPayload =
                    channel === 'email'
                        ? { email: destination }
                        : { phoneNumber: destination };

                const response = await fetchImpl(`${notificationBaseUrl}/internal/notifications/send`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        [requestIdHeader]: requestId,
                    },
                    body: JSON.stringify({
                        userId: destination,
                        type: 'AUTH_OTP',
                        title: 'Verification code',
                        channel,
                        destination: destinationPayload,
                        relatedEntityType: 'AUTH',
                        relatedEntityId: `${role}:${destination}`,
                        message: `Your verification code is ${code}.`,
                        metadata: {
                            templateKey: `auth_otp_${role}`,
                            role,
                            variables: { code },
                        },
                    }),
                    signal: controller.signal,
                });

                const payload = await response.json().catch(() => null);
                if (!response.ok || !payload || payload.success !== true) {
                    const error = new Error('OTP delivery failed');
                    error.statusCode = 503;
                    error.code = 'OTP_DELIVERY_UNAVAILABLE';
                    error.details = payload;
                    throw error;
                }

                return payload.data;
            } catch (error) {
                if (error.name === 'AbortError') {
                    const timeoutError = new Error('OTP delivery timed out');
                    timeoutError.statusCode = 503;
                    timeoutError.code = 'OTP_DELIVERY_TIMEOUT';
                    throw timeoutError;
                }
                throw error;
            } finally {
                clearTimeout(timeout);
            }
        },
    };
}

module.exports = {
    createNotificationClientService,
};
