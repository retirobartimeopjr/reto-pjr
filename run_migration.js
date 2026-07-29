const fs = require('fs');
const { Client } = require('pg');

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
        
        const sql = fs.readFileSync('/Users/jesus.traslavina/.gemini/antigravity-ide/brain/8ddad56c-0f61-4abe-b280-c152eff937c6/scratch/migration.sql', 'utf8');
        await client.query(sql);
        console.log("Migration executed successfully!");
    } catch (e) {
        console.error("Error executing migration:", e);
    } finally {
        await client.end();
    }
}
run();
