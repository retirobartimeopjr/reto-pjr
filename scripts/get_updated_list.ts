import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from '../src/lib/db.js';
import fs from 'fs';
import path from 'path';

async function run() {
  try {
    const query = `
      SELECT 
        p.name, 
        p.reward,
        (6371 * acos(
              cos(radians(j.latitude)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(j.longitude)) + 
              sin(radians(j.latitude)) * sin(radians(p.latitude))
        )) AS distance
      FROM 
        parroquias p
      CROSS JOIN
        (SELECT latitude, longitude FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1) j
      WHERE
        NOT EXISTS (SELECT 1 FROM user_parroquia_visits v WHERE v.parroquia_id = p.id)
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
      ORDER BY 
        p.reward DESC, distance DESC;
    `;
    const res = await pool.query(query);
    
    // Group them
    const p800 = res.rows.filter(r => r.reward === 800);
    const p500 = res.rows.filter(r => r.reward === 500);
    const p200 = res.rows.filter(r => r.reward === 200);

    let md = `# Registro de Parroquias Actualizadas\n\n`;
    md += `Estas son las parroquias (que **no** tienen visitas registradas) y que fueron ajustadas a los nuevos puntajes según su distancia.\n\n`;
    
    md += `## Parroquias de 800 Puntos (>= 18 km) - Total: ${p800.length}\n`;
    p800.forEach(p => {
        md += `- **${p.name}** (${Number(p.distance).toFixed(2)} km)\n`;
    });
    
    md += `\n## Parroquias de 500 Puntos (14 km a 17.9 km) - Total: ${p500.length}\n`;
    p500.forEach(p => {
        md += `- **${p.name}** (${Number(p.distance).toFixed(2)} km)\n`;
    });

    md += `\n## Parroquias de 200 Puntos (< 14 km) - Total: ${p200.length}\n`;
    p200.forEach(p => {
        md += `- **${p.name}** (${Number(p.distance).toFixed(2)} km)\n`;
    });

    // Write to standard output so the AI can capture it
    console.log(md);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
