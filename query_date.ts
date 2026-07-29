import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });
import { query } from './src/lib/db';
async function run() {
  const res = await query("SELECT imported_at FROM ticket_registers WHERE phone = '3123415728'");
  console.log('Registered at:', res.rows[0].imported_at);
  process.exit(0);
}
run();
