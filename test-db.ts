import { pool } from './src/lib/db';
async function run() {
  try {
    const userRes = await pool.query("SELECT id, phone, daily_trivia_count, last_trivia_date, (last_trivia_date = ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota') - INTERVAL '5 hours')::DATE) as is_today FROM users WHERE phone = '3178038919'");
    console.log("USER:", userRes.rows);
    if (userRes.rows.length > 0) {
       const ans = await pool.query("SELECT * FROM user_trivia_answers WHERE user_id = $1 ORDER BY answered_at DESC", [userRes.rows[0].id]);
       console.log("ANSWERS COUNT:", ans.rowCount);
       if (ans.rowCount > 0) {
           console.log("LAST ANSWERS:", ans.rows.slice(0, 3));
       }
    }
    const total = await pool.query("SELECT COUNT(*) FROM preguntas");
    console.log("TOTAL PREGUNTAS IN DB:", total.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
