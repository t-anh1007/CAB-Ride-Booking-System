function validationMiddleware(schema, source = 'body') {
    return (req, _res, next) => {
        const payload = req[source];
        const result = schema.safeParse(payload);

        if (result.success) {
            req[source] = result.data;
            return next();
        }

        return next({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: result.error.flatten(),
        });
    };
}

module.exports = {
    validationMiddleware,
};
