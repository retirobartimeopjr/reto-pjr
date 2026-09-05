import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, extra_questions, daily_trivia_count, last_trivia_date FROM users WHERE phone = '3178038919'");
    console.log(res.rows);
    const answers = await client.query(`SELECT * FROM user_trivia_answers WHERE user_id = $1 AND answered_at > CURRENT_DATE`, [res.rows[0].id]);
    console.log("Answers today:", answers.rowCount);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
run();
