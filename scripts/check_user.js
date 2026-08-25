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
    const res = await client.query('SELECT * FROM users WHERE phone = $1', ['3178038919']);
    console.log(res.rows[0]);
    
    const tickets = await client.query('SELECT * FROM tickets WHERE user_id = $1', [res.rows[0].id]);
    console.log(`Tickets for user: ${tickets.rowCount}`);
    if (tickets.rowCount > 0) {
        console.log(tickets.rows);
    }
  } finally {
    await client.end();
  }
}

run().catch(console.error);
