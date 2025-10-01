import postgres from 'postgres';

const sql = postgres('postgresql://postgres:postgres@localhost:5433/prompt_db');

async function testConnection() {
  try {
    const result = await sql`SELECT version()`;
    console.log('✅ Database connection successful!');
    console.log('PostgreSQL version:', result[0]?.version);

    // Test pgvector extension
    const vectorTest = await sql`SELECT * FROM pg_extension WHERE extname = 'vector'`;
    console.log('✅ pgvector extension installed:', vectorTest.length > 0);

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
