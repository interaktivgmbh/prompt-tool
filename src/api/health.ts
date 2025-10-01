import { Router } from 'express';
import { testConnection } from '@/core/database';
import { asyncHandler } from '@/middleware/error-handler';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const dbHealthy = await testConnection();

    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
      service: 'prompt-tool',
    };

    res.status(dbHealthy ? 200 : 503).json(health);
  })
);
