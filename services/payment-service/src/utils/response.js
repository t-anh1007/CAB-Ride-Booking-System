import { nowIso } from './time.js';

export function buildMeta(request) {
  return {
    requestId: request.requestMeta?.requestId || 'uuid',
    correlationId: request.requestMeta?.correlationId || 'uuid',
    timestamp: nowIso()
  };
}

export function sendSuccess(response, request, message, data, statusCode = 200) {
  return response.status(statusCode).json({
    success: true,
    message,
    data,
    meta: buildMeta(request)
  });
}

export function sendError(response, request, message, statusCode = 400, details = null) {
  return response.status(statusCode).json({
    success: false,
    message,
    data: details,
    meta: buildMeta(request)
  });
}
