import { GatewayError } from "../errors.js";
import { extractBearerToken } from "../security/jwt-service.js";

export function createAuthMiddleware({ jwtService }) {
  return async function authMiddleware(request, _response, next) {
    try {
      if (request.method === "OPTIONS" || !request.routeConfig?.isApiRoute) {
        return next();
      }

      if (!request.routeConfig.authRequired) {
        return next();
      }

      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        throw new GatewayError(401, "UNAUTHORIZED", "Bearer token is required");
      }

      request.auth = await jwtService.verifyAccessToken(token, request.context);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
