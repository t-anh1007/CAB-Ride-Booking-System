import express from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import promClient from 'prom-client'; // Thư viện Metrics
import 'dotenv/config';
import startServersModule from '../../../platform/node/start-servers.cjs';

import pricingRoutes from './routes/pricingRoutes.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3101;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cab_booking_pricing';
const { startServiceServers } = startServersModule;

// Cấu hình thu thập Metrics mặc định cho Prometheus (RAM, CPU, Event Loop...)
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ register: promClient.register });

app.use(express.json());

// Gán ID để tracing log
app.use((req, res, next) => {
    if (!req.headers['x-request-id']) req.headers['x-request-id'] = uuidv4();
    next();
});

// Kết nối các Database
mongoose.connect(MONGO_URI)
    .then(() => logger.info('✅ Kết nối MongoDB thành công!'))
    .catch((error) => {
        logger.error('❌ Lỗi kết nối MongoDB:', { error: error.message });
        process.exit(1); 
    });

// ================= API HỆ THỐNG ================= //

// Endpoint: Health Check (Dành cho K8s/Docker Swarm kiểm tra)
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", service: "pricing-service" });
});

// Endpoint: Metrics (Dành cho Prometheus kéo dữ liệu về Grafana)
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.send(await promClient.register.metrics());
});

// ================= API NGHIỆP VỤ ================= //
app.use('/api/v1/pricing', pricingRoutes);

// Fallback 404
app.use((req, res) => {
    logger.warn(`404 Not Found: ${req.originalUrl}`);
    res.status(404).json({ success: false, message: "Endpoint không tồn tại" });
});

const runtime = await startServiceServers({
    app,
    env: process.env,
    publicPort: PORT,
    serviceName: 'pricing-service',
    logger,
});

logger.info(`🚀 Pricing Service đang chạy tại cổng ${PORT}`);
if (runtime.internalPort) {
    logger.info(`🔐 Pricing Service mTLS nội bộ tại cổng ${runtime.internalPort}`);
}
