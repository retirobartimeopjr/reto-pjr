import type { APIRoute } from 'astro';
import { db } from '../../services/firebase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, referralPhone } = body;

        if (!userId || !referralPhone) {
            return new Response(JSON.stringify({ success: false, error: "Faltan datos requeridos." }), { status: 400 });
        }

        const targetPhone = String(referralPhone).trim();

        // 1. Get Current User Data (Validation)
        const userRef = db.collection('user').doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return new Response(JSON.stringify({ success: false, error: "Usuario no encontrado." }), { status: 404 });
        }

        const userData = userSnap.data();
        const payedTickets = Number(userData?.payedTickets || userData?.payedtickets || 0);

        // CHECK 1: Must have payed tickets
        if (payedTickets < 1) {
            return new Response(JSON.stringify({ success: false, error: "Necesitas al menos 1 ticket pago para referir." }), { status: 403 });
        }

        // CHECK 2: Cannot refer self
        if (userData?.phone === targetPhone) {
            return new Response(JSON.stringify({ success: false, error: "No puedes referirte a ti mismo." }), { status: 400 });
        }

        // CHECK 3: Cannot change if already set (Double check server side)
        if (userData?.referencia && userData.referencia.length > 5) {
            return new Response(JSON.stringify({ success: false, error: "Ya tienes un referido asignado." }), { status: 400 });
        }

        // 2. Validate Target User (Does the referral phone exist?)
        // query by phone
        const targetQuery = await db.collection('user').where('phone', '==', targetPhone).limit(1).get();

        if (targetQuery.empty) {
            return new Response(JSON.stringify({ success: false, error: "El número no está registrado en Bartimeo." }), { status: 404 });
        }

        // 3. EXECUTE WRITE
        // We simply write the reference. The existing Cloud Function will handle the incrementing of the counter.
        // This API endpoint serves as the "Guard/Validator" to ensure we only write valid data.
        await userRef.update({
            referencia: targetPhone
        });

        return new Response(JSON.stringify({
            success: true,
            referencia: targetPhone
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Referral API Error:", error);
        return new Response(JSON.stringify({ success: false, error: "Error interno del servidor." }), { status: 500 });
    }
}
