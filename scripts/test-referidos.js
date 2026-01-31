
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

// --- HELPERS ---
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(`\n🧪 --- INICIANDO TEST DE REFERIDOS (CASO ESPECÍFICO) ---`);

    // DATOS PROPORCIONADOS POR EL USUARIO
    const AHIJADO_ID = "Sgx7Iv2J3hstkCwWVBJ5";
    const PADRINO_ID = "KyeLSxOhSRYbk8cwE9kN";
    const PADRINO_PHONE = "3123415728";

    console.log(`Target Ahijado: ${AHIJADO_ID} (Debe tener tickets pagos)`);
    console.log(`Target Padrino: ${PADRINO_ID} (Phone: ${PADRINO_PHONE})`);

    const ahijadoRef = db.collection('user').doc(AHIJADO_ID);
    const padrinoRef = db.collection('user').doc(PADRINO_ID);

    // 1. LEER ESTADO INICIAL
    const ahijadoSnap = await ahijadoRef.get();
    const padrinoSnap = await padrinoRef.get();

    if (!ahijadoSnap.exists || !padrinoSnap.exists) {
        console.error("❌ Error: Uno de los usuarios no existe en la BD.");
        process.exit(1);
    }

    const initialReferidos = padrinoSnap.data().referidos || 0;
    console.log(`\n� Estado Inicial Padrino - Referidos: ${initialReferidos}`);

    // Limpieza previa (Opcional, pero bueno para repetir tests)
    // Aseguramos que el ahijado no tenga referencia para que el trigger funcione
    console.log("🧹 Limpiando referencia del ahijado para la prueba...");
    await ahijadoRef.update({ referencia: "" });
    await delay(2000); // Esperar que se propague

    // ---------------------------------------------------------
    // EJECUTAR REFERENCIA
    // ---------------------------------------------------------
    console.log(`\n🚀 Asignando referencia ${PADRINO_PHONE} al ahijado...`);
    await ahijadoRef.update({ referencia: PADRINO_PHONE });

    console.log("   Esperando Cloud Function (Sumar punto a Padrino)...");

    let success = false;
    for (let i = 0; i < 15; i++) { // 30 segundos max
        process.stdout.write("⏳ ");
        await delay(2000);

        const currentPadrinoSnap = await padrinoRef.get();
        const currentReferidos = currentPadrinoSnap.data().referidos || 0;

        // Buscamos que haya incrementado en 1
        if (currentReferidos > initialReferidos) {
            console.log(`\n\n✅ ¡ÉXITO! Referidos incrementó: ${initialReferidos} -> ${currentReferidos}`);
            success = true;
            break;
        }
    }

    if (!success) {
        console.error("\n\n❌ TIEMPO AGOTADO: El contador de referidos no cambió.");
        const finalAhijado = (await ahijadoRef.get()).data();
        console.log("Estado Final Ahijado:", JSON.stringify(finalAhijado.referencia, null, 2));
    } else {
        console.log("\n🎉 PRUEBA COMPLETADA EXITOSAMENTE.");
    }

    process.exit(success ? 0 : 1);
}

runTest();
