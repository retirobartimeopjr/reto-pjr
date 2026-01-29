
import type { APIRoute } from 'astro';
import { admin, db } from '../../services/firebase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, parroquiaId, userLogInfo } = body;

        // Log user info as requested by user
        if (userLogInfo) {
            console.log("--- LOGGED IN USER INFO FROM CLIENT ---");
            console.log("UserID:", userId);
            console.log("ParroquiaID:", parroquiaId);
            console.log("User Snapshot:", JSON.stringify(userLogInfo, null, 2));
            console.log("---------------------------------------");
        }

        if (!userId || !parroquiaId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'UserID y ParroquiaID son requeridos'
            }), { status: 400 });
        }

        // 1. Create Visit Record
        const visitRef = db.collection('visit').doc();
        await visitRef.set({
            userId,
            parroquiaid: parroquiaId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ [VISIT] Recorded visit ${visitRef.id} for User ${userId} at Parroquia ${parroquiaId}`);

        return new Response(JSON.stringify({
            success: true,
            message: 'Visita registrada correctamente',
            visitId: visitRef.id
        }), { status: 200 });

    } catch (error) {
        console.error("❌ [VISIT API ERROR]", error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error registrando la visita'
        }), { status: 500 });
    }
};
