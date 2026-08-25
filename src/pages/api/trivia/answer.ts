import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import crypto from 'crypto';
import { jwtVerify } from 'jose';

export const POST: APIRoute = async ({ request, cookies }) => {
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

        // 1. Verificar límite diario antes de hacer nada (solo si no es práctica y no es guest)
        if (!isPractice && !isGuest) {
            const limitRes = await query(`
                SELECT daily_trivia_count, last_trivia_date 
                FROM users 
                WHERE id = $1
            `, [userId]);
            
            if (limitRes.rowCount > 0) {
                const user = limitRes.rows[0];
                const nowBogota = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Bogota"}));
                const lastDate = user.last_trivia_date ? new Date(user.last_trivia_date) : null;
                const isToday = lastDate && (lastDate.getFullYear() === nowBogota.getFullYear() && lastDate.getMonth() === nowBogota.getMonth() && lastDate.getDate() === nowBogota.getDate());
                
                if (isToday && user.daily_trivia_count >= 10) {
                    return new Response(JSON.stringify({ error: "Límite diario de 10 preguntas alcanzado." }), { status: 429 });
                }
            }
        }

        // 2. Verificar la pregunta en Postgres
        const preguntaRes = await query('SELECT respuesta_correcta, reward FROM preguntas WHERE id = $1', [parseInt(preguntaId)]);

        if (preguntaRes.rowCount === 0) {
            return new Response(JSON.stringify({ error: "Question not found" }), { status: 404 });
        }

        const preguntaData = preguntaRes.rows[0];
        const correctAnswer = preguntaData.respuesta_correcta;
        const reward = Number(preguntaData.reward) || 0;

        // 2. Validar Respuesta
        const isCorrect = String(respuesta).trim() === String(correctAnswer).trim();

        // Si es guest, simplemente retornamos sin guardar nada
        if (isGuest) {
            return new Response(JSON.stringify({
                success: true,
                isCorrect: isCorrect,
                reward: 0,
                correctAnswer: correctAnswer,
                dailyCount: 0
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

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
                        WHEN last_trivia_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE THEN daily_trivia_count + 1 
                        ELSE 1 
                    END,
                    last_trivia_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE
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
