# Driver Service - MongoDB Integration

## Overview
The Driver Service has been updated to use MongoDB with Mongoose for persistent storage instead of in-memory storage. This document provides a complete overview of the changes and implementation.

## Environment Configuration

### .env File Location
`services/driver-service/.env`

### Environment Variables
```
MONGO_URI=mongodb://localhost:27017/cab-booking
PORT=3107
```

## Dependencies Added
- `mongoose` (^8.0.0) - MongoDB ODM
- `dotenv` (^16.0.3) - Environment variable management

Install with: `npm install`

## File Structure
```
services/driver-service/
├── src/
│   ├── index.js                 # Service entry point with MongoDB connection
│   ├── controllers/
│   │   └── driverController.js   # Request handlers (async, uses mongoose)
│   ├── models/
│   │   └── Driver.js            # Mongoose schema and model
│   ├── routes/
│   │   └── index.js             # Express router with all endpoints
│   └── utils/
│       └── index.js             # Helper functions and validators
├── package.json                 # Updated dependencies
├── .env                         # Environment configuration
└── POSTMAN_TESTS.md            # API test examples
```

## Updated Code

### 1. index.js - Main Entry Point

```javascript
import dotenv from "dotenv";
import mongoose from "mongoose";
import { startService } from "../../../platform/node/create-service-app.js";

// Load environment variables from .env file
dotenv.config({ path: new URL(".env", import.meta.url).pathname });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/cab-booking";
const PORT = process.env.PORT || 3107;

async function initializeService() {
  try {
    // Connect to MongoDB
    console.log(`[driver-service] Connecting to MongoDB at ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log("[driver-service] MongoDB connected successfully");

    // Start the service
    process.env.PORT = PORT;
    await startService("driver-service");
  } catch (error) {
    console.error("[driver-service] Initialization failed:", error.message);
    if (error.name === "MongoServerError" || error.name === "MongoNetworkError") {
      console.error("[driver-service] MongoDB connection failed. Make sure MongoDB is running at:", MONGO_URI);
    }
    process.exit(1);
  }
}

initializeService();
```

### 2. models/Driver.js - Mongoose Schema & Model

```javascript
import mongoose from "mongoose";
import { DRIVER_STATUS, DRIVER_AVAILABILITY } from "../utils/index.js";

