// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { createApp } from '@/app';
import { logger } from '@/core/logger';
import { testConnection, closeDatabase } from '@/core/database';
import { appConfig } from '@/config/app-config';

const {
  server: { port: PORT, host: HOST },
} = appConfig;

async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    logger.info('Database connection successful');

    // Create and start Express app
    const app = createApp();

    const server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running at http://${HOST}:${PORT}`);
      logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      server.close(async () => {
        logger.info('HTTP server closed');
        await closeDatabase();
        logger.info('Database connection closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
