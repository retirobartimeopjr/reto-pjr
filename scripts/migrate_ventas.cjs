const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// We re-implement the parsing for the migration script because .env.local might have single quotes
const dbPassword = process.env.PGPASSWORD ? String(process.env.PGPASSWORD).replace(/^'|'$/g, '') : '';

async function run() {
    const client = new Client({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: dbPassword,
        database: process.env.PGDATABASE || 'bartimeodb',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL for Ventas Migration");
        
        const sql = `
            CREATE TABLE IF NOT EXISTS ventas_reservas (
                id SERIAL PRIMARY KEY,
                vendedor VARCHAR(255) NOT NULL,
                comprador_nombre VARCHAR(255) NOT NULL,
                comprador_telefono VARCHAR(255),
                hora_recogida VARCHAR(255),
                producto VARCHAR(50) NOT NULL,
                variante VARCHAR(50) NOT NULL,
                cantidad INTEGER NOT NULL DEFAULT 1,
                precio_unitario INTEGER NOT NULL,
                estado VARCHAR(20) DEFAULT 'ACTIVA',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Initial configuration insertion if it doesn't exist
            INSERT INTO app_config (key, value)
            VALUES (
                'ventas_config',
                '{"limits":{"arroz_con_pollo":60,"tamal":40},"prices":{"arroz_con_pollo":{"sencillo":20000,"combo":22000},"tamal":{"sencillo":10000,"combo":13000}}}'
            )
            ON CONFLICT (key) DO NOTHING;
        `;
        
        await client.query(sql);
        console.log("Ventas migration executed successfully!");
    } catch (e) {
        console.error("Error executing migration:", e);
    } finally {
        await client.end();
    }
}
run();
