import { Router } from 'express';
import { testConnection } from '@/core/database';
import { asyncHandler } from '@/middleware/error-handler';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    let dbHealthy = false;
    let dbError: string | undefined;

    try {
      dbHealthy = await testConnection();
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown error';
    }

    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
      service: 'prompt-tool',
      version: '0.1.0',
      ...(dbError && { error: dbError }),
    };

    res.status(dbHealthy ? 200 : 503).json(health);
  })
);
