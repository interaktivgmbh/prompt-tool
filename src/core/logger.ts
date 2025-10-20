// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import pino from 'pino';
import { appConfig } from '@/config/app-config';

const {
  runtime: { isDevelopment, logLevel },
} = appConfig;

export const logger = pino({
  level: logLevel,
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
