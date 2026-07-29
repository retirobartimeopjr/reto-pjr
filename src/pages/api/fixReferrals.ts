import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const res = await query(`
            UPDATE users u
            SET referidos = (
                SELECT count(*) 
                FROM user_referrals ur 
                WHERE ur.referrer_phone = u.phone
            )
            WHERE EXISTS (
                SELECT 1 FROM user_referrals ur WHERE ur.referrer_phone = u.phone
            )
            RETURNING id, username, referidos
        `);
        return new Response(JSON.stringify({ success: true, updated: res.rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
