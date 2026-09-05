import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from '../src/lib/db.js';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log("Buscando respuestas duplicadas...");
    // 1. Delete duplicates keeping the earliest one
    const deleteRes = await client.query(`
      DELETE FROM user_trivia_answers
      WHERE ctid NOT IN (
        SELECT min(ctid)
        FROM user_trivia_answers
        GROUP BY user_id, pregunta_id
      )
    `);
    console.log(`Borrados ${deleteRes.rowCount} registros duplicados de trivia.`);

    // 2. Add UNIQUE constraint
    // First, check if constraint exists
    const checkConstraint = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conname = 'unique_user_pregunta'
    `);

    if (checkConstraint.rows.length === 0) {
      console.log("Añadiendo restricción UNIQUE(user_id, pregunta_id)...");
      await client.query(`
        ALTER TABLE user_trivia_answers
        ADD CONSTRAINT unique_user_pregunta UNIQUE (user_id, pregunta_id)
      `);
      console.log("Restricción UNIQUE añadida exitosamente.");
    } else {
      console.log("La restricción UNIQUE ya existe.");
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
