import { createClient } from "redis";

export function createRedisGatewayStore({ host, port, password } = {}) {
  const client = createClient({
    socket: {
      host,
      port: port ? Number(port) : 6379
    },
    password: password || undefined
  });

  let connectPromise = null;

  async function ensureConnected() {
    if (!connectPromise) {
      connectPromise = client.connect().catch((error) => {
        connectPromise = null;
        throw error;
      });
    }

    await connectPromise;
  }

  return {
    mode: "redis",
    async incrementCounter(key, windowMs) {
      await ensureConnected();
      const count = await client.incr(key);
      if (count === 1) {
        await client.pExpire(key, windowMs);
      }

      const ttl = await client.pTTL(key);
      return {
        count,
        resetAt: Date.now() + Math.max(ttl, 0)
      };
    },
    async getValue(key) {
      await ensureConnected();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    },
    async setValue(key, value, ttlMs) {
      await ensureConnected();
      await client.set(key, JSON.stringify(value), {
        PX: ttlMs
      });
    },
    async isReady() {
      try {
        await ensureConnected();
        await client.ping();
        return true;
      } catch {
        return false;
      }
    },
    async disconnect() {
      if (client.isOpen) {
        await client.quit();
      }
    }
  };
}
