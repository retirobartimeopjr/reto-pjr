
import fs from 'fs';
import { google } from 'googleapis';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

// --- CONFIGURATION ---
// Assuming running from scripts/ directory, so go up one level
const SERVICE_ACCOUNT_KEY_PATH = path.join(process.cwd(), 'serviceAccountKey.json');
const SERVICE_ACCOUNT_SHEETS_PATH = path.join(process.cwd(), 'service-account.json');
const DOTENV_PATH = path.join(process.cwd(), '.env.local');

// Helper to manually parse .env.local for GOOGLE_SHEET_ID
function getEnvValue(key) {
    if (fs.existsSync(DOTENV_PATH)) {
        const fileContent = fs.readFileSync(DOTENV_PATH, 'utf8');
        const regex = new RegExp(`^${key}="?([^"\\n]+)"?`, 'm');
        const match = fileContent.match(regex);
        return match ? match[1] : null;
    }
    return null;
}

const SPREADSHEET_ID = getEnvValue('GOOGLE_SHEET_ID') || '15Md9ERoAcwPZJ4VbhlqI18cWmOCfunrIavWCZqVgwMA'; // Fallback to what we found
const SHEET_NAME = 'ticketregister';
const RANGE = 'A2:E'; // Assuming header is row 1, headers: numero, fixed, phone, cedula, payed

// --- FIREBASE INIT ---
if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`Error: Service account key not found at ${SERVICE_ACCOUNT_KEY_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// --- GOOGLE SHEETS INIT ---
if (!fs.existsSync(SERVICE_ACCOUNT_SHEETS_PATH)) {
    console.error(`Error: Sheets Service account not found at ${SERVICE_ACCOUNT_SHEETS_PATH}`);
    process.exit(1);
}

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_SHEETS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function importTickets() {
    console.log('🚀 Starting Ticket Import Process...');

    try {
        // 1. Read Sheets Data
        console.log(`Reading from Sheet: ${SHEET_NAME}, Range: ${RANGE}`);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!${RANGE}`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in the sheet.');
            return;
        }

        console.log(`Found ${rows.length} rows to process.`);

        // 2. Process Rows
        const batchSize = 500;
        let batch = db.batch();
        let count = 0;
        let totalProcessed = 0;

        for (const row of rows) {
            // Mapping based on user image:
            // A: numero  -> ticketId
            // B: fixed   -> fixed (might not be needed for ticketregister doc logic, but saving it is fine)
            // C: phone   -> phone
            // D: cedula  -> cedula
            // E: payed   -> payed

            const [numero, fixed, phone, cedula, payed] = row;

            if (!numero || !phone) {
                console.warn(`Skipping row with missing ticketId (numero) or phone: ${JSON.stringify(row)}`);
                continue;
            }

            // Create a reference for a new document in 'ticketregister'
            // We can use auto-ID or use the ticketId as part of the ID for idempotency?
            // Using auto-ID allows multiple registrations attempt (log style).
            // But maybe user wants unique? Let's use auto-ID as standard for 'events'.
            const docRef = db.collection('ticketregister').doc();

            // Prepare data
            const data = {
                ticketId: String(numero),
                phone: String(phone).replace(/\D/g, ''), // Clean phone
                cedula: String(cedula),
                payed: payed ? String(payed).toLowerCase() : 'no', // normalize
                fixed: fixed || '',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                importedAt: new Date().toISOString()
            };

            batch.set(docRef, data);
            count++;
            totalProcessed++;

            // Commit batch if limit reached
            if (count >= batchSize) {
                console.log(`Committing batch of ${count} records...`);
                await batch.commit();
                batch = db.batch(); // New batch
                count = 0;
            }
        }

        // Commit remaining
        if (count > 0) {
            console.log(`Committing final batch of ${count} records...`);
            await batch.commit();
        }

        console.log(`✅ Import finished. Processed ${totalProcessed} tickets.`);

    } catch (error) {
        console.error('❌ Error during import:', error);
    }
}

importTickets();
