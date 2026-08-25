import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { createReviewRouter } from "../src/routes.js";

const CREATED_AT = "2026-08-25T00:00:00.000Z";

test("POST /api/v1/reviews creates a review and publishes the exact event", async (t) => {
  const store = createMockStore();
  const publisher = createMockPublisher();
  const runtime = await startRuntime({ store, publisher });
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews", {
    method: "POST",
    body: JSON.stringify({
      rideId: "ride-create",
      userId: "user-create",
      driverId: "driver-create",
      rating: 5,
      comment: "Excellent ride"
    })
  });

  assert.equal(response.status, 201);
  assertEnvelope(response.body, { success: true, message: "Review created" });
  assert.deepEqual(response.body.data, {
    reviewId: "review-1",
    rideId: "ride-create",
    userId: "user-create",
    driverId: "driver-create",
    rating: 5,
    comment: "Excellent ride",
    createdAt: CREATED_AT
  });
  assert.deepEqual(store.calls.createReview, [{
    rideId: "ride-create",
    userId: "user-create",
    driverId: "driver-create",
    rating: 5,
    comment: "Excellent ride"
  }]);

  await waitFor(() => publisher.messages.length === 1);
  assert.deepEqual(publisher.messages[0], {
    topic: "review.created",
    messages: [{
      key: "ride-create",
      value: JSON.stringify({
        reviewId: "review-1",
        rideId: "ride-create",
        userId: "user-create",
        driverId: "driver-create",
        rating: 5,
        timestamp: CREATED_AT
      })
    }]
  });
  assert.deepEqual(Object.keys(JSON.parse(publisher.messages[0].messages[0].value)), [
    "reviewId",
    "rideId",
    "userId",
    "driverId",
    "rating",
    "timestamp"
  ]);
});

test("POST /api/v1/reviews rejects a missing required field", async (t) => {
  const runtime = await startRuntime();
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews", {
    method: "POST",
    body: JSON.stringify({ rideId: "ride-missing", userId: "user-missing", rating: 4 })
  });

  assert.equal(response.status, 400);
  assertEnvelope(response.body, {
    success: false,
    message: "Missing required fields: rideId, userId, driverId, rating"
  });
  assert.equal(response.body.data, null);
});

test("POST /api/v1/reviews rejects ratings outside one through five", async (t) => {
  const runtime = await startRuntime();
  t.after(runtime.close);

  for (const rating of [0, 6]) {
    const response = await requestJson(runtime.baseUrl, "/api/v1/reviews", {
      method: "POST",
      body: JSON.stringify({
        rideId: `ride-rating-${rating}`,
        userId: `user-rating-${rating}`,
        driverId: "driver-rating",
        rating
      })
    });

    assert.equal(response.status, 400);
    assertEnvelope(response.body, {
      success: false,
      message: "Rating must be an integer between 1 and 5"
    });
    assert.equal(response.body.data, null);
  }
});

test("POST /api/v1/reviews rejects a pre-existing ride and user review", async (t) => {
  const existing = reviewFixture({
    reviewId: "review-existing",
    rideId: "ride-duplicate",
    userId: "user-duplicate"
  });
  const runtime = await startRuntime({ store: createMockStore([existing]) });
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews", {
    method: "POST",
    body: JSON.stringify({
      rideId: existing.rideId,
      userId: existing.userId,
      driverId: existing.driverId,
      rating: existing.rating
    })
  });

  assert.equal(response.status, 409);
  assertEnvelope(response.body, {
    success: false,
    message: "User has already reviewed this ride"
  });
  assert.deepEqual(response.body.data, existing);
});

test("POST /api/v1/reviews translates a Mongo duplicate-key race to 409", async (t) => {
  const existing = reviewFixture({
    reviewId: "review-race",
    rideId: "ride-race",
    userId: "user-race"
  });
  const store = createMockStore();
  let lookups = 0;
  store.findExistingReview = async () => {
    lookups += 1;
    return lookups === 1 ? null : existing;
  };
  store.createReview = async () => {
    const error = new Error("duplicate key");
    error.code = 11000;
    throw error;
  };
  const runtime = await startRuntime({ store });
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews", {
    method: "POST",
    body: JSON.stringify({
      rideId: existing.rideId,
      userId: existing.userId,
      driverId: existing.driverId,
      rating: existing.rating
    })
  });

  assert.equal(response.status, 409);
  assertEnvelope(response.body, {
    success: false,
    message: "User has already reviewed this ride"
  });
  assert.deepEqual(response.body.data, existing);
});

