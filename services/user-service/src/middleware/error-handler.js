import { ZodError } from "zod";
import { ApiError } from "../lib/api-error.js";
import { recordAuditEvent } from "../lib/audit-log.js";
import { sendError } from "../lib/response.js";

export function notFoundHandler(request, response) {
  sendError(response, request, 404, "Route not found");
}

export function errorHandler(error, request, response, _next) {
  if (request.auditEvent && !request.auditLogged) {
    recordAuditEvent(request, {
      ...request.auditEvent,
      outcome: "failure",
      error
    });
    request.auditLogged = true;
  }

  if (error instanceof ZodError) {
    return sendError(response, request, 400, "Validation failed", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (error instanceof ApiError) {
    return sendError(response, request, error.statusCode, error.message, error.details);
  }

  return sendError(response, request, 500, "Internal server error");
}
