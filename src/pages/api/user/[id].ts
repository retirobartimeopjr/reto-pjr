import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ params }) => {
    const { id } = params;

    if (!id) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }

    try {
        const sql = `
            SELECT 
                u.id, u.phone, u.username, u.referencia, u.payed_tickets,
                (SELECT STRING_AGG(DISTINCT parroquia_id::TEXT, ',') FROM user_parroquia_visits WHERE user_id = u.id) AS visited_parroquias_ids,
                (SELECT json_agg(json_build_object('id', parroquia_id, 'date', visited_at)) FROM user_parroquia_visits WHERE user_id = u.id) AS visited_parroquias_json,
                (SELECT STRING_AGG(pregunta_id::TEXT, ',') FROM user_trivia_answers WHERE user_id = u.id) AS answered_preguntas_ids,
                (SELECT STRING_AGG(ticket_number::TEXT, ',') FROM tickets WHERE user_id = u.id) AS ticket_numbers,
                (SELECT STRING_AGG(fixed::TEXT, ',') FROM tickets WHERE user_id = u.id) AS tickets_fixed,
                (SELECT calculated_score FROM user_stats WHERE user_id = u.id) AS total_score
            FROM users u
            WHERE u.id = $1;
        `;

        const res = await query(sql, [id]);

        if (res.rowCount === 0) {
            return new Response(JSON.stringify({ error: "Usuario no encontrado en Postgres" }), { status: 404 });
        }

        const userRow = res.rows[0];

        // Mapeamos los datos exactamente al formato que espera el userStore en el cliente
        return new Response(JSON.stringify({
            docId: userRow.id,
            username: userRow.username,
            score: String(userRow.total_score || 0),
            parroquiasVistitadas: userRow.visited_parroquias_ids || "",
            visited_parroquias_json: JSON.stringify(userRow.visited_parroquias_json || []),
            phone: userRow.phone,
            ticketsFixed: userRow.tickets_fixed || "",
            payedTickets: String(userRow.payed_tickets || 0),
            preguntasVistas: userRow.answered_preguntas_ids || "",
            referencia: userRow.referencia || "",
            isAuthenticated: "true",
            'tickets-numbers': userRow.ticket_numbers || ""
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error("❌ API Error fetching user from Postgres:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error (Postgres)" }), { status: 500 });
    }
}
