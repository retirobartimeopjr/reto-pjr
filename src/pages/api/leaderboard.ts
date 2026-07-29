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

        let queryText = '';

        if (isRegistered) {
            // Fetch 10 users centered around the registered user
            queryText = `
                WITH RankedUsers AS (
                    SELECT user_id, username, calculated_score,
                           ROW_NUMBER() OVER (
                               ORDER BY 
                                   calculated_score DESC, 
                                   parroquias_visitadas DESC, 
                                   respuestas_correctas DESC, 
                                   username ASC
                           ) as rank
                    FROM user_stats
                    WHERE is_active = true
                )
                SELECT * FROM RankedUsers
                WHERE rank BETWEEN 
                    GREATEST(1, COALESCE((SELECT rank FROM RankedUsers WHERE user_id = $1), 1) - 4)
                    AND 
                    GREATEST(10, COALESCE((SELECT rank FROM RankedUsers WHERE user_id = $1), 1) + 5)
                ORDER BY rank ASC
                LIMIT 10
            `;
        } else {
            // Fetch worst 10 users prioritizing those with > 0 points
            queryText = `
                WITH RankedUsers AS (
                    SELECT user_id, username, calculated_score,
                           ROW_NUMBER() OVER (
                               ORDER BY 
                                   calculated_score DESC, 
                                   parroquias_visitadas DESC, 
                                   respuestas_correctas DESC, 
                                   username ASC
                           ) as rank
                    FROM user_stats
                    WHERE is_active = true
                ),
                BottomTen AS (
                    SELECT * FROM RankedUsers
                    ORDER BY 
                        CASE WHEN calculated_score > 0 THEN 0 ELSE 1 END ASC,
                        rank DESC
                    LIMIT 10
                )
                SELECT * FROM BottomTen
                ORDER BY rank ASC
            `;
        }

        const boardRes = await query(queryText, isRegistered && uid ? [uid] : []);

        // 3. Format response (Send scores and real rank)
        const topUsers = boardRes.rows.map(u => ({
            username: u.username || 'Anónimo',
            score: Number(u.calculated_score || 0),
            rank: Number(u.rank)
        }));

        return new Response(JSON.stringify(topUsers), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });

    } catch (error) {
        console.error("❌ Postgres Leaderboard API Error:", error);
        return new Response(JSON.stringify({ error: String(error), stack: error.stack }), { status: 500 });
    }
};
