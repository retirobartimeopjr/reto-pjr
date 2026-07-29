import { config } from 'dotenv';
config();
import { query } from './src/lib/db.ts';
async function run() {
  const res = await query("SELECT phone, receipt_url FROM ticket_registers WHERE phone = '3123415728'");
  console.log('Results:', res.rows);
  const res2 = await query("SELECT id, receipt_url FROM user_receipts WHERE user_id = (SELECT id FROM users WHERE phone = '3123415728')");
  console.log('Manual Receipts:', res2.rows);
}
run();
