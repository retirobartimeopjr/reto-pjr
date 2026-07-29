import { pool } from '../../src/lib/db';
import fs from 'fs';
import path from 'path';

async function run() {
  const sql = fs.readFileSync(path.join(process.cwd(), 'scripts', 'database', 'migration_referrals_receipts.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migration successful');
  } catch (e) {
    console.error('Migration failed', e);
  } finally {
    process.exit(0);
  }
}
run();
