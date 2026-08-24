function write(level, payload) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    ...payload
  };

  console[level === "error" ? "error" : "log"](JSON.stringify(entry));
}

export function createLogger() {
  return {
    info(payload) {
      write("info", payload);
    },
    warn(payload) {
      write("warn", payload);
    },
    error(payload) {
      write("error", payload);
    }
  };
}
