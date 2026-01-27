
import admin from 'firebase-admin';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import XLSX using require to avoid ESM named export issues
const XLSX = require('xlsx');

// --- CONFIGURATION ---
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../serviceAccountKey.json');
const EXCEL_FILE_PATH = '/Users/jesus.traslavina/Desktop/datos/reto-pjr.xlsx';

// Initialize Firebase Admin
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`ERROR: Service account key not found at ${SERVICE_ACCOUNT_PATH}`);
    console.error("Please verify that you have downloaded the JSON file from Firebase Console and placed it in the root of the project with the name 'serviceAccountKey.json'.");
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// --- HELPER FUNCTIONS ---
const readExcel = (filePath) => {
    const workbook = XLSX.readFile(filePath);
    return workbook;
};

const sheetToJson = (workbook, sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return [];
    return XLSX.utils.sheet_to_json(worksheet, { defval: null });
};

const batchWrite = async (collectionName, data, idField = null) => {
    if (data.length === 0) {
        console.log(`No data for collection: ${collectionName}`);
        return;
    }

    console.log(`Starting migration for ${collectionName} (${data.length} records)...`);

    const batchSize = 400;
    let batch = db.batch();
    let count = 0;
    let totalProcessed = 0;

    for (const item of data) {
        let docRef;
        if (idField && item[idField]) {
            const id = String(item[idField]);
            docRef = db.collection(collectionName).doc(id);
        } else {
            docRef = db.collection(collectionName).doc();
        }

        const cleanItem = JSON.parse(JSON.stringify(item));

        batch.set(docRef, cleanItem);
        count++;

        if (count >= batchSize) {
            await batch.commit();
            totalProcessed += count;
            console.log(`  Committed batch of ${count} records.`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        totalProcessed += count;
    }

    console.log(`Finished ${collectionName}: ${totalProcessed} documents written.\n`);
};

// --- MIGRATION LOGIC ---
const migrate = async () => {
    try {
        console.log(`Reading Excel file from: ${EXCEL_FILE_PATH}`);
        const workbook = readExcel(EXCEL_FILE_PATH);

        // 1. Users
        const users = sheetToJson(workbook, 'user');
        await batchWrite('users', users, 'phone');

        // 2. Coordinators
        const coordis = sheetToJson(workbook, 'coordi');
        await batchWrite('coordinators', coordis, 'phone');

        // 3. Parroquias
        const parroquias = sheetToJson(workbook, 'parroquia');
        // Ensure ids are strings for document IDs
        const parroquiasClean = parroquias.map(p => ({ ...p, id: String(p.id) }));
        await batchWrite('parroquias', parroquiasClean, 'id');

        // 4. Tickets
        const tickets = sheetToJson(workbook, 'ticket');
        await batchWrite('tickets', tickets, 'ticket');

        // 5. Payments
        const payments = sheetToJson(workbook, 'pay');
        await batchWrite('payments', payments, 'id');

        // 6. Visits
        const visits = sheetToJson(workbook, 'visit');
        await batchWrite('visits', visits);

        // 7. Questions
        const questions = sheetToJson(workbook, 'preguntados');
        await batchWrite('questions', questions);

        // 8. Bank Accounts
        const accounts = sheetToJson(workbook, 'cuentas');
        await batchWrite('bank_accounts', accounts);

        console.log("Migration completed successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        process.exit();
    }
};

migrate();
