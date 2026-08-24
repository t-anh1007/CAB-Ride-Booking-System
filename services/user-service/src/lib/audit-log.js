export function recordAuditEvent(request, {
  action,
  targetType = "user",
  targetId = null,
  outcome = "success",
  metadata = {},
  error = null
}) {
  const actor = request.auth || {};
  const payload = {
    event: "audit",
    service: "user-service",
    action,
    targetType,
    targetId,
    outcome,
    actor: {
      subjectId: actor.subjectId || null,
      userId: actor.userId || null,
      role: actor.role || null,
      scopes: Array.isArray(actor.scopes) ? actor.scopes : [],
      permissions: Array.isArray(actor.permissions) ? actor.permissions : []
    },
    requestId: request.context?.requestId || null,
    correlationId: request.context?.correlationId || null,
    ipAddress: request.ip || request.get?.("x-forwarded-for") || null,
    userAgent: request.get?.("user-agent") || null,
    metadata: sanitizeMetadata(metadata),
    timestamp: new Date().toISOString()
  };

  if (error) {
    payload.error = {
      message: error.message || "Unknown error",
      statusCode: error.statusCode || null
    };
  }

  const logger = outcome === "failure" ? console.warn : console.info;
  logger("[user-service/audit]", JSON.stringify(payload));
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (value == null) {
        return [key, value];
      }

      if (typeof value === "object") {
        return [key, JSON.parse(JSON.stringify(value))];
      }

      return [key, value];
    })
  );
}
