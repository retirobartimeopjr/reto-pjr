
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

// Helper matching index.js
const addToCSV = (csv, value) => {
    const strVal = String(value).trim();
    if (!strVal) return csv || "";
    const items = (csv || "").split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (!items.includes(strVal)) {
        items.push(strVal);
    }
    return items.join(',');
};

// --- SIMULATION OF CLOUD FUNCTION LOGIC ---
// This function mimics exactly what index.js:procesarTicketRegister does
async function simulateTicketProcessing(registerData) {
    console.log(`\n[SIMULATION] Processing Ticket: ${registerData.ticketId} for User: ${registerData.userId}`);

    const ticketId = registerData.ticketId;
    const userId = registerData.userId;
    const isPayed = registerData.payed;

    const ticketRef = db.collection('tickets').doc(ticketId);
    const userRef = db.collection('user').doc(userId);
    const newUserticketRef = db.collection('userticket').doc();

    try {
        await db.runTransaction(async (transaction) => {
            // 1. LEER TODO PRIMERO
            const ticketDoc = await transaction.get(ticketRef);
            let fixedCode = "TEST_FIXED_CODE";

            if (ticketDoc.exists) {
                fixedCode = ticketDoc.data().fixed;
            } else {
                console.log("  > WARNING: Ticket doc missing in read phase.");
            }

            const userDoc = await transaction.get(userRef);
            let currentTicketsStr = "";
            let userExists = userDoc.exists;
            if (userExists) {
                currentTicketsStr = userDoc.data()['tickets-numbers'] || "";
            }

            // 2. Writes
            console.log("  > Updating 'tickets' collection...");
            transaction.update(ticketRef, {
                userId: userId,
                payed: isPayed,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("  > Creating 'userticket' record...");
            transaction.set(newUserticketRef, {
                userId: userId,
                ticketId: ticketId,
                fixed: fixedCode,
                payed: isPayed,
                phone: registerData.phone || "",
                email: registerData.email || "",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("  > Updating 'user' stats...");
            if (!userExists) {
                console.log("  > User not found, creating dummy user...");
                transaction.set(userRef, { username: "Test User", "tickets-numbers": "" });
            }

            const newTicketsStr = addToCSV(currentTicketsStr, ticketId);
            let payedInc = isPayed === "yes" ? 1 : 0;
            let pendingInc = isPayed === "yes" ? 0 : 1;

            transaction.update(userRef, {
                "tickets-quantity": admin.firestore.FieldValue.increment(1),
                "payedtickets": admin.firestore.FieldValue.increment(payedInc),
                "pendingpay": admin.firestore.FieldValue.increment(pendingInc),
                "tickets-numbers": newTicketsStr
            });
        });
        console.log("[SUCCESS] Transaction committed successfully.");
    } catch (e) {
        console.error("[ERROR] Transaction failed:", e);
    }
}

// --- SETUP & EXECUTION ---
async function runTest() {
    const TEST_TICKET_ID_1 = "9998";
    const TEST_TICKET_ID_2 = "9999";
    const TEST_USER_ID = "testUser_" + Date.now();

    console.log("Initializing Test Data...");
    // Create tickets
    await db.collection('tickets').doc(TEST_TICKET_ID_1).set({
        fixed: "FIXED_1",
        ticket: 9998,
        userId: null,
        payed: null
    });
    await db.collection('tickets').doc(TEST_TICKET_ID_2).set({
        fixed: "FIXED_2",
        ticket: 9999,
        userId: null,
        payed: null
    });
    // Create user
    await db.collection('user').doc(TEST_USER_ID).set({
        username: "Test User Initial",
        "tickets-numbers": ""
    });

    console.log("Dummy tickets and user created.");

    // 2. Run logic for Ticket 1
    await simulateTicketProcessing({
        ticketId: TEST_TICKET_ID_1,
        userId: TEST_USER_ID,
        payed: "yes",
        phone: "555-0000"
    });

    // 2b. Run logic for Ticket 2
    await simulateTicketProcessing({
        ticketId: TEST_TICKET_ID_2,
        userId: TEST_USER_ID,
        payed: "yes",
        phone: "555-0000"
    });

    // 3. Verify Result
    console.log("\n--- VERIFICATION ---");
    const user = await db.collection('user').doc(TEST_USER_ID).get();
    console.log("User Stats:", user.data());

    // Cleanup
    console.log("\nCleaning up test data...");
    await db.collection('tickets').doc(TEST_TICKET_ID_1).delete();
    await db.collection('tickets').doc(TEST_TICKET_ID_2).delete();
    await db.collection('user').doc(TEST_USER_ID).delete();
}

runTest();
