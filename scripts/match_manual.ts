import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Cargar .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
      rejectUnauthorized: false
  }
});

function cleanName(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .trim();
}

function cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '').substring(0, 15);
}

async function run() {
    try {
        console.log("⏳ Conectando a la base de datos...");
        
        // 1. Obtener servidores
        const dbRes = await pool.query('SELECT id, full_name, phone FROM servidores');
        const servidores = dbRes.rows;
        
        // 2. Leer archivo manual
        const fileContent = fs.readFileSync('manuales.csv', 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
        
        let updatedCount = 0;

        for (const line of lines) {
            const parts = line.split('-');
            if (parts.length < 2) continue;
            
            const rawName = parts[0].trim();
            const rawPhone = parts[1].trim();
            
            const cleanedPhone = cleanPhone(rawPhone);
            
            if (cleanedPhone.length > 5) {
                // Find server
                const searchName = cleanName(rawName);
                
                let bestMatch = servidores.find(s => cleanName(s.full_name) === searchName);
                
                if (!bestMatch) {
                    // Try partial match
                    const nameParts = searchName.split(' ');
                    bestMatch = servidores.find(s => {
                        const dbName = cleanName(s.full_name);
                        return nameParts.every(part => dbName.includes(part));
                    });
                }
                
                if (bestMatch) {
                    await pool.query('UPDATE servidores SET phone = $1 WHERE id = $2', [cleanedPhone, bestMatch.id]);
                    console.log(`✅ ACTUALIZADO MANUALMENTE: ${bestMatch.full_name} -> Tel: ${cleanedPhone}`);
                    updatedCount++;
                } else {
                    console.log(`❌ NO SE ENCONTRÓ EN DB PARA ACTUALIZAR: ${rawName}`);
                }
            }
        }
        
        console.log(`\n🎉 PROCESO MANUAL TERMINADO. Actualizados: ${updatedCount}`);
        
        // 3. Listar los que faltan
        console.log(`\n--- SERVIDORES SIN TELÉFONO ---`);
        const missingRes = await pool.query('SELECT full_name FROM servidores WHERE phone IS NULL OR phone = \'\'');
        const missing = missingRes.rows;
        missing.forEach((s, idx) => {
            console.log(`${idx + 1}. ${s.full_name}`);
        });
        
    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await pool.end();
    }
}

run();
