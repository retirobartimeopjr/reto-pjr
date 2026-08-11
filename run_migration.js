import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function run() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'BartimeoRoot2026!*',
        database: 'bartimeodb'
    });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL");
        
        const sql = fs.readFileSync('/Users/jesus.traslavina/Desktop/BARTIMEO/gemini/bartimeo/bartimeo-app/scratch_00X_create_bartimeo.sql', 'utf8');
        await client.query(sql);
        console.log("Migration executed successfully!");
    } catch (e) {
        console.error("Error executing migration:", e);
    } finally {
        await client.end();
    }
}
run();
