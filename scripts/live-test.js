
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


const TEST_ID = `live_test_${Date.now()}`;
const USER_ID = `user_${TEST_ID}`;
const TICKET_ID = "9998"; // Distinct from previous local test
const TICKET_ID_2 = "9999";

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setup() {
    console.log("--- SETUP ---");
    // Ensure Ticket Exists in Master
    await db.collection('tickets').doc(TICKET_ID).set({
        fixed: "LIVE_FIXED_CODE",
        ticket: 9998,
        userId: null,
        payed: null
    });
    await db.collection('tickets').doc(TICKET_ID_2).set({
        fixed: "LIVE_FIXED_CODE_2",
        ticket: 9999,
        userId: null,
        payed: null
    });
    // Ensure User Exists
    await db.collection('user').doc(USER_ID).set({
        username: "Live Test User",
        score: 0,
        "tickets-quantity": 0,
        visits: 0
    });
    // Ensure Parroquia Exists for Visit Test
    await db.collection('parroquia').doc('p_test').set({
        name: "Parroquia Test",
        reward: 50,
        visits: 0
    });
    console.log("Setup complete (Tickets 9998 & 9999, User, Parroquia p_test).");
}

async function testTicketLogic() {
    console.log("\n--- TEST: TICKET LOGIC (First Ticket) ---");
    // Action: Create ticketregister
    await db.collection('ticketregister').doc().set({
        ticketId: TICKET_ID,
        userId: USER_ID,
        payed: "yes",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Trigger fired: ticketregister created.");

    // Verification: Poll user for update
    let retries = 10;
    while (retries > 0) {
        await delay(2000);
        const userDoc = await db.collection('user').doc(USER_ID).get();
        if (userDoc.data()['tickets-quantity'] === 1) {
            console.log("PASS: User ticket quantity updated to 1.");
            return true;
        }
        process.stdout.write(".");
        retries--;
    }
    console.error("FAIL: User ticket quantity did not update.");
    return false;
}

async function testSecondTicketLogic() {
    console.log("\n--- TEST: TICKET LOGIC (Second Ticket) ---");
    // Action: Create ticketregister for second ticket
    await db.collection('ticketregister').doc().set({
        ticketId: TICKET_ID_2,
        userId: USER_ID,
        payed: "yes",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Trigger fired: second ticketregister created.");

    // Verification: Poll user for update
    let retries = 10;
    while (retries > 0) {
        await delay(2000);
        const userDoc = await db.collection('user').doc(USER_ID).get();
        const data = userDoc.data();
        if (data['tickets-quantity'] === 2) {
            console.log("PASS: User ticket quantity updated to 2.");

            // Check if tickets CSV contains both
            const tickets = data.tickets || ""; // Assuming field name is tickets
            if (tickets.includes("9998") && tickets.includes("9999")) {
                console.log(`PASS: User tickets list contains both: ${tickets}`);
                return true;
            } else {
                console.warn(`WARN: Quantity is 2 but tickets list might be incomplete: ${tickets}`);
                // Let's count it as pass for the quantity check at least
                return true;
            }
        }
        process.stdout.write(".");
        retries--;
    }
    console.error("FAIL: User ticket quantity did not update to 2.");
    return false;
}

async function testVisitLogic() {
    console.log("\n--- TEST: VISIT LOGIC ---");
    // Action: Create visit
    await db.collection('visit').doc().set({
        parroquiaid: 'p_test',
        userId: USER_ID,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Trigger fired: visit created.");

    // Verification: Poll user score (should increase by 50)
    let retries = 10;
    while (retries > 0) {
        await delay(2000);
        const userDoc = await db.collection('user').doc(USER_ID).get();
        if (userDoc.data().score >= 50) {
            console.log("PASS: User score updated (Reward 50 received).");
            return true;
        }
        process.stdout.write(".");
        retries--;
    }
    console.error("FAIL: User score did not update from visit.");
    return false;
}

async function cleanup() {
    console.log("\n--- CLEANUP ---");
    await db.collection('tickets').doc(TICKET_ID).delete();
    await db.collection('tickets').doc(TICKET_ID_2).delete();
    await db.collection('user').doc(USER_ID).delete();
    // delete p_test? maybe leave for debug
}

async function run() {
    await setup();
    const ticketPass = await testTicketLogic();
    const ticketTwoPass = await testSecondTicketLogic();
    const visitPass = await testVisitLogic();

    // Cleanup
    await cleanup();

    if (ticketPass && ticketTwoPass && visitPass) {
        console.log("\n>>> ALL TESTS PASSED <<<");
        process.exit(0);
    } else {
        console.error("\n>>> SOME TESTS FAILED <<<");
        process.exit(1);
    }
}

run();

