import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import { SignJWT } from 'jose';

// Requiere JWT_SECRET en el .env
const secret = new TextEncoder().encode(import.meta.env.JWT_SECRET || process.env.JWT_SECRET);

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { phone } = body;

        if (!phone || typeof phone !== 'string') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Teléfono inválido o requerido'
            }), { status: 400 });
        }

        // Consultamos a Postgres con un JOIN dinámico que reemplaza la necesidad de Firebase y pre-calcula los stats en milisegundos
        const sql = `
            SELECT 
                u.id, u.phone, u.username, u.referencia, 
                (SELECT COUNT(*) FROM tickets WHERE user_id = u.id AND payed = 'yes') AS payed_tickets,
                (SELECT STRING_AGG(parroquia_id::TEXT, ',') FROM user_parroquia_visits WHERE user_id = u.id) AS visited_parroquias_ids,
                (SELECT json_agg(json_build_object('id', parroquia_id, 'date', visited_at)) FROM user_parroquia_visits WHERE user_id = u.id) AS visited_parroquias_json,
                (SELECT STRING_AGG(pregunta_id::TEXT, ',') FROM user_trivia_answers WHERE user_id = u.id) AS answered_preguntas_ids,
                (SELECT STRING_AGG(ticket_number::TEXT, ',') FROM tickets WHERE user_id = u.id) AS ticket_numbers,
                (SELECT STRING_AGG(fixed::TEXT, ',') FROM tickets WHERE user_id = u.id) AS tickets_fixed,
                COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
                COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) AS total_score
            FROM users u
            WHERE u.phone = $1 LIMIT 1;
        `;
        
        const res = await query(sql, [phone]);

        if (res.rowCount === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Usuario no encontrado en la base de datos'
            }), { status: 404 });
        }

        const userRow = res.rows[0];

        // 1. Generar Token JWT seguro
        const token = await new SignJWT({ userId: userRow.id, phone: userRow.phone })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h') // Caduca en 24h
            .sign(secret);

        // 2. Establecer Cookie HttpOnly (Previene XSS)
        const headers = new Headers();
        headers.append('Set-Cookie', `auth_token=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=86400`);
        headers.append('Content-Type', 'application/json');

        // Format user object exactly as frontend expects it
        return new Response(JSON.stringify({
            success: true,
            user: {
                docId: userRow.id,
                phone: userRow.phone,
                username: userRow.username,
                ticketsFixed: userRow.tickets_fixed || "",
                payedTickets: String(userRow.payed_tickets || 0),
                score: String(userRow.total_score || 0),
                parroquiasVistitadas: userRow.visited_parroquias_ids || "",
                visited_parroquias_json: JSON.stringify(userRow.visited_parroquias_json || []),
                preguntasVistas: userRow.answered_preguntas_ids || "",
                referencia: userRow.referencia || "",
                'tickets-numbers': userRow.ticket_numbers || ""
            }
        }), { status: 200, headers });

    } catch (error) {
        console.error("❌ Postgres Login API Error:", error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno del servidor (Postgres)'
        }), { status: 500 });
    }
};
