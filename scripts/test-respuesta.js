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

// --- CONFIGURACIÓN ---
// Usamos la Pregunta ID "1" que ya creaste con el script de semillas.
// Debería ser: Reward 100, Respuesta "Jesucristo"
const TEST_PREGUNTA_ID = "1"; 
const TEST_USER_ID = "KyeLSxOhSRYbk8cwE9kN"; // Tu usuario existente

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(`\n🧪 --- INICIANDO TEST REAL (SIN MODIFICAR MAESTROS) ---`);
    console.log(`Target Usuario: ${TEST_USER_ID}`);
    console.log(`Target Pregunta: ${TEST_PREGUNTA_ID}`);

    // ---------------------------------------------------------
    // 1. LEER DATOS EXISTENTES (READ ONLY)
    // ---------------------------------------------------------
    console.log("🔍 1. Leyendo datos actuales de la Base de Datos...");

    // A. Leer la Pregunta para saber qué esperar
    const preguntaRef = db.collection('pregunta').doc(TEST_PREGUNTA_ID);
    const preguntaSnap = await preguntaRef.get();

    if (!preguntaSnap.exists) {
        console.error("❌ La pregunta ID 1 no existe. Ejecuta primero 'subir_preguntas.js'");
        process.exit(1);
    }

    const preguntaData = preguntaSnap.data();
    const EXPECTED_REWARD = Number(preguntaData.reward);
    const RESPUESTA_CORRECTA_REAL = preguntaData.respuestaCorrecta; // Ej: "Jesucristo"

    console.log(`   > Pregunta encontrada: "${preguntaData.pregunta}"`);
    console.log(`   > Respuesta Correcta DB: "${RESPUESTA_CORRECTA_REAL}"`);
    console.log(`   > Puntos a ganar: ${EXPECTED_REWARD}`);

    // B. Leer el Usuario para tener la linea base
    const userRef = db.collection('user').doc(TEST_USER_ID);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        console.error("❌ El usuario no existe.");
        process.exit(1);
    }

    const userData = userSnap.data();
    const initialScore = userData.score || 0;
    const initialEnviadas = userData.respuestasEnviadas || 0;
    const initialCorrectas = userData.respuestasCorrectas || 0;

    console.log(`   > Estado Usuario ACTUAL -> Score: ${initialScore} | Enviadas: ${initialEnviadas} | Correctas: ${initialCorrectas}`);

    // ---------------------------------------------------------
    // 2. EJECUTAR ACCIÓN (CREAR RESPUESTA)
    // ---------------------------------------------------------
    console.log("🚀 2. Enviando respuesta...");
    
    const respuestaRef = db.collection('respuesta').doc();
    await respuestaRef.set({
        userId: TEST_USER_ID,
        preguntaid: TEST_PREGUNTA_ID,
        respuesta: RESPUESTA_CORRECTA_REAL, // Enviamos la que leímos de la DB
        correcta: true, 
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`   Respuesta enviada (ID: ${respuestaRef.id}). Esperando Cloud Function...`);

    // ---------------------------------------------------------
    // 3. VALIDACIÓN
    // ---------------------------------------------------------
    let success = false;
    for (let i = 0; i < 12; i++) { // Esperar hasta 24 segundos
        await delay(2000); 
        process.stdout.write("⏳ ");

        const updatedUserSnap = await userRef.get();
        const updatedUser = updatedUserSnap.data();
        
        const updatedRespuestaSnap = await respuestaRef.get();
        const updatedRespuesta = updatedRespuestaSnap.data();

        // CÁLCULOS ESPERADOS
        const expectedScore = initialScore + EXPECTED_REWARD;
        const expectedEnviadas = initialEnviadas + 1;
        const expectedCorrectas = initialCorrectas + 1;

        // VERIFICACIÓN
        // 1. Score
        const scoreOk = updatedUser.score === expectedScore;
        // 2. Contadores
        const enviadasOk = updatedUser.respuestasEnviadas === expectedEnviadas;
        const correctasOk = updatedUser.respuestasCorrectas === expectedCorrectas;
        // 3. Snapshot en respuesta (Prueba de que la función corrió)
        const snapshotOk = updatedRespuesta.snapshotReward === EXPECTED_REWARD;

        if (scoreOk && enviadasOk && correctasOk && snapshotOk) {
            console.log("\n\n✅ ¡ÉXITO! Datos actualizados correctamente.");
            console.log("------------------------------------------------");
            console.log(`Score Anterior: ${initialScore}  --> Nuevo: ${updatedUser.score}`);
            console.log(`Enviadas Ant.:  ${initialEnviadas} --> Nuevo: ${updatedUser.respuestasEnviadas}`);
            console.log(`Correctas Ant.: ${initialCorrectas} --> Nuevo: ${updatedUser.respuestasCorrectas}`);
            success = true;
            break;
        }
    }

    if (!success) {
        console.error("\n\n❌ TIEMPO AGOTADO: Los datos no cambiaron como se esperaba.");
        const finalUser = (await userRef.get()).data();
        console.log("Estado Final Usuario:", JSON.stringify(finalUser, null, 2));
    } else {
        console.log("\n🎉 PRUEBA COMPLETADA.");
    }

    process.exit(success ? 0 : 1);
}

runTest();