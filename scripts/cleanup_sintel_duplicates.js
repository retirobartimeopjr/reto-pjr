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
    
    console.log('--- STARTING DUPLICATE ANALYSIS ---');

    // 1. Find all SINTEL_ users
    const resSinTel = await client.query(`
        SELECT id, username, phone 
        FROM users 
        WHERE phone LIKE 'SINTEL_%'
    `);
    
    console.log(`Found ${resSinTel.rowCount} SINTEL_ users.`);
    let deletedCount = 0;

    for (const sinTelUser of resSinTel.rows) {
        // 2. Check if a real user exists with EXACT same name and a real phone number
        const resReal = await client.query(`
            SELECT id, username, phone 
            FROM users 
            WHERE username = $1 AND phone NOT LIKE 'SINTEL_%'
        `, [sinTelUser.username]);

        if (resReal.rowCount > 0) {
            // There is a match!
            const realUser = resReal.rows[0];
            
            // 3. Check if SIN_TEL_ user has any points
            const resStats = await client.query(`
                SELECT calculated_score 
                FROM user_stats 
                WHERE user_id = $1
            `, [sinTelUser.id]);

            const score = resStats.rows[0]?.calculated_score || 0;

            if (score > 0) {
                console.log(`⚠️ SKIPPING ${sinTelUser.username}: Has ${score} points!`);
                continue;
            }

            console.log(`✅ MATCH FOUND: ${sinTelUser.username}`);
            console.log(`   - Duplicate (SIN_TEL): ID ${sinTelUser.id}, Phone ${sinTelUser.phone}`);
            console.log(`   - Real User: ID ${realUser.id}, Phone ${realUser.phone}`);
            
            // Reassign any tickets or ticket_registers to the real user to avoid losing data or FK constraint errors
            const resTickets = await client.query(`UPDATE tickets SET user_id = $1 WHERE user_id = $2 RETURNING *`, [realUser.id, sinTelUser.id]);
            const resRegisters = await client.query(`UPDATE ticket_registers SET user_id = $1, phone = $2 WHERE user_id = $3 RETURNING *`, [realUser.id, realUser.phone, sinTelUser.id]);
            
            if (resTickets.rowCount > 0) console.log(`   - Reassigned ${resTickets.rowCount} tickets to real user.`);
            if (resRegisters.rowCount > 0) console.log(`   - Reassigned ${resRegisters.rowCount} ticket_registers to real user.`);

            // Delete the duplicate user
            // Note: Since we are in a transaction, we can safely delete
            // user_stats for the sin_tel user first, then the user itself.
            await client.query(`DELETE FROM user_stats WHERE user_id = $1`, [sinTelUser.id]);
            await client.query(`DELETE FROM user_parroquia_visits WHERE user_id = $1`, [sinTelUser.id]);
            await client.query(`DELETE FROM user_trivia_answers WHERE user_id = $1`, [sinTelUser.id]);
            await client.query(`DELETE FROM users WHERE id = $1`, [sinTelUser.id]);

            console.log(`   -> Deleted ${sinTelUser.username} (SIN_TEL) successfully.`);
            deletedCount++;
        }
    }
    
    await client.query('COMMIT');
    console.log(`\n--- FINISHED ---`);
    console.log(`Total SIN_TEL_ duplicates deleted: ${deletedCount}`);
  } catch(e) {
      await client.query('ROLLBACK');
      console.error("Error during cleanup:", e);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
