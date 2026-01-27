
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkFirestore() {
    console.log("Checking Firestore...");
    try {
        const collections = await db.listCollections();
        console.log("Collections found:", collections.map(c => c.id));

        const snapshot = await db.collection('parroquias').get();
        console.log(`Documents in 'parroquias': ${snapshot.size}`);

        if (snapshot.size > 0) {
            console.log("Sample doc:", snapshot.docs[0].data());
        }
    } catch (error) {
        console.error("Error checking Firestore:", error);
    }
}

checkFirestore();
