
import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// We use require to load the JSON file at runtime to avoid TS resolution issues without resolveJsonModule
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

export { admin, db };

