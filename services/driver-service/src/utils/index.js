import crypto from "crypto";

export const DRIVER_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE"
};

export const DRIVER_AVAILABILITY = {
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY"
};

export function generateUuid() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return [...Array(32)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
}

export function getRequestMeta(request) {
  const requestId =
    request.headers["x-request-id"] || request.headers["x-requestid"] || generateUuid();
  const correlationId =
    request.headers["x-correlation-id"] || request.headers["x-correlationid"] || generateUuid();

  return {
    requestId,
    correlationId,
    timestamp: new Date().toISOString()
  };
}

export function createResponse({ success = true, message = "OK", data = {}, request }) {
  const meta = request ? getRequestMeta(request) : getRequestMeta({ headers: {} });

  return {
    success,
    message,
    data,
    meta
  };
}

export function createErrorResponse(response, statusCode, message, request) {
  response.status(statusCode).json(
    createResponse({
      success: false,
      message,
      data: {},
      request
    })
  );
}

export function validateDriverPayload(payload) {
  const allowedFields = [
    "fullName",
    "phone",
    "vehicleType",
    "vehiclePlate",
    "status",
    "availability",
    "location"
  ];

  const invalidFields = Object.keys(payload).filter((field) => !allowedFields.includes(field));
  if (invalidFields.length) {
    return {
      success: false,
      message: `Invalid field(s): ${invalidFields.join(", ")}`
    };
  }

  if (payload.status && !Object.values(DRIVER_STATUS).includes(payload.status)) {
    return {
      success: false,
      message: `status must be one of ${Object.values(DRIVER_STATUS).join(", ")}`
    };
  }

  if (payload.availability && !Object.values(DRIVER_AVAILABILITY).includes(payload.availability)) {
    return {
      success: false,
      message: `availability must be one of ${Object.values(DRIVER_AVAILABILITY).join(", ")}`
    };
  }

  if (payload.location) {
    const { lat, lng, address } = payload.location;
    if (typeof lat !== "number" || typeof lng !== "number" || typeof address !== "string") {
      return {
        success: false,
        message: "location must include lat, lng, address"
      };
    }
  }

  return { success: true };
}

export function validateLocationPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      success: false,
      message: "Location payload must be an object"
    };
  }

  const { lat, lng, address } = payload;

  if (typeof lat !== "number" || typeof lng !== "number" || typeof address !== "string") {
    return {
      success: false,
      message: "location must include lat (number), lng (number), and address (string)"
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      success: false,
      message: "lat must be between -90 and 90"
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      success: false,
      message: "lng must be between -180 and 180"
    };
  }

  if (address.trim().length === 0) {
    return {
      success: false,
      message: "address cannot be empty"
    };
  }

  return { success: true };
}
