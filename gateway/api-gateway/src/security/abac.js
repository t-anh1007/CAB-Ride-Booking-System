import { GatewayError } from "../errors.js";

const ACTIVE_RIDE_STATUSES = new Set(["ACTIVE", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "ONGOING"]);

export async function enforceDriverLocationAbac(auth, payload, options = {}) {
  if (!auth) {
    throw new GatewayError(401, "UNAUTHORIZED", "Authentication is required");
  }

  const isAdmin = auth.role === "Admin" || auth.scopes?.includes("admin:all");
  if (!isAdmin && auth.role !== "Driver") {
    throw new GatewayError(403, "FORBIDDEN", "Only drivers can publish GPS updates");
  }

  if (!payload?.rideId) {
    throw new GatewayError(
      400,
      "INVALID_GPS_PAYLOAD",
      "rideId is required for driver GPS updates"
    );
  }

  if (!isAdmin && !auth.permissions?.includes("location:update:assigned")) {
    throw new GatewayError(
      403,
      "FORBIDDEN",
      "Driver is not allowed to publish GPS updates for assigned rides"
    );
  }

  if (typeof options.resolveRideContext !== "function") {
    return;
  }

  const rideContext = await options.resolveRideContext(payload.rideId, auth);
  if (!rideContext) {
    throw new GatewayError(404, "RIDE_NOT_FOUND", "Ride was not found for GPS authorization");
  }

  const rideStatus = normalizeStatus(rideContext.status);
  if (!ACTIVE_RIDE_STATUSES.has(rideStatus)) {
    throw new GatewayError(
      403,
      "FORBIDDEN",
      `Driver GPS updates are not allowed while ride is ${rideStatus || "UNKNOWN"}`
    );
  }

  if (!isAdmin) {
    const actorDriverId = String(auth.userId || auth.subjectId || "").trim();
    const assignedDriverId = String(rideContext.driverId || "").trim();

    if (!assignedDriverId) {
      throw new GatewayError(
        403,
        "FORBIDDEN",
        "Ride does not currently have an assigned driver for GPS updates"
      );
    }

    if (!actorDriverId || assignedDriverId !== actorDriverId) {
      throw new GatewayError(
        403,
        "FORBIDDEN",
        "Authenticated driver is not the assigned driver for this ride"
      );
    }
  }
}

function normalizeStatus(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim().toUpperCase();
}
