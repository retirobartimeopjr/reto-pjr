import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { pool } from '../src/lib/db.js';

async function main() {
    console.log("Iniciando migración de participantes pasados...");

    const filePath = '/Users/jesus.traslavina/Downloads/firebase_users_2026-03-20.json';
    
    if (!fs.existsSync(filePath)) {
        console.error("No se encontró el archivo JSON en: " + filePath);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const users = JSON.parse(fileContent);

    console.log(`Leídos ${users.length} usuarios del JSON.`);

    // 1. Create table if not exists
    await pool.query(`
        CREATE TABLE IF NOT EXISTS participantes_pasados (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone VARCHAR(50),
            username VARCHAR(255),
            email VARCHAR(255),
            parroquias_visitadas TEXT,
            respuestas_correctas INTEGER DEFAULT 0,
            referidos INTEGER DEFAULT 0,
            score INTEGER DEFAULT 0,
            contacted BOOLEAN DEFAULT FALSE,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("Tabla 'participantes_pasados' verificada/creada.");

    // 2. Clear old table data (optional)
    await pool.query(`TRUNCATE TABLE participantes_pasados`);
    
    // 3. Insert data
    let inserted = 0;
    for (const user of users) {
        if (!user.phone && !user.username) continue; // Skip empty/invalid

        // Extract required fields based on JSON structure
        const phone = user.phone || '';
        const username = user.username || '';
        const email = user.email || '';
        const parroquiasVisitadas = user.parroquiasVistitadas || ''; // Note spelling "Vistitadas" in JSON
        const respuestasCorrectas = user.respuestasCorrectas || 0;
        const referidos = user.referidos || 0;
        const score = user.score || 0;

        await pool.query(`
            INSERT INTO participantes_pasados (phone, username, email, parroquias_visitadas, respuestas_correctas, referidos, score)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            phone,
            username,
            email,
            parroquiasVisitadas,
            respuestasCorrectas,
            referidos,
            score
        ]);

        inserted++;
    }

    console.log(`Migración completada con éxito. Insertados ${inserted} registros.`);
    process.exit(0);
}

main().catch(err => {
    console.error("Error durante migración:", err);
    process.exit(1);
});
