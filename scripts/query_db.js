import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`SELECT * FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1`);
  console.log(res.rows[0]);
  await client.end();
}
run();
