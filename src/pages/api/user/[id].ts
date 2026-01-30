import type { APIRoute } from 'astro';
import { db } from '../../../services/firebase';

export const GET: APIRoute = async ({ params }) => {
    const { id } = params;

    if (!id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }

    try {
        const doc = await db.collection('users').doc(id).get();

        if (!doc.exists) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }

        const userData = doc.data();
        // Return only necessary fields or full object depending on needs
        // Ensure to include score and visited list
        return new Response(JSON.stringify({
            docId: doc.id,
            username: userData?.username,
            score: userData?.score || "0",
            parroquiasVistitadas: userData?.parroquiasVistitadas || "",
            // Add other fields if needed by the frontend store
            phone: userData?.phone,
            ticketsFixed: userData?.ticketsFixed,
            payedTickets: userData?.payedTickets,
            preguntasVistas: userData?.preguntasVistas,
            referencia: userData?.referencia,
            isAuthenticated: "true"
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error("API Error fetching user:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
