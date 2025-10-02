// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

import postgres from 'postgres';

const sql = postgres('postgresql://postgres:postgres@localhost:5433/prompt_db');

async function verifySchema() {
  try {
    // Check tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('📊 Tables created:');
    tables.forEach((t) => console.log(`  - ${t.table_name}`));

    // Check indexes
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `;

    console.log('\n📑 Indexes created:');
    indexes.forEach((i) => console.log(`  - ${i.tablename}.${i.indexname}`));

    // Check embeddings table structure
    const embeddingsColumns = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'embeddings'
      ORDER BY ordinal_position
    `;

    console.log('\n🔍 Embeddings table columns:');
    embeddingsColumns.forEach((c) => {
      const type = c.udt_name === 'vector' ? 'vector(3072)' : c.data_type;
      console.log(`  - ${c.column_name}: ${type}`);
    });

    await sql.end();
    console.log('\n✅ Schema verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifySchema();
