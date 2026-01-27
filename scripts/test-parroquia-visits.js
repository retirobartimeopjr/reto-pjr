
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

// CONSTANTS
const TEST_PARROQUIA_ID = "0";
const TEST_USER_ID = "utvgJnBfh9ZiP2ucIcaT";
const REWARD_AMOUNT = 50;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(`--- STARTING TEST: PARROQUIA VISIT FLOW ---`);
    console.log(`ParroquiaID: ${TEST_PARROQUIA_ID}`);
    console.log(`UserID: ${TEST_USER_ID}`);

    // 1. SETUP: Create Dummy Parroquia and User
    console.log("Creating dummy Parroquia and User...");

    const parroquiaRef = db.collection('parroquias').doc(TEST_PARROQUIA_ID);
    await parroquiaRef.set({
        name: "Parroquia de Prueba",
        reward: REWARD_AMOUNT,
        visits: 0
    });

    const userRef = db.collection('user').doc(TEST_USER_ID);
    await userRef.set({
        username: "Test User",
        score: 0,
        parroquiasVistitadas: ""
    });

    console.log("Setup complete. Waiting a bit...");
    await delay(1000);

    // 2. ACTION: Create a Visit
    console.log("Creating visit document...");
    const visitRef = db.collection('visit').doc();
    await visitRef.set({
        userId: TEST_USER_ID,
        parroquiaid: TEST_PARROQUIA_ID,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Visit document created: ${visitRef.id}. Waiting for Cloud Function...`);

    // 3. VERIFICATION LOOP
    let success = false;
    for (let i = 0; i < 15; i++) {
        await delay(2000); // Poll every 2s
        process.stdout.write(".");

        // Check User Logic
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        // Check Parroquia Logic
        const parroquiaDoc = await parroquiaRef.get();
        const parroquiaData = parroquiaDoc.data();

        const hasVisited = (userData.parroquiasVistitadas || "").includes(TEST_PARROQUIA_ID);
        const scoreUpdated = userData.score === REWARD_AMOUNT;
        const visitsIncremented = parroquiaData.visits === 1;

        if (hasVisited && scoreUpdated && visitsIncremented) {
            console.log(`\n\n[CHECK] Cloud Function success!`);
            console.log(`User Score: ${userData.score} (Expected ${REWARD_AMOUNT})`);
            console.log(`User Visited List: ${userData.parroquiasVistitadas}`);
            console.log(`Parroquia Visits: ${parroquiaData.visits} (Expected 1)`);
            success = true;
            break;
        }
    }

    if (success) {
        console.log("\n>>> SUCCESS: Visit flow verification PASSED! <<<");
    } else {
        console.error("\n>>> FAIL: State did not update correctly within timeout.");
        // Log final state for debugging
        const uFinal = await userRef.get();
        const pFinal = await parroquiaRef.get();
        console.log("Final User Data:", JSON.stringify(uFinal.data(), null, 2));
        console.log("Final Parroquia Data:", JSON.stringify(pFinal.data(), null, 2));
    }

    // 4. CLEANUP (Optional)
    console.log("Cleaning up test data...");
    await visitRef.delete();
    await userRef.delete();
    await parroquiaRef.delete();

    process.exit(success ? 0 : 1);
}

runTest();
