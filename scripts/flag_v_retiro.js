import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const normalize = (name) => name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

async function run() {
    const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        
        // Add column if not exists
        await client.query('ALTER TABLE servidores ADD COLUMN IF NOT EXISTS is_v_retiro BOOLEAN DEFAULT false');
        await client.query('UPDATE servidores SET is_v_retiro = false'); // Reset
        
        // Parse CSV
        const csvPath = 'Formulario Servidores V Retiro Bartimeo PJR - EXCEL - Respuestas de formulario 1.csv';
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const records = parse(fileContent, { columns: true, skip_empty_lines: true });
        
        let count = 0;
        
        const all = await client.query('SELECT id, full_name FROM servidores');
        for (let row of all.rows) {
            const dbNorm = normalize(row.full_name);
            let found = false;
            for (let csvRow of records) {
                 if (csvRow['NOMBRE COMPLETO ']) {
                     if (normalize(csvRow['NOMBRE COMPLETO ']) === dbNorm) {
                         found = true;
                         break;
                     }
                 }
            }
            if (found) {
                await client.query('UPDATE servidores SET is_v_retiro = true WHERE id = $1', [row.id]);
                count++;
            }
        }
        
        console.log('✅ Updated ' + count + ' servers to be in V Retiro');
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}
run();
