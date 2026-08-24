import startServersModule from '../../../platform/node/start-servers.cjs';

const { startServiceServers } = startServersModule;

export async function startServer(app, env) {
  const runtime = await startServiceServers({
    app,
    env,
    publicPort: env.port,
    serviceName: 'payment-service',
    logger: console
  });

  console.log(`[payment-service] listening on port ${env.port}`);
  if (runtime.internalPort) {
    console.log(`[payment-service] internal mTLS listening on ${runtime.internalPort}`);
  }

  return runtime;
}
