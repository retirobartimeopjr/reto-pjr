import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initializeApp();
const db = getFirestore();

const collections = [
    'parroquias',
    'pending-referrals',
    'pregunta',
    'respuesta',
    'ticketregister',
    'tickets',
    'user',
    'visit'
];

async function exportAll() {
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir);
    }
    
    console.log(`Iniciando exportación en ${exportDir}...`);
    
    for (const collName of collections) {
        try {
            console.log(`Consultando colección: ${collName}...`);
            const snapshot = await db.collection(collName).get();
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });
            
            const filePath = path.join(exportDir, `${collName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ Éxito: '${collName}' exportada con ${data.length} documentos.`);
        } catch (error) {
            console.error(`❌ Error al exportar '${collName}': ${error.message}`);
        }
    }
    console.log("¡Exportación completada! Revisa la carpeta 'exports'.");
}

exportAll().catch(console.error);
