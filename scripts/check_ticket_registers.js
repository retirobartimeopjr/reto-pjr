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
    const res = await client.query(`
      SELECT ticket_number, phone, username, user_id, receipt_url 
      FROM ticket_registers 
      WHERE username LIKE '%(No Competidor)'
    `);
    console.log(`Registers for No Competidor: ${res.rowCount}`);
    if (res.rowCount > 0) {
      console.dir(res.rows.slice(0, 3), { depth: null });
    }
  } finally {
    await client.end();
  }
}

run().catch(console.error);
