const http = require("http");
const mtlsServer = require("./mtls-server.cjs");

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.listen(port, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function startServiceServers({
  app,
  env = process.env,
  publicPort,
  serviceName = "service",
  logger = console,
  prefix = "INTERNAL_TLS"
}) {
  if (!app) {
    throw new Error("app is required to start service servers");
  }

  const { createServiceServer, loadMtlsConfig } = mtlsServer;
  const publicServer = http.createServer(app);
  const resolvedPublicPort = Number(publicPort || env.PORT || 3000);

  await listen(publicServer, resolvedPublicPort);

  const mtlsConfig = loadMtlsConfig(env, prefix);
  let internalServer = null;
  let internalPort = null;

  if (mtlsConfig.enabled) {
    internalPort = Number(env[`${prefix}_PORT`] || 0);
    if (!internalPort) {
      throw new Error(`mTLS enabled for ${serviceName} but ${prefix}_PORT is missing`);
    }

    internalServer = createServiceServer(app, env, { prefix });
    await listen(internalServer, internalPort);
  }

  logger.info?.({
    event: "service.started",
    service: serviceName,
    port: resolvedPublicPort,
    internalTlsEnabled: mtlsConfig.enabled,
    internalTlsPort: internalPort
  });

  return {
    publicPort: resolvedPublicPort,
    internalPort,
    publicServer,
    internalServer,
    async close() {
      await closeServer(internalServer);
      await closeServer(publicServer);
    }
  };
}

function closeServer(server) {
  if (!server?.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  startServiceServers
};
