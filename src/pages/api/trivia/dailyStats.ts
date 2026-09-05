import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import { jwtVerify } from 'jose';

export const GET: APIRoute = async ({ request, cookies }) => {
    try {
        // Authenticate admin (assuming simple check or just existence of token for now)
        const token = cookies.get('auth_token')?.value;
        if (!token) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
        }
        
        const secret = new TextEncoder().encode(import.meta.env.JWT_SECRET || process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        
        if (payload.role !== 'admin' && payload.role !== 'coordi') {
            // Optional: you might want to enforce role if needed, but for now we just let it pass if token is valid
        }

        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Falta userId' }), { status: 400 });
        }

        const sql = `
            SELECT 
                to_char(answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') as date, 
                COUNT(*) as count 
            FROM user_trivia_answers 
            WHERE user_id = $1 
              AND answered_at >= '2026-08-24'
            GROUP BY date
            ORDER BY date DESC;
        `;

        const res = await query(sql, [userId]);

        return new Response(JSON.stringify({
            success: true,
            stats: res.rows
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error fetching daily stats:", error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}
