export function createMemoryGatewayStore() {
  const counters = new Map();
  const values = new Map();

  return {
    mode: "memory",
    async incrementCounter(key, windowMs) {
      const now = Date.now();
      const current = counters.get(key);

      if (!current || current.resetAt <= now) {
        const nextValue = {
          count: 1,
          resetAt: now + windowMs
        };
        counters.set(key, nextValue);
        return nextValue;
      }

      current.count += 1;
      return current;
    },
    async getValue(key) {
      const current = values.get(key);
      if (!current) {
        return null;
      }

      if (current.expiresAt <= Date.now()) {
        values.delete(key);
        return null;
      }

      return current.value;
    },
    async setValue(key, value, ttlMs) {
      values.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
      });
    },
    async isReady() {
      return true;
    },
    async disconnect() {}
  };
}
