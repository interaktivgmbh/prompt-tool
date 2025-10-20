// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { appConfig } from '../src/config/app-config';

const connectionString = appConfig.database.url;

async function runMigration() {
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('🔄 Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  await sql.end();
  process.exit(0);
}

runMigration();
