import { GatewayError, isGatewayError } from "../errors.js";
import { sendNormalizedResponse } from "../http-response.js";

export function createErrorHandlerMiddleware({ logger }) {
  return function errorHandlerMiddleware(error, request, response, _next) {
    const gatewayError = isGatewayError(error)
      ? error
      : new GatewayError(500, "INTERNAL_SERVER_ERROR", "Internal server error", {
          cause: error,
          expose: false
        });

    for (const [key, value] of Object.entries(gatewayError.headers || {})) {
      response.setHeader(key, value);
    }

    logger.error({
      event: "http.request.failed",
      requestId: request.context?.requestId,
      correlationId: request.context?.correlationId,
      path: request.originalUrl,
      method: request.method,
      statusCode: gatewayError.statusCode,
      code: gatewayError.code,
      message: gatewayError.message
    });

    sendNormalizedResponse(
      response,
      gatewayError.statusCode,
      {
        error: gatewayError.code,
        message: gatewayError.expose ? gatewayError.message : "Internal server error",
        data: gatewayError.data
      },
      request.context || {
        requestId: "unknown",
        correlationId: "unknown"
      }
    );
  };
}
