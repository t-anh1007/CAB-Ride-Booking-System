const express = require('express');

function createJwksRoutes(jwksController) {
    const router = express.Router();

    router.get('/.well-known/jwks.json', jwksController.getJwks);

    return router;
}

module.exports = {
    createJwksRoutes,
};
