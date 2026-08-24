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
      location: payload.location ?? undefined,
      updatedAt: new Date()
    };

    // Remove undefined values to preserve existing data
    Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

    const driver = await DriverModel.findOneAndUpdate(
      { driverId },
      updateData,
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    return driver;
  } catch (error) {
    console.error(`[upsertDriver] error:`, error.message);
    return null;
  }
}

export async function updateDriverStatus(driverId, updates) {
  try {
    // [NEW LOGIC] Khi chuyển status sang ONLINE mà không truyền availability, mặc định là AVAILABLE
    if (updates.status === DRIVER_STATUS.ONLINE && updates.availability === undefined) {
      updates.availability = DRIVER_AVAILABILITY.AVAILABLE;
    }

    const driver = await DriverModel.findOneAndUpdate(
      { driverId },
      { ...updates, updatedAt: new Date() },
      { returnDocument: "after" }
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
      { returnDocument: "after" }
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

