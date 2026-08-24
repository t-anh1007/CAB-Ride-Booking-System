import { GatewayError } from "../errors.js";

export function createValidationMiddleware() {
  return function validationMiddleware(request, _response, next) {
    if (!request.routeConfig?.isApiRoute || !request.routeConfig.validationSchema) {
      return next();
    }

    const result = request.routeConfig.validationSchema.safeParse(request.body);
    if (!result.success) {
      return next(
        new GatewayError(400, "VALIDATION_FAILED", "Request validation failed", {
          data: {
            issues: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message
            }))
          }
        })
      );
    }

    request.body = result.data;
    return next();
  };
}
