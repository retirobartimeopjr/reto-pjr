import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });
import { query } from './src/lib/db';
async function run() {
  const res = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_stats'");
  console.log('user_stats:', res.rows);
  process.exit(0);
}
run();
