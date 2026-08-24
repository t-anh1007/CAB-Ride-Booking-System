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

function extractAuthContext(headers = {}) {
  const role = normalizeRole(headers["x-auth-role"]);
  const roles = normalizeList(headers["x-auth-roles"]).map(normalizeRole).filter(Boolean);
  const subjectId = normalizeValue(headers["x-auth-subject-id"]);
  const userId = normalizeValue(headers["x-auth-user-id"]) || subjectId;

  return {
    subjectId,
    userId,
    accountId: normalizeValue(headers["x-auth-account-id"]),
    sessionId: normalizeValue(headers["x-auth-session-id"]),
    role,
    roles: roles.length > 0 ? roles : role ? [role] : [],
    scopes: normalizeList(headers["x-auth-scopes"]),
    permissions: normalizeList(headers["x-auth-permissions"]),
    clientType: normalizeValue(headers["x-auth-client-type"]),
    source: normalizeValue(headers["x-auth-context-source"])
  };
}

export function authContextMiddleware(request, response, next) {
  const trustCheck = validateForwardedAuthTrust({
    headers: request.headers,
    mtlsClient: request.mtlsClient,
    env: process.env
  });

  if (!trustCheck.trusted) {
    response.status(trustCheck.statusCode || 403).json({
      success: false,
      message: trustCheck.message,
      error: trustCheck.code
    });
    return;
  }

  request.auth = extractAuthContext(request.headers);
  next();
}

export function isAuthenticatedActor(auth) {
  return Boolean(auth?.subjectId || auth?.userId);
}

export function isAdminActor(auth) {
  return auth?.role === "Admin" || auth?.scopes?.includes("admin:all");
}
import forwardedAuthGuard from "../../../../platform/node/forwarded-auth-guard.cjs";

const { validateForwardedAuthTrust } = forwardedAuthGuard;
