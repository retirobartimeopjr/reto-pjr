import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const client = new Client({ 
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const userRes = await client.query('SELECT daily_trivia_count, last_trivia_date FROM users WHERE id = $1', ['f89958d9-bb33-46c1-8eb6-c586beeed6ca']);
    console.table(userRes.rows);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
