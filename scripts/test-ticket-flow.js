
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

const TEST_PHONE = "3123415728";
const TEST_CEDULA = "1234";
const TEST_TICKET_ID = "2";
const IS_PAYED = true;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(`--- STARTING TEST: REGISTER TICKET ${TEST_TICKET_ID} ---`);
    console.log(`Data: Phone=${TEST_PHONE}, Cedula=${TEST_CEDULA}, Payed=${IS_PAYED}`);

    // 1. Create ticketregister document
    // We use a specific ID or auto-ID. Let's use auto-ID as typical.
    const registerRef = db.collection('ticketregister').doc();
    console.log(`Creating ticketregister document: ${registerRef.id}...`);

    await registerRef.set({
        ticketId: TEST_TICKET_ID,
        phone: TEST_PHONE,
        cedula: TEST_CEDULA,
        payed: IS_PAYED,
        username: "Test User " + TEST_PHONE, // Optional, mimicking app behavior
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("Document created. Waiting for Cloud Function to process...");

    // 2. Verification Loop
    let userId = null;
    let success = false;

    // Poll Ticket Master
    for (let i = 0; i < 15; i++) {
        await delay(2000); // Wait 2s
        process.stdout.write(".");

        const ticketDoc = await db.collection('tickets').doc(TEST_TICKET_ID).get();
        if (!ticketDoc.exists) {
            console.error(`\nERROR: Master Ticket ${TEST_TICKET_ID} does not exist! Test cannot pass.`);
            break;
        }

        const data = ticketDoc.data();
        if (data['user-id']) {
            console.log(`\n\n[CHECK 1] Ticket Master updated! Assigned to User ID: ${data['user-id']}`);
            userId = data['user-id'];
            break;
        }
    }

    if (userId) {
        // Poll User
        console.log(`Checking User document: ${userId}...`);
        const userDoc = await db.collection('user').doc(userId).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log("[CHECK 2] User found:", JSON.stringify(userData, null, 2));

            const hasTicket = (userData['tickets-numbers'] || "").includes(TEST_TICKET_ID);
            const correctQty = userData['tickets-quantity'] >= 1;

            if (hasTicket && correctQty) {
                console.log("\n>>> SUCCESS: Ticket flow verification PASSED! <<<");
                success = true;
            } else {
                console.error("\n>>> FAIL: User document missing ticket number or quantity update.");
            }
        } else {
            console.error("\n>>> FAIL: User document referenced in ticket not found.");
        }
    } else {
        console.error("\n>>> FAIL: Ticket Master was not updated within timeout.");
    }

    process.exit(success ? 0 : 1);
}

runTest();
