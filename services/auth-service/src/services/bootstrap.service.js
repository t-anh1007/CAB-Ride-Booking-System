function createBootstrapService(options) {
    const {
        userServiceBaseUrl,
        driverServiceBaseUrl,
        userServiceTimeoutMs = 4000,
        driverServiceTimeoutMs = 4000,
        requestIdHeader = 'x-request-id',
        fetchImpl = fetch,
        logger = console,
    } = options;

    return {
        async bootstrapProfile({ role, subjectId, accountId, requestId }) {
            if (!subjectId) {
                return {
                    status: 'failed',
                    role,
                    reason: 'missing_subject_id',
                };
            }

            if (role === 'customer') {
                return callBootstrapEndpoint({
                    serviceName: 'user-service',
                    endpoint: `${userServiceBaseUrl}/internal/users/bootstrap`,
                    timeoutMs: userServiceTimeoutMs,
                    requestIdHeader,
                    requestId,
                    fetchImpl,
                    logger,
                    body: {
                        subjectId,
                        accountId,
                    },
                });
            }

            if (role === 'driver') {
                return callBootstrapEndpoint({
                    serviceName: 'driver-service',
                    endpoint: `${driverServiceBaseUrl}/internal/drivers/bootstrap`,
                    timeoutMs: driverServiceTimeoutMs,
                    requestIdHeader,
                    requestId,
                    fetchImpl,
                    logger,
                    body: {
                        subjectId,
                        accountId,
                    },
                });
            }

            return {
                status: 'skipped',
                role,
                reason: 'bootstrap_not_required_for_role',
            };
        },
    };
}

async function callBootstrapEndpoint(options) {
    const {
        serviceName,
        endpoint,
        timeoutMs,
        requestIdHeader,
        requestId,
        fetchImpl,
        logger,
        body,
    } = options;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                [requestIdHeader]: requestId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || payload.success !== true) {
            logger.error('Profile bootstrap request failed', {
                service: serviceName,
                requestId,
                statusCode: response.status,
                payload,
            });

            return {
                status: 'failed',
                service: serviceName,
                errorCode: 'BOOTSTRAP_REQUEST_FAILED',
                statusCode: response.status,
            };
        }

        return {
            status: 'success',
            service: serviceName,
            profile: payload.data,
            idempotent: Boolean(payload.meta && payload.meta.idempotent),
        };
    } catch (error) {
        const isTimeout = error && error.name === 'AbortError';
        logger.error('Profile bootstrap request error', {
            service: serviceName,
            requestId,
            error: error && error.message ? error.message : error,
        });

        return {
            status: 'failed',
            service: serviceName,
            errorCode: isTimeout ? 'BOOTSTRAP_TIMEOUT' : 'BOOTSTRAP_UNAVAILABLE',
        };
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    createBootstrapService,
};
