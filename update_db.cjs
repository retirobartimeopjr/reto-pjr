const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'BartimeoRoot2026!*',
  database: 'bartimeodb',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await pool.query('ALTER TABLE user_parroquia_visits ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;');
    console.log('Added column flagged');
    await pool.query('ALTER TABLE user_parroquia_visits ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(255);');
    console.log('Added column flag_reason');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