test("GET /api/v1/reviews/ride/:rideId preserves the ride response", async (t) => {
  const review = reviewFixture({ rideId: "ride-list" });
  const runtime = await startRuntime({ store: createMockStore([review]) });
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews/ride/ride-list");

  assert.equal(response.status, 200);
  assertEnvelope(response.body, { success: true, message: "Reviews found" });
  assert.deepEqual(response.body.data, [review]);
});

test("GET /api/v1/reviews/driver/:driverId preserves reviews and rounded average", async (t) => {
  const reviews = [
    reviewFixture({ reviewId: "review-driver-1", rideId: "ride-driver-1", rating: 5 }),
    reviewFixture({ reviewId: "review-driver-2", rideId: "ride-driver-2", rating: 4 }),
    reviewFixture({ reviewId: "review-driver-3", rideId: "ride-driver-3", rating: 4 })
  ];
  const runtime = await startRuntime({ store: createMockStore(reviews) });
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews/driver/driver-1");

  assert.equal(response.status, 200);
  assertEnvelope(response.body, { success: true, message: "Reviews found" });
  assert.deepEqual(response.body.data, {
    driverId: "driver-1",
    averageRating: 4.33,
    totalReviews: 3,
    reviews
  });
});

test("GET /api/v1/reviews/driver/:driverId/average preserves the empty average response", async (t) => {
  const runtime = await startRuntime();
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews/driver/driver-empty/average");

  assert.equal(response.status, 200);
  assertEnvelope(response.body, { success: true, message: "No reviews available" });
  assert.deepEqual(response.body.data, {
    driverId: "driver-empty",
    averageRating: null,
    totalReviews: 0
  });
});

test("Kafka failure is logged without changing a successful POST", async (t) => {
  const errors = [];
  const publisher = {
    async send() {
      throw new Error("Kafka unavailable");
    }
  };
  const runtime = await startRuntime({
    publisher,
    logger: {
      error(...args) {
        errors.push(args);
      }
    }
  });
  t.after(runtime.close);

  const response = await requestJson(runtime.baseUrl, "/api/v1/reviews", {
    method: "POST",
    body: JSON.stringify({
      rideId: "ride-kafka-failure",
      userId: "user-kafka-failure",
      driverId: "driver-kafka-failure",
      rating: 3
    })
  });

  assert.equal(response.status, 201);
  assertEnvelope(response.body, { success: true, message: "Review created" });
  await waitFor(() => errors.length === 1);
  assert.equal(errors[0][0], "[review-service] Failed to publish ReviewCreated:");
  assert.match(errors[0][1].message, /Kafka unavailable/);
});

function reviewFixture(overrides = {}) {
  return {
    reviewId: "review-fixture",
    rideId: "ride-fixture",
    userId: "user-fixture",
    driverId: "driver-1",
    rating: 5,
    comment: null,
    createdAt: CREATED_AT,
    ...overrides
  };
}

function createMockStore(seed = []) {
  const reviews = seed.map((review) => ({ ...review }));
  const calls = {
    createReview: []
  };

  return {
    calls,
    async createReview(data) {
      calls.createReview.push(data);
      const review = reviewFixture({
        ...data,
        reviewId: `review-${reviews.length + 1}`,
        comment: data.comment || null
      });
      reviews.push(review);
      return review;
    },
    async findByRideId(rideId) {
      return reviews.filter((review) => review.rideId === rideId);
    },
    async findByDriverId(driverId) {
      return reviews.filter((review) => review.driverId === driverId);
    },
    async getDriverAverageRating(driverId) {
      const driverReviews = reviews.filter((review) => review.driverId === driverId);
      if (driverReviews.length === 0) {
        return { averageRating: null, totalReviews: 0 };
      }

      const sum = driverReviews.reduce((total, review) => total + review.rating, 0);
      return {
        averageRating: Math.round((sum / driverReviews.length) * 100) / 100,
        totalReviews: driverReviews.length
      };
    },
    async findExistingReview(rideId, userId) {
      return reviews.find((review) => review.rideId === rideId && review.userId === userId) || null;
    }
  };
}

function createMockPublisher() {
  const messages = [];
  return {
    messages,
    async send(message) {
      messages.push(message);
    }
  };
}

async function startRuntime({
  store = createMockStore(),
  publisher = createMockPublisher(),
  logger = console
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(createReviewRouter({ store, publisher, logger }));

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

function assertEnvelope(body, { success, message }) {
  assert.deepEqual(Object.keys(body), ["success", "message", "data", "meta"]);
  assert.equal(body.success, success);
  assert.equal(body.message, message);
  assert.equal(typeof body.meta.requestId, "string");
  assert.equal(typeof body.meta.correlationId, "string");
  assert.equal(typeof body.meta.timestamp, "string");
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}
