import fs from 'fs';
import { parse } from 'csv-parse/sync';
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
    return phone.replace(/\D/g, '').substring(0, 15); // Deja solo números y toma máximo 15 caracteres
}

async function run() {
    try {
        console.log("⏳ Conectando a la base de datos...");
        
        // 1. Obtener servidores
        const dbRes = await pool.query('SELECT id, full_name, phone FROM servidores');
        const servidores = dbRes.rows;
        
        console.log(`✅ Obtenidos ${servidores.length} servidores de la base de datos.`);
        
        // 2. Leer CSV
        const fileContent = fs.readFileSync('cumples.csv', 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });
        
        console.log(`✅ Obtenidos ${records.length} contactos del CSV.`);
        
        let updatedCount = 0;
        let notFoundCount = 0;
        const notFoundList: string[] = [];

        // 3. Procesar
        for (const servidor of servidores) {
            if (servidor.phone) {
                // Ya tiene teléfono, saltar
                continue;
            }

            const dbNameClean = cleanName(servidor.full_name);
            const nameParts = dbNameClean.split(' ');

            let bestMatch = null;

            for (const record of records) {
                let csvName = record['NOMBRE DEL SERVIDORES'] || '';
                if (!csvName) continue;

                const csvFullNameClean = cleanName(csvName);

                // Estrategia de match: Buscar si todas las partes del nombre en DB están en el nombre del CSV,
                // o viceversa.
                let match = false;
                
                // Exact match
                if (csvFullNameClean === dbNameClean) {
                    match = true;
                } 
                // Partial match: First Name & First Last Name
                else if (nameParts.length >= 2) {
                    const dbFirst = nameParts[0];
                    const dbLast = nameParts.length > 2 ? nameParts[nameParts.length - 2] : nameParts[1];
                    const dbLastAlternative = nameParts[1]; // A veces el apellido en DB es la segunda palabra
                    
                    if (csvFullNameClean.includes(dbFirst) && (csvFullNameClean.includes(dbLast) || csvFullNameClean.includes(dbLastAlternative))) {
                        match = true;
                    }
                }

                if (match) {
                    bestMatch = record;
                    break;
                }
            }

            if (bestMatch) {
                // Sacar teléfono
                let phone = bestMatch['Telefono'];
                
                if (phone) {
                    const cleanedPhone = cleanPhone(phone);
                    
                    if (cleanedPhone.length > 5) {
                        await pool.query('UPDATE servidores SET phone = $1 WHERE id = $2', [cleanedPhone, servidor.id]);
                        console.log(`✅ MATCH: ${servidor.full_name} -> Tel: ${cleanedPhone}`);
                        updatedCount++;
                    } else {
                        console.log(`⚠️ ENCONTRADO PERO SIN TELÉFONO VÁLIDO: ${servidor.full_name}`);
                        notFoundList.push(servidor.full_name);
                    }
                } else {
                    console.log(`⚠️ ENCONTRADO SIN TELÉFONO: ${servidor.full_name}`);
                    notFoundList.push(servidor.full_name);
                }
            } else {
                console.log(`❌ NO ENCONTRADO: ${servidor.full_name}`);
                notFoundList.push(servidor.full_name);
                notFoundCount++;
            }
        }
        
        console.log(`\n🎉 PROCESO TERMINADO.`);
        console.log(`✅ Servidores actualizados: ${updatedCount}`);
        console.log(`❌ No encontrados/Sin coincidencia: ${notFoundCount}`);
        
    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await pool.end();
    }
}

run();
