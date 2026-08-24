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

  if (normalized === 'customer') {
    return 'Customer';
  }

  if (normalized === 'driver') {
    return 'Driver';
  }

  if (normalized === 'admin') {
    return 'Admin';
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

  const role = normalizeRole(request.headers['x-auth-role']);
  const roles = normalizeList(request.headers['x-auth-roles']).map(normalizeRole).filter(Boolean);
  const subjectId = normalizeValue(request.headers['x-auth-subject-id']);
  const userId = normalizeValue(request.headers['x-auth-user-id']) || subjectId;

  request.auth = {
    subjectId,
    userId,
    accountId: normalizeValue(request.headers['x-auth-account-id']),
    sessionId: normalizeValue(request.headers['x-auth-session-id']),
    role,
    roles: roles.length > 0 ? roles : role ? [role] : [],
    scopes: normalizeList(request.headers['x-auth-scopes']),
    permissions: normalizeList(request.headers['x-auth-permissions']),
    clientType: normalizeValue(request.headers['x-auth-client-type']),
    source: normalizeValue(request.headers['x-auth-context-source'])
  };

  next();
}
import forwardedAuthGuard from '../../../../platform/node/forwarded-auth-guard.cjs';

const { validateForwardedAuthTrust } = forwardedAuthGuard;
