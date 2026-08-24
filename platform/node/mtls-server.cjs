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

function loadMtlsConfig(env = process.env, prefix = "INTERNAL_TLS") {
  const enabled = parseBoolean(env[`${prefix}_ENABLED`], false);
  const allowedClients = String(env[`${prefix}_ALLOWED_CLIENTS`] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!enabled) {
    return {
      enabled,
      allowedClients,
    };
  }

  const key = readSecret(env, `${prefix}_KEY`, "");
  const cert = readSecret(env, `${prefix}_CERT`, "");
  const ca = readSecret(env, `${prefix}_CA`, "");

  if (!key || !cert || !ca) {
    throw new Error(`mTLS enabled for ${prefix} but key/cert/ca are missing`);
  }

  return {
    enabled,
    key,
    cert,
    ca,
    allowedClients,
    requestCert: true,
    rejectUnauthorized: true,
    minVersion: "TLSv1.3",
  };
}

function wrapRequestHandlerWithMtls(handler, env = process.env, { prefix = "INTERNAL_TLS" } = {}) {
  const config = loadMtlsConfig(env, prefix);
  if (!config.enabled) {
    return handler;
  }

  return function mtlsProtectedHandler(request, response) {
    if (!request.client?.authorized) {
      writeJson(response, 401, {
        success: false,
        error: "MTLS_CLIENT_CERT_REQUIRED",
        message: "Valid client certificate is required",
      });
      return;
    }

    const peerCertificate = request.socket?.getPeerCertificate?.() || {};
    const commonName = String(peerCertificate?.subject?.CN || "").trim();
    if (config.allowedClients.length > 0 && !config.allowedClients.includes(commonName)) {
      writeJson(response, 403, {
        success: false,
        error: "MTLS_CLIENT_NOT_ALLOWED",
        message: "Client certificate identity is not allowed",
      });
      return;
    }

    request.mtlsClient = {
      commonName,
      authorized: true,
      fingerprint256: peerCertificate?.fingerprint256 || null,
    };

    return handler(request, response);
  };
}

function createServiceServer(handler, env = process.env, { prefix = "INTERNAL_TLS" } = {}) {
  const config = loadMtlsConfig(env, prefix);
  if (!config.enabled) {
    return http.createServer(handler);
  }

  return https.createServer(
    {
      key: config.key,
      cert: config.cert,
      ca: config.ca,
      requestCert: config.requestCert,
      rejectUnauthorized: config.rejectUnauthorized,
      minVersion: config.minVersion,
    },
    wrapRequestHandlerWithMtls(handler, env, { prefix }),
  );
}

function writeJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

module.exports = {
  createServiceServer,
  loadMtlsConfig,
  parseBoolean,
  readSecret,
  wrapRequestHandlerWithMtls,
};
