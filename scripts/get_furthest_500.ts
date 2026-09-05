import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from '../src/lib/db.js';

async function run() {
  try {
    const furthest200Query = `
      SELECT DISTINCT
        p.name,
        (6371 * acos(cos(radians(j.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(j.longitude)) + sin(radians(j.latitude)) * sin(radians(p.latitude)))) AS distance
      FROM
        parroquias p
      CROSS JOIN
        (SELECT latitude, longitude FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1) j
      JOIN
        user_parroquia_visits v ON v.parroquia_id = p.id
      WHERE
        p.reward = 200
      ORDER BY
        distance DESC
      LIMIT 1;
    `;
    const res200 = await pool.query(furthest200Query);
    console.log("Más lejana de 200 pts:", JSON.stringify(res200.rows[0], null, 2));

    const closest500Query = `
      SELECT DISTINCT
        p.name,
        (6371 * acos(cos(radians(j.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(j.longitude)) + sin(radians(j.latitude)) * sin(radians(p.latitude)))) AS distance
      FROM
        parroquias p
      CROSS JOIN
        (SELECT latitude, longitude FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1) j
      JOIN
        user_parroquia_visits v ON v.parroquia_id = p.id
      WHERE
        p.reward = 500
      ORDER BY
        distance ASC
      LIMIT 1;
    `;
    const res500 = await pool.query(closest500Query);
    console.log("Más cercana de 500 pts:", JSON.stringify(res500.rows[0], null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
