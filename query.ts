import { query } from './src/lib/db';
async function run() {
  try {
    const userRes = await query("SELECT id, phone, daily_trivia_count, last_trivia_date FROM users WHERE phone = '3178038919'");
    console.log("USER:", userRes.rows);
    if (userRes.rows.length > 0) {
       const ans = await query("SELECT * FROM user_trivia_answers WHERE user_id = $1", [userRes.rows[0].id]);
       console.log("ANSWERS COUNT:", ans.rowCount);
       if (ans.rowCount > 0) {
           console.log("SAMPLE ANSWERS:", ans.rows.slice(0, 3));
           console.log("LAST ANSWERS:", ans.rows.slice(-3));
       }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
