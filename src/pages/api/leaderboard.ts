
import type { APIRoute } from 'astro';
import { userCache } from '../../lib/serverUserCache';

export const GET: APIRoute = async () => {
    try {
        // Use Server Cache (Auto-refreshed every 60s)
        const allUsers = await userCache.getAllUsers();

        // Sort descending by score
        const sorted = [...allUsers].sort((a, b) => (b.score || 0) - (a.score || 0));

        // Top 10
        const top10 = sorted.slice(0, 10).map(u => ({
            username: u.username || 'Anónimo',
            score: u.score || 0
        }));

        return new Response(JSON.stringify(top10), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });

    } catch (error) {
        console.error("Leaderboard API Error:", error);
        return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
    }
};
