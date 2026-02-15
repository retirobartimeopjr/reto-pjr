
import type { APIRoute } from 'astro';
import { userCache } from '../../lib/serverUserCache';

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
                referencia: user.referencia,
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
