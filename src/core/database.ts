// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { appConfig } from '@/config/app-config';
import * as schema from './schema';

const connectionString = appConfig.database.url;

if (!connectionString) {
  throw new Error('DATABASE_URL must be configured');
}

// Create postgres client
export const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Test connection function
export async function testConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  await client.end();
}
