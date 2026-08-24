import { createMemoryGatewayStore } from "./memory-store.js";
import { createRedisGatewayStore } from "./redis-store.js";

export function createGatewayStore({ env = process.env, mode } = {}) {
  const resolvedMode = mode || env.GATEWAY_STORE_MODE || (env.REDIS_HOST ? "redis" : "memory");

  if (resolvedMode === "redis") {
    return createRedisGatewayStore({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD
    });
  }

  return createMemoryGatewayStore();
}
