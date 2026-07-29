import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });
import { query } from './src/lib/db';
async function run() {
  const res = await query("SELECT phone, receipt_url FROM ticket_registers WHERE phone = '3123415728'");
  console.log('Results:', res.rows);
  const res2 = await query("SELECT receipt_url FROM ticket_registers WHERE receipt_url IS NOT NULL");
  console.log('Total receipts:', res2.rowCount);
  process.exit(0);
}
run();
