const { createApp } = require('./app');
const { loadEnv } = require('./config/env');
const { startServiceServers } = require('../../../platform/node/start-servers.cjs');

async function startServer() {
    const env = loadEnv();
    const app = createApp({ env });
    return startServiceServers({
        app,
        env,
        publicPort: env.port,
        serviceName: 'auth-service',
        logger: console,
    });
}

module.exports = {
    startServer,
};
