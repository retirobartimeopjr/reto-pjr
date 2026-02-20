
import type { APIRoute } from 'astro';
import { userCache } from '../../lib/serverUserCache';

export const GET: APIRoute = async ({ request }) => {
    try {
        // Use Server Cache (Auto-refreshed every 60s)
        const allUsers = await userCache.getAllUsers();

        // Sort descending by score
        const sorted = [...allUsers].sort((a, b) => (b.score || 0) - (a.score || 0));

        // Check for user ID in query params to determine limit
        const url = new URL(request.url);
        const uid = url.searchParams.get('uid');

        let isRegistered = false;

        if (uid) {
            // fast check if user exists in cache
            isRegistered = allUsers.some(u => u.docId === uid);
        }

        // Return top users based on limit
        const topUsers = sorted.slice(0, 10).map(u => ({
            username: u.username || 'Anónimo',
            score: isRegistered ? (u.score || 0) : null
        }));

        return new Response(JSON.stringify(topUsers), {
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
