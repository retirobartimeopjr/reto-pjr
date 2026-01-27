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

const preguntasEjemplo = [
    {
        preguntaid: "1",
        tipo: "multiple",
        reward: 100,
        pregunta: "¿Quién fundó la Iglesia?",
        respuestaCorrecta: "Jesucristo",
        opcionA: "Pedro",
        opcionB: "Pablo",
        opcionC: "Jesucristo",
        opcionD: "Juan",
        dia: 25, hora: 10, mes: 10
    },
    {
        preguntaid: "2",
        tipo: "boolean",
        reward: 50,
        pregunta: "¿La Biblia tiene 73 libros?",
        respuestaCorrecta: "Verdadero",
        opcionA: "Verdadero",
        opcionB: "Falso",
        opcionC: "",
        opcionD: "",
        dia: 26, hora: 14, mes: 10
    },
    {
        preguntaid: "3",
        tipo: "multiple",
        reward: 200,
        pregunta: "¿Cuál es el primer libro de la Biblia?",
        respuestaCorrecta: "Génesis",
        opcionA: "Éxodo",
        opcionB: "Génesis",
        opcionC: "Levítico",
        opcionD: "Números",
        dia: 27, hora: 9, mes: 11
    }
];

async function subirPreguntas() {
    console.log("🚀 Iniciando carga de preguntas...");
    const batch = db.batch();

    preguntasEjemplo.forEach((p) => {
        const ref = db.collection('pregunta').doc(p.preguntaid);
        batch.set(ref, p);
    });

    await batch.commit();
    console.log("✅ 3 Preguntas de ejemplo creadas exitosamente.");
}

subirPreguntas().catch(console.error);