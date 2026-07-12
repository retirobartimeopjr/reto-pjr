import pg from 'pg';
const { Client } = pg;

// Como en .env.local la contraseña tiene comillas simples, la limpiamos:
const rawPassword = process.env.PGPASSWORD || 'BartimeoRoot2026!*';
const dbPassword = String(rawPassword).replace(/^'|'$/g, '');

async function run() {
    const client = new Client({
        user: process.env.PGUSER || 'postgres',
        password: dbPassword,
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        database: process.env.PGDATABASE || 'bartimeodb',
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log("✅ Conectado a PostgreSQL para crear tablas nuevas...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS app_config (
                key VARCHAR(50) PRIMARY KEY,
                value JSONB NOT NULL
            );
        `);
        console.log("✅ Tabla app_config creada o verificada.");

        await client.query(`
            INSERT INTO app_config (key, value) VALUES 
            ('challenge_state', '{"active": true, "message": "¡El Reto ha terminado!"}'::jsonb) 
            ON CONFLICT DO NOTHING;
        `);
        console.log("✅ Configuración inicial insertada.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                username VARCHAR(50) PRIMARY KEY,
                password VARCHAR(255) NOT NULL
            );
        `);
        console.log("✅ Tabla admins creada o verificada.");

        await client.query(`
            INSERT INTO admins (username, password) VALUES 
            ('Aleja', 'bartimeo5'),
            ('Nico', 'bartimeo5'),
            ('Jesus', 'bartimeo5')
            ON CONFLICT DO NOTHING;
        `);
        console.log("✅ Usuarios coordinadores creados exitosamente.");

    } catch (e) {
        console.error("❌ Error al crear tablas:", e);
    } finally {
        await client.end();
    }
}

run();
