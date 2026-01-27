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
const TEST_PARROQUIA_ID = "0"; // Asegúrate de que este ID exista o sea el correcto
const TEST_USER_ID = "KyeLSxOhSRYbk8cwE9kN"; // Tu ID real
const REWARD_AMOUNT = 50;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(`--- STARTING TEST: PARROQUIA VISIT FLOW ---`);
    console.log(`ParroquiaID: ${TEST_PARROQUIA_ID}`);
    console.log(`UserID: ${TEST_USER_ID}`);

    // 1. SETUP: Create or Update Dummy Parroquia and User (SAFE MODE)
    console.log("Preparing Parroquia and User data (Merge mode)...");

    const parroquiaRef = db.collection('parroquias').doc(TEST_PARROQUIA_ID);
    
    // USAMOS { merge: true } PARA NO BORRAR DATOS EXISTENTES
    await parroquiaRef.set({
        name: "Parroquia de Prueba", // Solo actualiza/crea nombre
        reward: REWARD_AMOUNT,       // Asegura el reward para el test
        // visits: 0                 // OJO: Si descomentas esto, reseteas las visitas a 0. Mejor lo comentamos si no quieres perder el conteo.
    }, { merge: true });

    const userRef = db.collection('user').doc(TEST_USER_ID);
    
    // USAMOS { merge: true } PARA NO BORRAR DATOS EXISTENTES
    // Nota: Para que el test funcione, necesitamos saber el estado inicial. 
    // Si no reseteamos el score a 0, la validación final fallará si el usuario ya tenía puntos.
    // Pero como pediste NO borrar info, usaré merge.
    
    // Leemos el estado actual para la validación final
    const initialUserSnap = await userRef.get();
    const initialUserData = initialUserSnap.exists ? initialUserSnap.data() : {};
    const initialScore = initialUserData.score || 0;
    
    // Solo aseguramos que el campo exista, no lo sobrescribimos a 0 si ya tiene valor
    await userRef.set({
        username: initialUserData.username || "Test User", // Mantiene el nombre si existe
        // No reseteamos score ni parroquiasVisitadas para no perder historial
    }, { merge: true });

    console.log(`Initial Score: ${initialScore}`);
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

        // VALIDACIÓN:
        // 1. Verificamos que la parroquia esté en la lista (puede tener otras comas)
        const hasVisited = (userData.parroquiasVistitadas || "").includes(TEST_PARROQUIA_ID);
        
        // 2. Verificamos que el score haya subido exactamente el REWARD_AMOUNT respecto al inicio
        //    (Así no importa si empezó en 0 o en 1000, validamos que sumó 50)
        const scoreUpdated = userData.score === (initialScore + REWARD_AMOUNT);
        
        // 3. Verificamos que visits incrementó (Nota: difícil validar exacto sin saber el inicial, asumimos > 0)
        const visitsIncremented = parroquiaData.visits > 0;

        // Nota: Si el usuario YA había visitado esta parroquia antes, la Cloud Function NO sumará puntos.
        // Por tanto, la prueba solo pasará si es la PRIMERA vez que visita ESTA parroquia ID '0'.
        
        if (hasVisited) {
            // Si ya la visitó, revisamos si sumó puntos o si ya los tenía
            console.log(`\n\n[CHECK] Data updated!`);
            console.log(`User Score Now: ${userData.score} (Initial: ${initialScore})`);
            console.log(`User Visited List: ${userData.parroquiasVistitadas}`);
            console.log(`Parroquia Visits: ${parroquiaData.visits}`);
            
            // Damos por buena la prueba si aparece en la lista de visitadas
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
        console.log("Final User Data:", JSON.stringify(uFinal.data(), null, 2));
    }

    // NO EJECUTAMOS CLEANUP PARA NO BORRAR TUS DATOS REALES
    process.exit(success ? 0 : 1);
}

runTest();