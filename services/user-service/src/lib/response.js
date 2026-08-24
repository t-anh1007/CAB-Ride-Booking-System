export function buildMeta(request) {
  return {
    requestId: request.context?.requestId,
    correlationId: request.context?.correlationId,
    timestamp: new Date().toISOString()
  };
}

export function sendSuccess(response, request, statusCode, message, data) {
  response.status(statusCode).json({
    success: true,
    message,
    data,
    meta: buildMeta(request)
  });
}

export function sendError(response, request, statusCode, message, details) {
  response.status(statusCode).json({
    success: false,
    message,
    data: details || null,
    meta: buildMeta(request)
  });
}
