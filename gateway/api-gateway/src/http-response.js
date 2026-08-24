const STANDARD_KEYS = ["success", "message", "data", "meta"];

export function buildMeta(context) {
  return {
    requestId: context.requestId,
    correlationId: context.correlationId,
    timestamp: new Date().toISOString()
  };
}

export function isNormalizedGatewayBody(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return STANDARD_KEYS.every((key) => key in payload);
}

export function normalizeGatewayResponse({ status, payload, context, defaultMessage }) {
  const meta = buildMeta(context);

  if (isNormalizedGatewayBody(payload)) {
    return {
      ...payload,
      meta: {
        ...(payload.meta || {}),
        ...meta
      }
    };
  }

  const isError = status >= 400;
  const payloadMessage =
    typeof payload === "string"
      ? payload
      : payload?.message || payload?.error || payload?.code || null;

  return {
    success: !isError,
    message: payloadMessage || defaultMessage || (isError ? "Request failed" : "OK"),
    data: extractData(payload, isError),
    meta
  };
}

export function sendNormalizedResponse(response, status, payload, context, defaultMessage) {
  const normalized = normalizeGatewayResponse({
    status,
    payload,
    context,
    defaultMessage
  });

  response.status(status).json(normalized);
}

function extractData(payload, isError) {
  if (payload == null) {
    return null;
  }

  if (typeof payload === "string") {
    return isError ? null : payload;
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  if ("data" in payload) {
    return payload.data;
  }

  if (isError) {
    const { message, error, code, ...rest } = payload;
    return Object.keys(rest).length > 0 ? rest : null;
  }

  return payload;
}
