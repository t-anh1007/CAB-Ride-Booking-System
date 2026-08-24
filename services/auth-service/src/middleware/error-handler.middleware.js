function buildErrorEnvelope(req, error) {
    return {
        success: false,
        data: null,
        error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message || 'Unexpected server error',
            details: error.details || null,
        },
        meta: {
            requestId: req.requestId || null,
        },
    };
}

function errorHandlerMiddleware(error, req, res, _next) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json(buildErrorEnvelope(req, error));
}

module.exports = {
    errorHandlerMiddleware,
};
