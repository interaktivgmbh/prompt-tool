// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { defineConfig } from 'drizzle-kit';
import { appConfig } from './src/config/app-config';

export default defineConfig({
  schema: './src/core/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: appConfig.database.url,
  },
  verbose: true,
  strict: true,
});
