const FORWARDED_AUTH_HEADERS = [
  "x-auth-subject-id",
  "x-auth-user-id",
  "x-auth-account-id",
  "x-auth-session-id",
  "x-auth-role",
  "x-auth-roles",
  "x-auth-scopes",
  "x-auth-permissions",
  "x-auth-client-type",
  "x-auth-context-source"
];

export function isForwardedAuthHeader(headerName) {
  return typeof headerName === "string" && headerName.toLowerCase().startsWith("x-auth-");
}

export function applyForwardedAuthHeaders(headers, auth) {
  for (const headerName of FORWARDED_AUTH_HEADERS) {
    headers.delete(headerName);
  }

  if (!auth) {
    return headers;
  }

  setIfPresent(headers, "x-auth-subject-id", auth.subjectId || auth.subject);
  setIfPresent(headers, "x-auth-user-id", auth.userId);
  setIfPresent(headers, "x-auth-account-id", auth.accountId);
  setIfPresent(headers, "x-auth-session-id", auth.sessionId);
  setIfPresent(headers, "x-auth-role", auth.role);
  setIfPresent(headers, "x-auth-roles", normalizeArray(auth.roles).join(","));
  setIfPresent(headers, "x-auth-scopes", normalizeArray(auth.scopes).join(" "));
  setIfPresent(headers, "x-auth-permissions", normalizeArray(auth.permissions).join(","));
  setIfPresent(headers, "x-auth-client-type", auth.clientType);
  headers.set("x-auth-context-source", "api-gateway");

  return headers;
}

function setIfPresent(headers, headerName, value) {
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized == null || normalized === "") {
    headers.delete(headerName);
    return;
  }

  headers.set(headerName, String(normalized));
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}
