import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from '../src/lib/db.js';

async function run() {
  try {
    console.log("Creando tabla retiro_tasks...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS retiro_tasks (
        id SERIAL PRIMARY KEY,
        task_text TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Inicializando payment_deadline_date en app_config si no existe...");
    await pool.query(`
      INSERT INTO app_config (key, value) 
      VALUES ('payment_deadline_date', '"4 DE SEPTIEMBRE"')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log("¡Base de datos preparada correctamente!");
    process.exit(0);
  } catch (err) {
    console.error("Error configurando la DB:", err);
    process.exit(1);
  }
}

run();
