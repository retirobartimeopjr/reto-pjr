import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import crypto from 'crypto';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, preguntaId, respuesta, isPractice } = body;

        if (!userId || !preguntaId || !respuesta) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        // 1. Verificar la pregunta en Postgres
        const preguntaRes = await query('SELECT respuesta_correcta, reward FROM preguntas WHERE id = $1', [parseInt(preguntaId)]);

        if (preguntaRes.rowCount === 0) {
            return new Response(JSON.stringify({ error: "Question not found" }), { status: 404 });
        }

        const preguntaData = preguntaRes.rows[0];
        const correctAnswer = preguntaData.respuesta_correcta;
        const reward = Number(preguntaData.reward) || 0;

        // 2. Validar Respuesta
        const isCorrect = String(respuesta).trim() === String(correctAnswer).trim();

        // 3. Guardar la respuesta (con restricción Unique para evitar trampas)
        const answerId = crypto.randomUUID();
        let newCount = 1;

        if (!isPractice) {
            try {
                await query(`
                    INSERT INTO user_trivia_answers (id, user_id, pregunta_id, respuesta_enviada, is_correct, snapshot_reward)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [answerId, userId, parseInt(preguntaId), respuesta, isCorrect, isCorrect ? reward : 0]);
            } catch (err: any) {
                if (err.code === '23505') {
                     return new Response(JSON.stringify({
                        error: "Ya has respondido esta pregunta anteriormente."
                    }), { status: 409 });
                }
                throw err;
            }

            // 4. Actualizar el conteo diario del usuario usando magia de SQL (UPDATE + RETURNING)
            const updateRes = await query(`
                UPDATE users 
                SET daily_trivia_count = CASE 
                        WHEN last_trivia_date = CURRENT_DATE THEN daily_trivia_count + 1 
                        ELSE 1 
                    END,
                    last_trivia_date = CURRENT_DATE
                WHERE id = $1
                RETURNING daily_trivia_count;
            `, [userId]);

            newCount = updateRes.rows[0]?.daily_trivia_count || 1;
        }

        // 5. Retornar resultado al cliente
        return new Response(JSON.stringify({
            success: true,
            isCorrect: isCorrect,
            reward: (isCorrect && !isPractice) ? reward : 0,
            correctAnswer: correctAnswer,
            dailyCount: newCount
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("❌ Postgres Trivia Answer API Error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
