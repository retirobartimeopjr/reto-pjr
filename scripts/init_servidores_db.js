import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const client = new Client({ 
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS servidores_goals (
                id SERIAL PRIMARY KEY,
                server_name VARCHAR(255) UNIQUE NOT NULL,
                tickets_sold JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Table servidores_goals created successfully.");
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await client.end();
    }
}

run();
