const crypto = require('crypto');

function requestIdMiddleware(options = {}) {
    const requestIdHeader = (options.requestIdHeader || 'x-request-id').toLowerCase();

    return (req, res, next) => {
        const incoming = req.header(requestIdHeader);
        const requestId = incoming || crypto.randomUUID();

        req.requestId = requestId;
        res.setHeader(requestIdHeader, requestId);

        next();
    };
}

module.exports = {
    requestIdMiddleware,
};
