import {
  createErrorResponse,
  createResponse,
  validateDriverPayload,
  validateLocationPayload,
  DRIVER_STATUS,
  DRIVER_AVAILABILITY
} from "../utils/index.js";
import { findDriver, listAvailableDrivers, upsertDriver, updateDriverStatus, updateDriverLocation } from "../models/Driver.js";

import { publishDriverEvent } from "../services/kafka-publisher.js";

import { publishDriverToZone, removeDriverFromZone, publishDriverToGeo } from "../utils/redis.js";


export async function getAvailableDrivers(request, response) {
  try {
    const availableDrivers = await listAvailableDrivers();
    return response.json(
      createResponse({
        message: "Available drivers fetched",
        data: { drivers: availableDrivers },
        request
      })
    );
  } catch (error) {
    console.error("[getAvailableDrivers] error:", error.message);
    return createErrorResponse(response, 500, "Failed to fetch available drivers", request);
  }
}

export async function getDriverById(request, response) {
  try {
    const driver = await findDriver(request.params.driverId);
    if (!driver) {
      return createErrorResponse(response, 404, "Driver not found", request);
    }

    return response.json(
      createResponse({
        message: "Driver fetched",
        data: driver.toObject ? driver.toObject() : driver,
        request
      })
    );
  } catch (error) {
    console.error("[getDriverById] error:", error.message);
    return createErrorResponse(response, 500, "Failed to fetch driver", request);
  }
}

export async function patchDriver(request, response) {
  try {
    const payload = request.body || {};
    if (Object.keys(payload).length === 0) {
      return createErrorResponse(response, 400, "Request payload is required", request);
    }

    const validation = validateDriverPayload(payload);
    if (!validation.success) {
      return createErrorResponse(response, 400, validation.message, request);
    }

    const existingDriver = await findDriver(request.params.driverId);
    const driver = await upsertDriver(request.params.driverId, payload);

    if (!driver) {
      return createErrorResponse(response, 500, "Failed to save driver", request);
    }

    const message = existingDriver ? "Driver updated" : "Driver created";

    // [NHIỆM VỤ 1] Nếu ONLINE thì đẩy vào Redis Geo và Zone
    if (driver.status === DRIVER_STATUS.ONLINE && driver.location?.lat && driver.location?.lng) {
      await publishDriverToGeo(request.params.driverId, driver.location.lat, driver.location.lng);
      await publishDriverToZone(request.params.driverId, driver.location.lat, driver.location.lng);
      console.log(`[STRICT-DEBUG] Dispatched both Geo and Zone for ${request.params.driverId}`);
    }

    return response.json(
      createResponse({
        message,
        data: driver.toObject ? driver.toObject() : driver,
        request
      })
    );
  } catch (error) {
    console.error("[patchDriver] error:", error.message);
    return createErrorResponse(response, 500, "Failed to update driver", request);
  }
}

export async function goOnline(request, response) {
  try {
    const driver = await findDriver(request.params.driverId);
    if (!driver) {
      return createErrorResponse(response, 404, "Driver not found", request);
    }

    const updatedDriver = await updateDriverStatus(request.params.driverId, {
      status: DRIVER_STATUS.ONLINE,
      availability: driver.availability === DRIVER_AVAILABILITY.BUSY ? DRIVER_AVAILABILITY.BUSY : DRIVER_AVAILABILITY.AVAILABLE
    });

    if (!updatedDriver) {
      return createErrorResponse(response, 500, "Failed to update driver status", request);
    }

    // [NHIỆM VỤ 1] Khi Go Online, đẩy tọa độ vào Redis Geo và Zone
    if (updatedDriver.location?.lat && updatedDriver.location?.lng) {
      await publishDriverToGeo(request.params.driverId, updatedDriver.location.lat, updatedDriver.location.lng);
      await publishDriverToZone(request.params.driverId, updatedDriver.location.lat, updatedDriver.location.lng);
      console.log(`[STRICT-DEBUG] goOnline dispatched for ${request.params.driverId}`);
    }

    return response.json(
      createResponse({
        message: "Driver is now ONLINE",
        data: updatedDriver.toObject ? updatedDriver.toObject() : updatedDriver,
        request
      })
    );
  } catch (error) {
    console.error("[goOnline] error:", error.message);
    return createErrorResponse(response, 500, "Failed to go online", request);
  }
}

export async function goOffline(request, response) {
  try {
    const driver = await findDriver(request.params.driverId);
    if (!driver) {
      return createErrorResponse(response, 404, "Driver not found", request);
    }

    // Xóa tài xế khỏi Supply zone trước khi đổi trạng thái
    if (driver.location?.lat != null && driver.location?.lng != null) {
      await removeDriverFromZone(
        request.params.driverId,
        driver.location.lat,
        driver.location.lng
      );
    }

    const updatedDriver = await updateDriverStatus(request.params.driverId, {
      status: DRIVER_STATUS.OFFLINE
    });

    if (!updatedDriver) {
      return createErrorResponse(response, 500, "Failed to update driver status", request);
    }

    return response.json(
      createResponse({
        message: "Driver is now OFFLINE",
        data: updatedDriver.toObject ? updatedDriver.toObject() : updatedDriver,
        request
      })
    );
  } catch (error) {
    console.error("[goOffline] error:", error.message);
    return createErrorResponse(response, 500, "Failed to go offline", request);
  }
}

export async function updateLocation(request, response) {
  try {
    const payload = request.body || {};
    const validation = validateLocationPayload(payload);
    if (!validation.success) {
      return createErrorResponse(response, 400, validation.message, request);
    }

    const driver = await findDriver(request.params.driverId);
    if (!driver) {
      return createErrorResponse(response, 404, "Driver not found", request);
    }

    const updatedDriver = await updateDriverLocation(request.params.driverId, payload);

    if (!updatedDriver) {
      return createErrorResponse(response, 500, "Failed to update location", request);
    }


    await publishDriverEvent(
      "driver.location.updated",
      {
        eventType: "DriverLocationUpdated",
        driverId: request.params.driverId,
        location: {
          lat: payload.lat,
          lng: payload.lng,
          address: payload.address ?? null
        },
        updatedAt: new Date().toISOString()
      },
      request.params.driverId
    );

    // Publish vị trí tài xế vào Redis Supply zone (chỉ khi đang ONLINE)
    if (driver.status === DRIVER_STATUS.ONLINE) {
      await publishDriverToZone(
        request.params.driverId,
        payload.lat,
        payload.lng
      );
    }


    return response.json(
      createResponse({
        message: "Driver location updated",
        data: updatedDriver.toObject ? updatedDriver.toObject() : updatedDriver,
        request
      })
    );
  } catch (error) {
    console.error("[updateLocation] error:", error.message);
    return createErrorResponse(response, 500, "Failed to update location", request);
  }
}

