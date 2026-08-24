function createAuditService(options) {
    const { auditRepository, logger = console } = options;

    return {
        async record(event) {
            if (!auditRepository) {
                return null;
            }

            try {
                return await auditRepository.createEntry({
                    accountId: event.accountId || null,
                    sessionId: event.sessionId || null,
                    eventType: event.eventType,
                    eventStatus: event.eventStatus || 'success',
                    requestId: event.requestId || null,
                    correlationId: event.correlationId || null,
                    actorRole: event.actorRole || null,
                    ipAddress: event.ipAddress || null,
                    userAgent: event.userAgent || null,
                    metadata: event.metadata || {},
                });
            } catch (error) {
                logger.warn('Audit write failed', {
                    eventType: event.eventType,
                    requestId: event.requestId || null,
                    error: error.message,
                });
                return null;
            }
        },
    };
}

module.exports = {
    createAuditService,
};
