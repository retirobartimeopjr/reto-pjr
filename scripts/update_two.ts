import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await pool.query("UPDATE servidores SET phone = '573165206865' WHERE full_name ILIKE '%Fabian Carrera%'");
        await pool.query("UPDATE servidores SET phone = '573002102817' WHERE full_name ILIKE '%Torres Neira%'");
        console.log("Updated Fabian and Monica");
    } finally {
        await pool.end();
    }
}

run();
