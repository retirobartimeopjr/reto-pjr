import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: (process.env.PGPASSWORD || '').replace(/^'|'$/g, ''),
  database: process.env.PGDATABASE || 'bartimeodb',
  ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query(`
            SELECT original_name, COUNT(*) as count 
            FROM historical_roles 
            WHERE server_id IS NULL 
            GROUP BY original_name 
            ORDER BY count DESC
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch(e) {
        console.error("QUERY ERROR:", e.message);
    } finally {
        await pool.end();
    }
}
main();
