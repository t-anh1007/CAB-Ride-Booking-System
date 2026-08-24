function readRuntimeConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__APP_CONFIG__ || {};
}

function normalizeUrl(value, fallback) {
  const raw = String(value || fallback || "").trim();
  return raw.replace(/\/$/, "");
}

function normalizeWsUrl(value, fallback) {
  const raw = normalizeUrl(value, fallback);
  if (raw.startsWith("http://")) {
    return `ws://${raw.slice("http://".length)}`;
  }

  if (raw.startsWith("https://")) {
    return `wss://${raw.slice("https://".length)}`;
  }

  return raw;
}

const runtimeConfig = readRuntimeConfig();

export const env = {
  appName: String(runtimeConfig.APP_NAME || import.meta.env.VITE_APP_NAME || "customer-app").trim(),
  apiBaseUrl: normalizeUrl(runtimeConfig.API_BASE_URL, import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"),
  wsBaseUrl: normalizeWsUrl(runtimeConfig.WS_BASE_URL, import.meta.env.VITE_WS_BASE_URL || "ws://localhost:3000")
};
