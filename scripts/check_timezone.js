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
    const res = await client.query('SHOW TIMEZONE; SELECT CURRENT_DATE;');
    console.log("Timezone:", res[0].rows);
    console.log("Current Date:", res[1].rows);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
