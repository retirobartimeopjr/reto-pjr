
import admin from 'firebase-admin';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function verify() {
    console.log("Verifying Firestore Data...");
    const snapshot = await db.collection('parroquias').get();
    console.log(`✅ Success: Found ${snapshot.size} parroquias in Firestore.`);

    if (snapshot.size > 0) {
        const doc = snapshot.docs[0];
        console.log('Sample Document ID:', doc.id);
        console.log('Sample Data:', JSON.stringify(doc.data(), null, 2));
    } else {
        console.error('❌ Error: No documents found in "parroquias" collection.');
    }
    process.exit(0);
}

verify().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
