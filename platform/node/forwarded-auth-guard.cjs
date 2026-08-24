const { parseBoolean } = require("./mtls-client.cjs");

function hasForwardedAuthHeaders(headers = {}) {
  return Object.keys(headers || {}).some((headerName) =>
    String(headerName || "").toLowerCase().startsWith("x-auth-"),
  );
}

function validateForwardedAuthTrust({
  headers = {},
  mtlsClient = null,
  env = process.env,
  requiredSource = "api-gateway",
} = {}) {
  if (!hasForwardedAuthHeaders(headers)) {
    return { trusted: true };
  }

  const requireMtls = parseBoolean(
    env.REQUIRE_MTLS_FOR_FORWARDED_AUTH,
    parseBoolean(env.INTERNAL_TLS_ENABLED, false),
  );

  if (!requireMtls) {
    return { trusted: true };
  }

  if (!mtlsClient?.authorized) {
    return {
      trusted: false,
      statusCode: 403,
      code: "FORWARDED_AUTH_REQUIRES_MTLS",
      message: "Forwarded auth context is only trusted over mutually authenticated TLS",
    };
  }

  const source = normalizeValue(headers["x-auth-context-source"]);
  if (requiredSource && source !== requiredSource) {
    return {
      trusted: false,
      statusCode: 403,
      code: "FORWARDED_AUTH_INVALID_SOURCE",
      message: `Forwarded auth context must originate from ${requiredSource}`,
    };
  }

  return { trusted: true };
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return normalizeValue(value[0]);
  }

  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

module.exports = {
  hasForwardedAuthHeaders,
  validateForwardedAuthTrust,
};
