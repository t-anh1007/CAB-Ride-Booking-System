import express from 'express';
import paymentRoutes from './routes/paymentRoutes.js';
import { authContextMiddleware } from './middlewares/authContext.js';
import { requestMeta } from './middlewares/requestMeta.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { architectureInfo, healthCheck } from './controllers/paymentController.js';

export function createApp(env) {
  const app = express();

  app.locals.env = env;
  app.use(express.json());
  app.use(requestMeta);
  app.use(authContextMiddleware);

  app.get('/health', healthCheck);
  app.get('/architecture', architectureInfo);
  app.use('/api/v1/payments', paymentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
