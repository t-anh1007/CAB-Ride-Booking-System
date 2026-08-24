import { GatewayError } from "../errors.js";

export function createAuthorizationMiddleware() {
  return function authorizationMiddleware(request, _response, next) {
    if (!request.routeConfig?.isApiRoute || !request.routeConfig.authRequired) {
      return next();
    }

    const auth = request.auth || {};
    const allowedRoles = request.routeConfig.allowedRoles || [];
    if (allowedRoles.length === 0) {
      return validateScopesAndPermissions(auth, request.routeConfig, next);
    }

    if (!auth.role || !allowedRoles.includes(auth.role)) {
      return next(new GatewayError(403, "FORBIDDEN", "You do not have permission to access this resource"));
    }

    return validateScopesAndPermissions(auth, request.routeConfig, next);
  };
}

function validateScopesAndPermissions(auth, routeConfig, next) {
  const hasAdminScope = auth.scopes?.includes("admin:all");
  const requiredScopes = routeConfig.requiredScopes || [];
  const requiredPermissions = routeConfig.requiredPermissions || [];

  if (!hasAdminScope && requiredScopes.length > 0) {
    const missingScopes = requiredScopes.filter((scope) => !auth.scopes?.includes(scope));
    if (missingScopes.length > 0) {
      return next(new GatewayError(403, "FORBIDDEN", "Missing required scope for this resource"));
    }
  }

  if (!hasAdminScope && requiredPermissions.length > 0) {
    const missingPermissions = requiredPermissions.filter((permission) => !auth.permissions?.includes(permission));
    if (missingPermissions.length > 0) {
      return next(new GatewayError(403, "FORBIDDEN", "Missing required permission for this resource"));
    }
  }

  return next();
}
