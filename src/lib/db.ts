import pg from 'pg';
const { Pool } = pg;

// IMPORTANTE: En Astro (que usa Vite), debemos acceder a import.meta.env
// Para soportar tanto dev local (Astro) como prod (PM2), usamos ambos:
const host = import.meta.env.PGHOST || process.env.PGHOST || 'localhost';
const port = parseInt(import.meta.env.PGPORT || process.env.PGPORT || '5432');
const user = import.meta.env.PGUSER || process.env.PGUSER || 'postgres';
const rawPassword = import.meta.env.PGPASSWORD || process.env.PGPASSWORD || '';
const database = import.meta.env.PGDATABASE || process.env.PGDATABASE || 'bartimeodb';

// Quitamos comillas simples si quedaron del archivo .env.local
const dbPassword = String(rawPassword).replace(/^'|'$/g, '');

export const pool = new Pool({
  host,
  port,
  user,
  password: dbPassword,
  database,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el Pool de PostgreSQL', err);
});

// Exportamos un helper rápido para hacer consultas
export const query = (text: string, params?: any[]) => pool.query(text, params);
