import type { APIRoute } from 'astro';
import { admin, db } from '../../../services/firebase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, preguntaId, respuesta } = body;

        if (!userId || !preguntaId || !respuesta) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        // 1. Verify Question
        const preguntaRef = db.collection('pregunta').doc(String(preguntaId));
        const preguntaDoc = await preguntaRef.get();

        if (!preguntaDoc.exists) {
            return new Response(JSON.stringify({ error: "Question not found" }), { status: 404 });
        }

        const preguntaData = preguntaDoc.data();
        const correctAnswer = preguntaData?.respuestaCorrecta;
        const reward = Number(preguntaData?.reward) || 0;

        // 2. Validate Answer
        const isCorrect = respuesta === correctAnswer;

        // 3. Write to 'respuesta' collection (Triggers Cloud Function)
        const respuestaRef = db.collection('respuesta').doc();
        await respuestaRef.set({
            userId,
            preguntaid: preguntaId,
            respuesta: respuesta,
            correcta: isCorrect,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4. Return result for Optimistic UI
        return new Response(JSON.stringify({
            success: true,
            isCorrect: isCorrect,
            reward: isCorrect ? reward : 0,
            correctAnswer: correctAnswer
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Trivia Answer API Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
