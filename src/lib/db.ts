import pg from 'pg';
const { Pool } = pg;

// Helper function to safely read from process.env at RUNTIME, preventing Vite from statically replacing it
const getRuntimeEnv = (key: string, fallback: string) => {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] as string;
    }
    // Fallback to import.meta.env (for local dev) or the provided fallback
    return (import.meta as any).env[key] || fallback;
};

const host = getRuntimeEnv('PGHOST', 'localhost');
const port = parseInt(getRuntimeEnv('PGPORT', '5432'));
const user = getRuntimeEnv('PGUSER', 'postgres');
const rawPassword = getRuntimeEnv('PGPASSWORD', '');
const database = getRuntimeEnv('PGDATABASE', 'bartimeodb');

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
