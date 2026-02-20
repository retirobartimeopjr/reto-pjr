
import type { APIRoute } from 'astro';
import { userCache } from '../../lib/serverUserCache';
import { db } from '../../services/firebase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { phone } = body;

        if (!phone) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Teléfono es requerido'
            }), { status: 400 });
        }

        // Use the Cache Service
        const user = await userCache.findUserByPhone(String(phone));

        if (!user) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Usuario no encontrado'
            }), { status: 404 });
        }

        // Check for Pending Referrals
        try {
            const userPhone = String(user.phone);
            const pendingRefDoc = await db.collection('pending_referrals').doc(userPhone).get();

            if (pendingRefDoc.exists) {
                const pendingData = pendingRefDoc.data();
                const referrerPhone = pendingData?.referralPhone;

                if (referrerPhone && (!user.referencia || user.referencia.length < 5)) {
                    console.log(`[Login] Found pending referral for ${userPhone} -> Referrer: ${referrerPhone}`);

                    // Update User
                    await db.collection('user').doc(user.docId).update({
                        referencia: referrerPhone
                    });

                    // Delete Pending Record
                    await db.collection('pending_referrals').doc(userPhone).delete();

                    // Update local user object for return
                    user.referencia = referrerPhone;
                }
            }
        } catch (err) {
            console.error("[Login] Error checking pending referrals:", err);
            // Non-blocking error
        }

        // Return User Data (Sanitized if needed, but here we return relevant fields)
        return new Response(JSON.stringify({
            success: true,
            user: {
                docId: user.docId,
                phone: user.phone,
                username: user.username,
                ticketsFixed: user.ticketsFixed,
                payedTickets: user.payedTickets,
                score: user.score,
                parroquiasVistitadas: user.parroquiasVistitadas,
                preguntasVistas: user.preguntasVistas,
                referencia: user.referencia, // Will include updated reference if applicable
                'tickets-numbers': user['tickets-numbers']
            }
        }), { status: 200 });

    } catch (error) {
        console.error("Login API Error:", error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno del servidor'
        }), { status: 500 });
    }
};
