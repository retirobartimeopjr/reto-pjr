
import type { APIRoute } from 'astro';
import { userCache } from '../../lib/serverUserCache';

// Helper to check access key in CSV
const hasAccessKey = (csv: string, key: string) => {
    if (!csv) return false;
    const codes = csv.split(',').map(s => s.trim());
    return codes.includes(key.trim());
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { phone, code } = body;

        if (!phone || !code) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Teléfono y código son requeridos'
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

        // Validate Credential
        const isValid = hasAccessKey(user.ticketsFixed, String(code));

        if (!isValid) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Código de acceso incorrecto'
            }), { status: 401 });
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
                referencia: user.referencia
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
