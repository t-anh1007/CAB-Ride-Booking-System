import { validateForwardedAuthTrust } from '../../../../platform/node/forwarded-auth-guard.cjs';

function authContextMiddleware(req, res, next) {
  const trustCheck = validateForwardedAuthTrust({
    headers: req.headers,
    mtlsClient: req.mtlsClient,
    env: process.env,
  });

  if (!trustCheck.trusted) {
    res.status(trustCheck.statusCode || 403).json({
      success: false,
      message: trustCheck.message,
      statusCode: trustCheck.statusCode || 403,
      error: trustCheck.code,
    });
    return;
  }

  req.auth = extractAuthContext(req.headers);
  next();
}

function extractAuthContext(headers = {}) {
  const role = normalizeRole(headers["x-auth-role"]);
  const roles = normalizeList(headers["x-auth-roles"]).map(normalizeRole).filter(Boolean);
  const scopes = normalizeList(headers["x-auth-scopes"]);
  const permissions = normalizeList(headers["x-auth-permissions"]);
  const subjectId = normalizeValue(headers["x-auth-subject-id"]);
  const userId = normalizeValue(headers["x-auth-user-id"]) || subjectId;

  return {
    subjectId,
    userId,
    accountId: normalizeValue(headers["x-auth-account-id"]),
    sessionId: normalizeValue(headers["x-auth-session-id"]),
    role,
    roles: roles.length > 0 ? roles : role ? [role] : [],
    scopes,
    permissions,
    clientType: normalizeValue(headers["x-auth-client-type"]),
    source: normalizeValue(headers["x-auth-context-source"])
  };
}

function isAdminActor(auth) {
  return auth?.role === "Admin" || auth?.scopes?.includes("admin:all");
}

function isAuthenticatedActor(auth) {
  return Boolean(auth?.subjectId || auth?.userId);
}

function normalizeRole(value) {
  const normalized = normalizeValue(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "customer") {
    return "Customer";
  }

  if (normalized === "driver") {
    return "Driver";
  }

  if (normalized === "admin") {
    return "Admin";
  }

  return normalizeValue(value);
}

function normalizeList(value) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export {
  authContextMiddleware,
  isAdminActor,
  isAuthenticatedActor
};
