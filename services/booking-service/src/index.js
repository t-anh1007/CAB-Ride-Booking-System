import dotenv from "dotenv";
import mongoose from "mongoose";
import { startService } from "../../../platform/node/create-service-app.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import messageBroker from "./utils/messageBroker.js";
import { startMatchingConsumer } from "./events/matchingConsumer.js";
import { startRideStatusConsumer } from "./events/rideStatusConsumer.js";

dotenv.config();

startService("booking-service", async (app) => {
    const MONGO_URI = process.env.MONGO_URI;

    if (!MONGO_URI) {
        console.error("❌ LỖI: Thiếu biến môi trường MONGO_URI");
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ MongoDB Connected");

        // Kết nối Kafka thật
        await messageBroker.connect();
        
        // Chạy bộ điều phối lắng nghe AI Matching
        startMatchingConsumer().catch(err => console.error("❌ Orchestrator Error:", err));
        
        // Chạy bộ lắng nghe trạng thái chuyến xe (để báo cho khách khi tài xế nhận/đến/hoàn thành)
        startRideStatusConsumer().catch(err => console.error("❌ Status Observer Error:", err));

        app.use("/api/v1/bookings", bookingRoutes);
        console.log(`🚀 Booking Service ready on port ${process.env.PORT || 3103}`);

    } catch (error) {
        console.error("❌ Startup Error:", error.message);
        process.exit(1);
    }
});