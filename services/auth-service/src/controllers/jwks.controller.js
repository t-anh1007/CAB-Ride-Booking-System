function createJwksController(jwtService) {
    return {
        getJwks: async (req, res, next) => {
            try {
                const jwks = await jwtService.getJwks();
                return res.status(200).json(jwks);
            } catch (error) {
                return next(error);
            }
        },
    };
}

module.exports = {
    createJwksController,
};
