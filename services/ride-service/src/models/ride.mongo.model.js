import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const RideStatus = {
  REQUESTED: 'REQUESTED',
  SEARCHING: 'SEARCHING',
  WAITING_FOR_ACCEPTANCE: 'WAITING_FOR_ACCEPTANCE',
  ACCEPTED: 'ACCEPTED',
  DRIVER_ARRIVING: 'DRIVER_ARRIVING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED_NO_DRIVER: 'FAILED_NO_DRIVER',
};

const coordinateSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: '' },
  },
  { _id: false }
);

const rideSchema = new Schema(
  {
    rideId: { type: String, required: true, unique: true, index: true },
    bookingId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    driverId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: Object.values(RideStatus),
      default: RideStatus.REQUESTED,
      index: true,
    },
    // Financial Data
    quoteId: { type: String, default: null },
    priceSnapshot: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 0 },
    rideType: { type: String, default: 'bike' },
    paymentStatus: { type: String, default: 'PENDING' },
    paymentId: { type: String, default: null },
    pickup: { type: coordinateSchema, required: true },
    destination: { type: coordinateSchema, required: true },
    currentLocation: { type: coordinateSchema, default: null },
    etaMinutes: { type: Number, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

rideSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const RideMongoModel = model('Ride', rideSchema);

export {
  rideSchema,
};