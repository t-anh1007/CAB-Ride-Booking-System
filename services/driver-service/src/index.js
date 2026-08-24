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

