import type { APIRoute } from 'astro';
import { db } from '../../../services/firebase';

export const GET: APIRoute = async ({ url }) => {
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }

    try {
        // 1. Get User's unseen questions
        const userDoc = await db.collection('user').doc(userId).get();
        if (!userDoc.exists) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }

        const userData = userDoc.data();
        const preguntasVistasStr = userData?.preguntasvistas || "";
        const seenIds = preguntasVistasStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

        // 2. Fetch all available questions
        // Note: For large datasets, this is inefficient. 
        // Better approach: Store 'available_questions' list or random ID generation. 
        // But for <100 questions, fetching collection is fine.
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
            reward: selectedQ.reward || 0
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
