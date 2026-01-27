
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

const QUESTIONS = [
    {
        preguntaid: "q1",
        pregunta: "¿Quién fue el primer Papa de la Iglesia Católica?",
        respuestaCorrecta: "San Pedro",
        opcionA: "San Pablo",
        opcionB: "San Juan",
        opcionC: "San Pedro",
        opcionD: "San Andrés",
        dia: 1, mes: 1, hora: 8
    },
    {
        preguntaid: "q2",
        pregunta: "¿En qué lugar nació Jesús?",
        respuestaCorrecta: "Belén",
        opcionA: "Nazaret",
        opcionB: "Jerusalén",
        opcionC: "Belén",
        opcionD: "Galilea",
        dia: 1, mes: 1, hora: 12
    },
    {
        preguntaid: "q3",
        pregunta: "¿Cuál es el sacramento de la iniciación Cristiana?",
        respuestaCorrecta: "Bautismo",
        opcionA: "Matrimonio",
        opcionB: "Bautismo",
        opcionC: "Unción de los enfermos",
        opcionD: "Orden Sacerdotal",
        dia: 2, mes: 1, hora: 8
    },
    {
        preguntaid: "q4",
        pregunta: "¿Cuántos mandamientos entregó Dios a Moisés?",
        respuestaCorrecta: "10",
        opcionA: "7",
        opcionB: "12",
        opcionC: "5",
        opcionD: "10",
        dia: 2, mes: 1, hora: 12
    },
    {
        preguntaid: "q5",
        pregunta: "¿Qué celebramos en Navidad?",
        respuestaCorrecta: "Nacimiento de Jesús",
        opcionA: "Resurrección",
        opcionB: "Pentecostés",
        opcionC: "Nacimiento de Jesús",
        opcionD: "Ascensión",
        dia: 3, mes: 1, hora: 8
    }
];

async function seed() {
    console.log("Seeding 'pregunta' collection...");
    const batch = db.batch();

    for (const q of QUESTIONS) {
        const ref = db.collection('pregunta').doc(q.preguntaid);
        batch.set(ref, q);
    }

    try {
        await batch.commit();
        console.log(`Successfully seeded ${QUESTIONS.length} questions.`);
    } catch (e) {
        console.error("Error seeding questions:", e);
    }
}

seed();
