import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const uid = url.searchParams.get('uid');

        let isRegistered = false;

        // 1. Check if the requester is registered
        if (uid) {
            const checkRes = await query('SELECT 1 FROM users WHERE id = $1', [uid]);
            isRegistered = checkRes.rowCount !== null && checkRes.rowCount > 0;
        }

        // 2. Fetch top 10 users from user_stats (already sorted by PostgreSQL!)
        // Postgres maneja el ordenamiento de 100,000 registros en un abrir y cerrar de ojos
        const boardRes = await query(`
            SELECT username, calculated_score 
            FROM user_stats 
            WHERE is_active = true
            ORDER BY calculated_score DESC 
            LIMIT 10
        `);

        // 3. Format response (Hide scores if not registered)
        const topUsers = boardRes.rows.map(u => ({
            username: u.username || 'Anónimo',
            score: isRegistered ? Number(u.calculated_score || 0) : null
        }));

        return new Response(JSON.stringify(topUsers), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });

    } catch (error) {
        console.error("❌ Postgres Leaderboard API Error:", error);
        return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
    }
};
