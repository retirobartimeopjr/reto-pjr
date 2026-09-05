import { query } from './src/lib/db.js';

async function run() {
    try {
        console.log("Adding column respuesta_recibida...");
        await query(`ALTER TABLE bartimeo ADD COLUMN IF NOT EXISTS respuesta_recibida BOOLEAN DEFAULT false;`);
        console.log("Column added successfully!");
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

run();
