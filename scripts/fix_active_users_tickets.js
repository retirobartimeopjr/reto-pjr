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
    await client.query('BEGIN');
    
    // Find all users who are active but have tickets marked as payed = 'no'
    const res = await client.query(`
        SELECT u.id, u.username, u.phone 
        FROM users u
        JOIN tickets t ON u.id = t.user_id
        WHERE u.is_active = true AND t.payed = 'no'
        GROUP BY u.id
    `);
    
    console.log(`Found ${res.rowCount} active users with unpaid tickets.`);

    for (const row of res.rows) {
        console.log(`Fixing user: ${row.username} (${row.phone})`);
        
        await client.query(`
            UPDATE tickets 
            SET payed = 'yes', updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = $1 AND (payed = 'no' OR payed IS NULL)
        `, [row.id]);
        
        await client.query(`
            UPDATE ticket_registers
            SET payed = 'yes'
            WHERE user_id = $1 AND (payed = 'no' OR payed IS NULL)
        `, [row.id]);
    }
    
    await client.query('COMMIT');
    console.log('Done!');
  } catch(e) {
      await client.query('ROLLBACK');
      console.error(e);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
