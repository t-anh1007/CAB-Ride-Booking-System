const fs = require("fs");
const http = require("http");
const https = require("https");

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function readSecret(env, name, fallback = "") {
  const filePath = String(env?.[`${name}_FILE`] || "").trim();
  if (filePath) {
    return fs.readFileSync(filePath, "utf8").trim();
  }

  return String(env?.[name] ?? fallback);
}

function createMtlsFetch({ env = process.env, prefix = "INTERNAL_TLS" } = {}) {
  const mtlsEnabled = parseBoolean(env[`${prefix}_ENABLED`], false);
  const ca = readSecret(env, `${prefix}_CA`, "");
  const cert = readSecret(env, `${prefix}_CLIENT_CERT`, readSecret(env, `${prefix}_CERT`, ""));
  const key = readSecret(env, `${prefix}_CLIENT_KEY`, readSecret(env, `${prefix}_KEY`, ""));
  const clientTlsOptions = mtlsEnabled
    ? {
        ca: ca || undefined,
        cert: cert || undefined,
        key: key || undefined,
        minVersion: "TLSv1.3",
        rejectUnauthorized: true,
      }
    : {};

  return async function mtlsFetch(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : String(input));
    const method = String(init.method || "GET").toUpperCase();
    const headers = normalizeHeaders(init.headers);
    const body = init.body;

    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method,
      headers,
    };

    if (url.protocol === "https:" && mtlsEnabled) {
      Object.assign(options, clientTlsOptions, {
        servername: String(env[`${prefix}_SERVERNAME`] || url.hostname),
      });
    }

    return await new Promise((resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      const request = transport.request(options, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          resolve(createResponse(response, rawBody));
        });
      });

      request.on("error", reject);

      if (init.signal) {
        const abortHandler = () => {
          const abortError = new Error("This operation was aborted");
          abortError.name = "AbortError";
          request.destroy(abortError);
        };

        if (init.signal.aborted) {
          abortHandler();
          return;
        }

        init.signal.addEventListener("abort", abortHandler, { once: true });
        request.on("close", () => init.signal.removeEventListener("abort", abortHandler));
      }

      if (body != null) {
        request.write(body);
      }

      request.end();
    });
  };
}

function createResponse(response, rawBody) {
  const normalizedHeaders = new Map();
  for (const [key, value] of Object.entries(response.headers || {})) {
    if (Array.isArray(value)) {
      normalizedHeaders.set(key.toLowerCase(), value.join(", "));
    } else if (value != null) {
      normalizedHeaders.set(key.toLowerCase(), String(value));
    }
  }

  return {
    status: response.statusCode || 0,
    ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
    headers: {
      get(name) {
        return normalizedHeaders.get(String(name || "").toLowerCase()) || null;
      },
      entries() {
        return normalizedHeaders.entries();
      },
    },
    async text() {
      return rawBody;
    },
    async json() {
      if (!rawBody) {
        return null;
      }
      return JSON.parse(rawBody);
    },
  };
}

function normalizeHeaders(headers) {
  if (!headers) {
    return {};
  }

  if (typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }

  return { ...headers };
}

module.exports = {
  createMtlsFetch,
  parseBoolean,
  readSecret,
};
