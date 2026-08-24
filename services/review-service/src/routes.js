/**
 * Review Routes — REST API handlers for review-service.
 *
 * Endpoints:
 *   POST   /api/v1/reviews                  → Gửi đánh giá chuyến đi
 *   GET    /api/v1/reviews/ride/:rideId      → Xem đánh giá theo chuyến
 *   GET    /api/v1/reviews/driver/:driverId  → Xem đánh giá theo tài xế
 *   GET    /api/v1/reviews/driver/:driverId/average → Điểm đánh giá trung bình
 *
 * Response envelope follows the gateway's normalized format:
 *   { success, message, data, meta: { requestId, correlationId, timestamp } }
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  createReview,
  findByRideId,
  findByDriverId,
  getDriverAverageRating,
  findExistingReview
} from "./store.js";

export function createReviewRouter({ broker }) {
  const router = Router();

  // ──────────────────────────────────────────────────────────────
  // POST /api/v1/reviews — Gửi đánh giá chuyến đi
  // ──────────────────────────────────────────────────────────────
  router.post("/api/v1/reviews", async (request, response) => {
    const meta = buildMeta();

    try {
      const { rideId, userId, driverId, rating, comment } = request.body;

      // --- Validation (defense-in-depth; gateway validates too) ---
      if (!rideId || !userId || !driverId || rating == null) {
        return response.status(400).json({
          success: false,
          message: "Missing required fields: rideId, userId, driverId, rating",
          data: null,
          meta
        });
      }

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return response.status(400).json({
          success: false,
          message: "Rating must be an integer between 1 and 5",
          data: null,
          meta
        });
      }

      // --- Idempotency: one review per user per ride ---
      const existing = findExistingReview(rideId, userId);
      if (existing) {
        return response.status(409).json({
          success: false,
          message: "User has already reviewed this ride",
          data: existing,
          meta
        });
      }

      // --- Persist ---
      const review = createReview({ rideId, userId, driverId, rating, comment });

      // --- Publish event (non-blocking) ---
      publishReviewCreated(broker, review);

      return response.status(201).json({
        success: true,
        message: "Review created",
        data: review,
        meta
      });
    } catch (error) {
      console.error("[review-service] POST /api/v1/reviews error:", error);

      return response.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
        meta
      });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // GET /api/v1/reviews/ride/:rideId — Đánh giá theo chuyến đi
  // ──────────────────────────────────────────────────────────────
  router.get("/api/v1/reviews/ride/:rideId", (request, response) => {
    const meta = buildMeta();

    try {
      const reviews = findByRideId(request.params.rideId);

      return response.status(200).json({
        success: true,
        message: reviews.length > 0 ? "Reviews found" : "No reviews found for this ride",
        data: reviews,
        meta
      });
    } catch (error) {
      console.error("[review-service] GET /ride/:rideId error:", error);

      return response.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
        meta
      });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // GET /api/v1/reviews/driver/:driverId — Đánh giá theo tài xế
  // ──────────────────────────────────────────────────────────────
  router.get("/api/v1/reviews/driver/:driverId", (request, response) => {
    const meta = buildMeta();

    try {
      const reviews = findByDriverId(request.params.driverId);
      const { averageRating, totalReviews } = getDriverAverageRating(request.params.driverId);

      return response.status(200).json({
        success: true,
        message: reviews.length > 0 ? "Reviews found" : "No reviews found for this driver",
        data: {
          driverId: request.params.driverId,
          averageRating,
          totalReviews,
          reviews
        },
        meta
      });
    } catch (error) {
      console.error("[review-service] GET /driver/:driverId error:", error);

      return response.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
        meta
      });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // GET /api/v1/reviews/driver/:driverId/average — Điểm trung bình
  // ──────────────────────────────────────────────────────────────
  router.get("/api/v1/reviews/driver/:driverId/average", (request, response) => {
    const meta = buildMeta();

    try {
      const { averageRating, totalReviews } = getDriverAverageRating(request.params.driverId);

      return response.status(200).json({
        success: true,
        message: totalReviews > 0 ? "Average rating calculated" : "No reviews available",
        data: {
          driverId: request.params.driverId,
          averageRating,
          totalReviews
        },
        meta
      });
    } catch (error) {
      console.error("[review-service] GET /driver/:driverId/average error:", error);

      return response.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
        meta
      });
    }
  });

  return router;
}

// ── Helpers ──────────────────────────────────────────────────────

function buildMeta() {
  return {
    requestId: uuidv4(),
    correlationId: uuidv4(),
    timestamp: new Date().toISOString()
  };
}

function publishReviewCreated(broker, review) {
  if (!broker || !broker.connected) {
    return;
  }

  try {
    console.log("[review-service] Publishing ReviewCreated event:", {
      topic: "review.created",
      reviewId: review.reviewId,
      rideId: review.rideId,
      driverId: review.driverId,
      rating: review.rating
    });
  } catch (error) {
    // Non-blocking — log and move on (eventual consistency)
    console.error("[review-service] Failed to publish ReviewCreated:", error);
  }
}
