import express from 'express';
import cors from 'cors';
import { logger } from '@/core/logger';
import { errorHandler } from '@/middleware/error-handler';
import { healthRouter } from '@/api/health';
import { promptsRouter } from '@/api/prompts';
import { searchRouter } from '@/api/search';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, _res, next) => {
    logger.info({
      method: req.method,
      url: req.url,
      domainId: req.headers['x-domain-id'],
    }, 'Incoming request');
    next();
  });

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/prompts', promptsRouter);
  app.use('/api/search', searchRouter);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
