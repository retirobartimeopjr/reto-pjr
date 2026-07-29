import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

// Quitar comillas simples de la contraseña
const dbPassword = String(process.env.PGPASSWORD || '').replace(/^'|'$/g, '');

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: dbPassword,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('⏳ Conectando a la base de datos...');
    
    // 1. BACKUP
    console.log('📥 Obteniendo datos para backup...');
    const res = await pool.query(`
      SELECT 
          u.id, 
          u.username, 
          u.phone, 
          u.email,
          us.calculated_score,
          us.parroquias_visitadas,
          us.respuestas_correctas,
          us.tickets_numbers
      FROM users u
      LEFT JOIN user_stats us ON u.id = us.user_id
    `);
    
    const users = res.rows;
    fs.writeFileSync('backup_usuarios_reto.json', JSON.stringify(users, null, 2));
    console.log(`✅ Backup guardado en backup_usuarios_reto.json con ${users.length} usuarios.`);

    // 2. WIPE
    console.log('🗑️  Borrando registros en cascada...');
    
    // Al hacer TRUNCATE users CASCADE se borrará: 
    // user_parroquia_visits, user_trivia_answers, ticket_registers
    // PERO los tickets quedarán SET NULL, por lo que también debemos vaciar tickets.
    await pool.query(`TRUNCATE TABLE users CASCADE`);
    await pool.query(`TRUNCATE TABLE tickets CASCADE`);
    
    // Reiniciar los contadores de los SERIAL por si acaso (aunque los ID de los usuarios son UUID)
    // El tickets id es SERIAL
    await pool.query(`ALTER SEQUENCE tickets_id_seq RESTART WITH 1`);
    
    console.log('✅ Base de datos reseteada con éxito. Lista para la nueva versión.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    pool.end();
  }
}

run();