const driverSchema = new mongoose.Schema(
  {
    driverId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    fullName: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      default: null
    },
    vehicleType: {
      type: String,
      enum: ["bike", "car", "van"],
      default: null
    },
    vehiclePlate: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: [DRIVER_STATUS.ONLINE, DRIVER_STATUS.OFFLINE],
      default: DRIVER_STATUS.OFFLINE
    },
    availability: {
      type: String,
      enum: [DRIVER_AVAILABILITY.AVAILABLE, DRIVER_AVAILABILITY.BUSY],
      default: DRIVER_AVAILABILITY.BUSY
    },
    location: {
      lat: {
        type: Number,
        default: null
      },
      lng: {
        type: Number,
        default: null
      },
      address: {
        type: String,
        default: null
      }
    },
    updatedAt: {
      type: Date,
      default: () => new Date()
    }
  },
  {
    // Prevent automatic __v field
    versionKey: false,
    // Set timestamps: createdAt, updatedAt
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const DriverModel = mongoose.model("Driver", driverSchema);

export async function findDriver(driverId) {
  try {
    return await DriverModel.findOne({ driverId });
  } catch (error) {
    console.error(`[findDriver] error:`, error.message);
    return null;
  }
}

export async function upsertDriver(driverId, payload) {
  try {
    const updateData = {
      fullName: payload.fullName ?? undefined,
      phone: payload.phone ?? undefined,
      vehicleType: payload.vehicleType ?? undefined,
      vehiclePlate: payload.vehiclePlate ?? undefined,
      status: payload.status ?? undefined,
      availability: payload.availability ?? undefined,
      updatedAt: new Date()
    };

    // Remove undefined values to preserve existing data
    Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

    const driver = await DriverModel.findOneAndUpdate(
      { driverId },
      updateData,
      { upsert: true, new: true, runValidators: true }
    );

    return driver;
  } catch (error) {
    console.error(`[upsertDriver] error:`, error.message);
    return null;
  }
}

export async function updateDriverStatus(driverId, updates) {
  try {
    const driver = await DriverModel.findOneAndUpdate(
      { driverId },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    return driver;
  } catch (error) {
    console.error(`[updateDriverStatus] error:`, error.message);
    return null;
  }
}

export async function updateDriverLocation(driverId, location) {
  try {
    const driver = await DriverModel.findOneAndUpdate(
      { driverId },
      {
        location: {
          lat: location.lat,
          lng: location.lng,
          address: location.address
        },
        updatedAt: new Date()
      },
      { new: true }
    );

    return driver;
  } catch (error) {
    console.error(`[updateDriverLocation] error:`, error.message);
    return null;
  }
}

export async function listAvailableDrivers() {
  try {
    return await DriverModel.find({
      status: DRIVER_STATUS.ONLINE,
      availability: DRIVER_AVAILABILITY.AVAILABLE
    });
  } catch (error) {
    console.error(`[listAvailableDrivers] error:`, error.message);
    return [];
  }
}
```

### 3. controllers/driverController.js - Request Handlers

All functions are now async and use mongoose operations.

```javascript
import {
  createErrorResponse,
  createResponse,
  validateDriverPayload,
  validateLocationPayload,
  DRIVER_STATUS,
  DRIVER_AVAILABILITY
} from "../utils/index.js";
import { findDriver, listAvailableDrivers, upsertDriver, updateDriverStatus, updateDriverLocation } from "../models/Driver.js";

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
```

### 4. routes/index.js - Express Router

```javascript
import express from "express";
import {
  getAvailableDrivers,
  getDriverById,
  patchDriver,
  goOnline,
  goOffline,
  updateLocation
} from "../controllers/driverController.js";

const router = express.Router();

router.get("/available", getAvailableDrivers);
router.get("/:driverId", getDriverById);
router.patch("/:driverId", patchDriver);
router.patch("/:driverId/location", updateLocation);
router.post("/:driverId/go-online", goOnline);
router.post("/:driverId/go-offline", goOffline);

export default router;
```

### 5. utils/index.js - Added Location Validator

Added the `validateLocationPayload` function to existing utils:

```javascript
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
```

## MongoDB Schema

The Driver collection has the following structure:

```javascript
{
  driverId: string (unique, indexed),
  fullName: string,
  phone: string,
  vehicleType: string (enum: "bike", "car", "van"),
  vehiclePlate: string,
  status: string (enum: "ONLINE", "OFFLINE"),
  availability: string (enum: "AVAILABLE", "BUSY"),
  location: {
    lat: number,
    lng: number,
    address: string
  },
  createdAt: timestamp (auto-generated),
  updatedAt: timestamp,
  __v: number (excluded)
}
```

## API Endpoints

### 1. PATCH /api/v1/drivers/:driverId
Create or update driver profile

### 2. GET /api/v1/drivers/:driverId
Get driver details by ID

### 3. POST /api/v1/drivers/:driverId/go-online
Set driver online

### 4. POST /api/v1/drivers/:driverId/go-offline
Set driver offline

### 5. GET /api/v1/drivers/available
List all available drivers (ONLINE + AVAILABLE)

### 6. PATCH /api/v1/drivers/:driverId/location
Update driver's current location

## Standard Response Format

All APIs return responses in this format:

```json
{
  "success": true,
  "message": "Operation message",
  "data": {},
  "meta": {
    "requestId": "uuid",
    "correlationId": "uuid",
    "timestamp": "ISO 8601 timestamp"
  }
}
```

## Running the Service

```bash
# Install dependencies
npm install

# Start the service (requires MongoDB)
npm run dev:driver-service

# Or manually
node src/index.js
```

## Prerequisites

- Node.js 18+
- MongoDB 5.0+
- MongoDB running on `localhost:27017` (default) or update MONGO_URI in .env

## Testing

See `POSTMAN_TESTS.md` for complete API test examples.

For quick testing:

```bash
# In another terminal while service is running
curl -X GET http://localhost:3107/api/v1/drivers/available
```

## Error Handling

All endpoints include comprehensive error handling:
- Database connection errors
- Validation errors
- Not found errors
- Server errors

Errors return appropriate HTTP status codes (400, 404, 500) with descriptive messages.
