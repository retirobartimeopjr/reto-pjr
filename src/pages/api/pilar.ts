import { query } from '../../lib/db';
export const GET = async () => {
    try {
        const data = await query(`SELECT id, phone FROM users WHERE phone = '3219736840'`);
        if (data.rowCount > 0) {
            const userId = data.rows[0].id;
            const answers = await query(`
                SELECT a.answered_at, a.respuesta_enviada, a.is_correct, p.pregunta 
                FROM user_trivia_answers a
                JOIN preguntas p ON a.pregunta_id = p.id
                WHERE a.user_id = $1 
                ORDER BY a.answered_at ASC
                LIMIT 10
            `, [userId]);
            return new Response(JSON.stringify(answers.rows, null, 2), { status: 200, headers: {'content-type':'application/json'} });
        }
        return new Response('User not found', { status: 404 });
    } catch(e: any) {
        return new Response(e.message, { status: 500 });
    }
};
