import type { APIRoute } from 'astro';
import { query, pool } from '../../../lib/db';
import crypto from 'crypto';
import { jwtVerify } from 'jose';

export const POST: APIRoute = async ({ request, cookies }) => {
    let client;
    try {
        const body = await request.json();
        const { preguntaId, respuesta, isPractice, isGuest } = body;

        let userId = '';
        if (!isGuest) {
            const token = cookies.get('auth_token')?.value;
            if (!token) {
                return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });
            }
            const secret = new TextEncoder().encode(import.meta.env.JWT_SECRET || process.env.JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);
            userId = payload.userId as string;

            if (!userId) {
                return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
            }
        }

        if (!preguntaId || !respuesta) {
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

        // Si es guest o práctica, simplemente retornamos sin guardar nada
        if (isGuest || isPractice) {
            return new Response(JSON.stringify({
                success: true,
                isCorrect: isCorrect,
                reward: (isCorrect && !isPractice) ? reward : 0,
                correctAnswer: correctAnswer,
                dailyCount: 0
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3. Transacción estricta para guardar y actualizar conteo
        const answerId = crypto.randomUUID();
        let newCount = 1;

        client = await pool.connect();
        await client.query('BEGIN');

        try {
            // Actualizar límite primero, verificando matemáticamente en la base de datos
            const updateRes = await client.query(`
                UPDATE users 
                SET daily_trivia_count = CASE 
                        WHEN last_trivia_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE THEN COALESCE(daily_trivia_count, 0) + 1 
                        ELSE 1 
                    END,
                    last_trivia_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE
                WHERE id = $1
                  AND (
                    last_trivia_date IS NULL OR
                    last_trivia_date != (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE OR
                    COALESCE(daily_trivia_count, 0) < 10
                  )
                RETURNING daily_trivia_count;
            `, [userId]);

            if (updateRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return new Response(JSON.stringify({ error: "Has alcanzado el límite diario de 10 preguntas." }), { status: 429 });
            }

            newCount = updateRes.rows[0].daily_trivia_count;

            // Insertar respuesta
            await client.query(`
                INSERT INTO user_trivia_answers (id, user_id, pregunta_id, respuesta_enviada, is_correct, snapshot_reward)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [answerId, userId, parseInt(preguntaId), respuesta, isCorrect, isCorrect ? reward : 0]);

            await client.query('COMMIT');
        } catch (err: any) {
            await client.query('ROLLBACK');
            if (err.code === '23505') { // Unique violation
                 return new Response(JSON.stringify({
                    error: "Ya has respondido esta pregunta anteriormente."
                }), { status: 409 });
            }
            throw err;
        } finally {
            client.release();
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
