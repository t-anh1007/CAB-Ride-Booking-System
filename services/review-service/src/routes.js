/**
 * Review Routes — REST API handlers for review-service.
 *
 * Endpoints:
 *   POST /api/v1/reviews                          → Gửi đánh giá
 *   GET  /api/v1/reviews/ride/:rideId             → Đánh giá theo chuyến đi
 *   GET  /api/v1/reviews/driver/:driverId         → Đánh giá theo tài xế
 *   GET  /api/v1/reviews/driver/:driverId/average → Điểm đánh giá trung bình
 *
 * Response envelope follows the gateway's normalized format:
 *   { success, message, data, meta: { requestId, correlationId, timestamp } }
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

export function createReviewRouter({ store, publisher, logger = console }) {
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
      const existing = await store.findExistingReview(rideId, userId);
      if (existing) {
        return duplicateResponse(response, meta, existing);
      }

      // --- Persist ---
      let review;
      try {
        review = await store.createReview({ rideId, userId, driverId, rating, comment });
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }

        const duplicate = await store.findExistingReview(rideId, userId);
        return duplicateResponse(response, meta, duplicate);
      }

      // --- Publish event without changing a successful response on failure ---
      publishReviewCreated(publisher, review, logger);

      return response.status(201).json({
        success: true,
        message: "Review created",
        data: review,
        meta
      });
    } catch (error) {
      logger.error?.("[review-service] POST /api/v1/reviews error:", error);

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
  router.get("/api/v1/reviews/ride/:rideId", async (request, response) => {
    const meta = buildMeta();

    try {
      const reviews = await store.findByRideId(request.params.rideId);

      return response.status(200).json({
        success: true,
        message: reviews.length > 0 ? "Reviews found" : "No reviews found for this ride",
        data: reviews,
        meta
      });
    } catch (error) {
      logger.error?.("[review-service] GET /ride/:rideId error:", error);

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
  router.get("/api/v1/reviews/driver/:driverId", async (request, response) => {
    const meta = buildMeta();

    try {
      const reviews = await store.findByDriverId(request.params.driverId);
      const { averageRating, totalReviews } = await store.getDriverAverageRating(request.params.driverId);

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
      logger.error?.("[review-service] GET /driver/:driverId error:", error);

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
  router.get("/api/v1/reviews/driver/:driverId/average", async (request, response) => {
    const meta = buildMeta();

    try {
      const { averageRating, totalReviews } = await store.getDriverAverageRating(request.params.driverId);

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
      logger.error?.("[review-service] GET /driver/:driverId/average error:", error);

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

function duplicateResponse(response, meta, existing) {
  return response.status(409).json({
    success: false,
    message: "User has already reviewed this ride",
    data: existing,
    meta
  });
}

function publishReviewCreated(publisher, review, logger) {
  const value = JSON.stringify({
    reviewId: review.reviewId,
    rideId: review.rideId,
    userId: review.userId,
    driverId: review.driverId,
    rating: review.rating,
    timestamp: review.createdAt
  });

  Promise.resolve()
    .then(() => publisher.send({
      topic: "review.created",
      messages: [{ key: review.rideId, value }]
    }))
    .catch((error) => {
      logger.error?.("[review-service] Failed to publish ReviewCreated:", error);
    });
}
