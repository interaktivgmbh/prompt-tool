// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export const createChildLogger = (name: string) => {
  return logger.child({ module: name });
};
