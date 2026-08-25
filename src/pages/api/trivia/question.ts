import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ url }) => {
    const userId = url.searchParams.get('userId');
    const isGuest = url.searchParams.get('isGuest') === 'true';

    if (!isGuest && !userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }

    try {
        const isPractice = url.searchParams.get('isPractice') === 'true';
        let dailyCount = 0;
        let selectedQ;

        if (isGuest) {
            const sqlRandomQuestion = `
                SELECT id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, reward
                FROM preguntas
                ORDER BY RANDOM()
                LIMIT 1;
            `;
            const questionRes = await query(sqlRandomQuestion);
            if (questionRes.rowCount === 0) {
                return new Response(JSON.stringify({ empty: true, message: "No hay preguntas disponibles." }), { status: 200 });
            }
            selectedQ = questionRes.rows[0];
        } else {
            // 1. Verificamos el límite diario del usuario en Postgres
            const userRes = await query('SELECT daily_trivia_count, last_trivia_date FROM users WHERE id = $1', [userId]);
            
            if (userRes.rowCount === 0) {
                return new Response(JSON.stringify({ error: "Usuario no encontrado" }), { status: 404 });
            }

            const limitCheckRes = await query(`
                SELECT 
                    daily_trivia_count,
                    (last_trivia_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE) as is_today
                FROM users WHERE id = $1;
            `, [userId]);

            const limitData = limitCheckRes.rows[0];

            if (limitData.is_today) {
                dailyCount = limitData.daily_trivia_count || 0;
            }

            if (!isPractice && dailyCount >= 10) {
                return new Response(JSON.stringify({
                    empty: true,
                    limitReached: true,
                    message: "¡Has alcanzado el límite de 10 preguntas por hoy! Vuelve mañana para ganar más puntos."
                }), { status: 200 });
            }

            // 2. Traemos una pregunta aleatoria que el usuario NO haya respondido antes.
            const sqlRandomQuestion = `
                SELECT id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, reward
                FROM preguntas
                WHERE id NOT IN (SELECT pregunta_id FROM user_trivia_answers WHERE user_id = $1)
                ORDER BY RANDOM()
                LIMIT 1;
            `;

            const questionRes = await query(sqlRandomQuestion, [userId]);

            if (questionRes.rowCount === 0) {
                return new Response(JSON.stringify({ empty: true, message: "¡Ya respondiste todas las trivias disponibles!" }), { status: 200 });
            }

            selectedQ = questionRes.rows[0];
        }

        // 3. Devolvemos la pregunta formateada (sin la respuesta correcta)
        const responseData = {
            id: selectedQ.id,
            pregunta: selectedQ.pregunta,
            options: [
                selectedQ.opcion_a,
                selectedQ.opcion_b,
                selectedQ.opcion_c,
                selectedQ.opcion_d
            ].filter(Boolean), // Evitar opciones nulas
            reward: selectedQ.reward || 0,
            dailyCount: dailyCount + 1, // Retornamos el número de intento actual
            maxDaily: 10
        };

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("❌ Postgres Trivia Question API Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
