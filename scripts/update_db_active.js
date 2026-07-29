import { pool } from '../src/lib/db.js';

async function run() {
  const res = await pool.query(`UPDATE users SET is_active = false WHERE (SELECT COUNT(*) FROM tickets t WHERE t.user_id = users.id AND t.payed = 'yes') = 0`);
  console.log('Updated ' + res.rowCount + ' users to inactive.');
  process.exit(0);
}
run();
