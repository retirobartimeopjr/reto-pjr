import type { APIRoute } from 'astro';
import { db } from '../../../services/firebase';

export const GET: APIRoute = async ({ url }) => {
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }

    try {
        // 1. Get User's unseen questions & Daily Limit Check
        const userDoc = await db.collection('user').doc(userId).get();
        if (!userDoc.exists) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }

        const userData = userDoc.data();

        // --- DAILY LIMIT CHECK ---
        const today = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }).split(",")[0]; // Format: M/D/YYYY

        let dailyCount = 0;
        if (userData?.lastTriviaDate === today) {
            dailyCount = userData.dailyTriviaCount || 0;
        }

        if (dailyCount >= 10) {
            return new Response(JSON.stringify({
                empty: true,
                limitReached: true,
                message: "¡Has alcanzado el límite de 10 preguntas por hoy! Vuelve mañana para ganar más puntos."
            }), { status: 200 });
        }
        // -------------------------

        // Handling case sensitivity for 'preguntasVistas' field (could be lower or camel case)
        const preguntasVistasStr = userData?.preguntasVistas || userData?.preguntasvistas || "";
        const seenIds = preguntasVistasStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

        // 2. Fetch all available questions
        const questionsSnap = await db.collection('pregunta').get();

        const availableQuestions = questionsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((q: any) => !seenIds.includes(q.id));

        if (availableQuestions.length === 0) {
            return new Response(JSON.stringify({ empty: true, message: "¡Ya respondiste todas las trivias disponibles!" }), { status: 200 });
        }

        // 3. Pick Random
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const selectedQ: any = availableQuestions[randomIndex];

        // 4. Return formatted question (Hide correct answer)
        const responseData = {
            id: selectedQ.id,
            pregunta: selectedQ.pregunta,
            options: [
                selectedQ.opcionA,
                selectedQ.opcionB,
                selectedQ.opcionC,
                selectedQ.opcionD
            ].filter(Boolean), // Ensure no empty options
            reward: selectedQ.reward || 0,
            dailyCount: dailyCount + 1, // Return current attempt number
            maxDaily: 10
        };

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Trivia Question API Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
