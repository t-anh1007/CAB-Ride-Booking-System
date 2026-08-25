/**
 * Review Store — MongoDB data access for review-service.
 */

import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from "uuid";

const DATABASE_NAME = "cab_booking_review";
const COLLECTION_NAME = "reviews";

export class MongoReviewStore {
  constructor({ client }) {
    this.client = client;
    this.collection = client.db(DATABASE_NAME).collection(COLLECTION_NAME);
  }

  async initialize() {
    await this.collection.createIndex(
      { rideId: 1, userId: 1 },
      { unique: true, name: "rideId_1_userId_1" }
    );
  }

  async createReview(data) {
    const review = {
      reviewId: uuidv4(),
      rideId: data.rideId,
      userId: data.userId,
      driverId: data.driverId,
      rating: data.rating,
      comment: data.comment || null,
      createdAt: new Date().toISOString()
    };

    await this.collection.insertOne(review);
    return serializeReview(review);
  }

  async findByRideId(rideId) {
    const reviews = await this.collection
      .find({ rideId })
      .sort({ createdAt: 1 })
      .toArray();
    return reviews.map(serializeReview);
  }

  async findByDriverId(driverId) {
    const reviews = await this.collection
      .find({ driverId })
      .sort({ createdAt: 1 })
      .toArray();
    return reviews.map(serializeReview);
  }

  async getDriverAverageRating(driverId) {
    const driverReviews = await this.findByDriverId(driverId);

    if (driverReviews.length === 0) {
      return { averageRating: null, totalReviews: 0 };
    }

    const sum = driverReviews.reduce((total, review) => total + review.rating, 0);
    return {
      averageRating: Math.round((sum / driverReviews.length) * 100) / 100,
      totalReviews: driverReviews.length
    };
  }

  async findExistingReview(rideId, userId) {
    return serializeReview(await this.collection.findOne({ rideId, userId }));
  }

  async close() {
    await this.client.close();
  }
}

export async function createMongoReviewStore({ mongoUri = process.env.MONGO_URI } = {}) {
  if (!mongoUri) {
    throw new Error("MONGO_URI is required for review-service");
  }

  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 5_000
  });

  try {
    await client.connect();
    const store = new MongoReviewStore({ client });
    await store.initialize();
    return store;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

function serializeReview(document) {
  if (!document) {
    return null;
  }

  const review = { ...document };
  delete review._id;
  return review;
}
