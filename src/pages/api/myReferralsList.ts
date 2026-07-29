import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const phone = url.searchParams.get('phone');

        if (!phone) {
            return new Response(JSON.stringify({ error: 'Falta el teléfono' }), { status: 400 });
        }

        const res = await query(`
            SELECT u.username 
            FROM user_referrals ur
            JOIN users u ON ur.referred_phone = u.phone
            WHERE ur.referrer_phone = $1
            ORDER BY ur.created_at DESC
        `, [phone]);

        const names = res.rows.map(row => row.username);

        return new Response(JSON.stringify({ success: true, names }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error("❌ Error en myReferralsList API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
