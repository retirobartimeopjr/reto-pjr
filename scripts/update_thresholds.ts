import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from '../src/lib/db.js';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update to 800
    const update800 = `
      UPDATE parroquias p
      SET reward = 800
      FROM (SELECT latitude, longitude FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1) j
      WHERE
        NOT EXISTS (SELECT 1 FROM user_parroquia_visits v WHERE v.parroquia_id = p.id)
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND (6371 * acos(
              cos(radians(j.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(j.longitude)) + 
              sin(radians(j.latitude)) * sin(radians(p.latitude))
            )) >= 18;
    `;
    const res800 = await client.query(update800);
    console.log(`Parroquias actualizadas a 800 pts: ${res800.rowCount}`);

    // Update to 500
    const update500 = `
      UPDATE parroquias p
      SET reward = 500
      FROM (SELECT latitude, longitude FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1) j
      WHERE
        NOT EXISTS (SELECT 1 FROM user_parroquia_visits v WHERE v.parroquia_id = p.id)
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND (6371 * acos(
              cos(radians(j.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(j.longitude)) + 
              sin(radians(j.latitude)) * sin(radians(p.latitude))
            )) >= 14
        AND (6371 * acos(
              cos(radians(j.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(j.longitude)) + 
              sin(radians(j.latitude)) * sin(radians(p.latitude))
            )) < 18;
    `;
    const res500 = await client.query(update500);
    console.log(`Parroquias actualizadas a 500 pts: ${res500.rowCount}`);

    // Update to 200
    const update200 = `
      UPDATE parroquias p
      SET reward = 200
      FROM (SELECT latitude, longitude FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1) j
      WHERE
        NOT EXISTS (SELECT 1 FROM user_parroquia_visits v WHERE v.parroquia_id = p.id)
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND (6371 * acos(
              cos(radians(j.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(j.longitude)) + 
              sin(radians(j.latitude)) * sin(radians(p.latitude))
            )) < 14;
    `;
    const res200 = await client.query(update200);
    console.log(`Parroquias actualizadas a 200 pts: ${res200.rowCount}`);

    await client.query('COMMIT');
    console.log("¡Todas las actualizaciones terminadas!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error actualizando. Transacción revertida.", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
