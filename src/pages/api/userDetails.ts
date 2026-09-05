import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, targetUserId } = body;

        // 1. Authenticate Admin
        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Credenciales requeridas' }), { status: 401 });
        }
        
        const adminCheck = await query('SELECT password FROM admins WHERE username = $1', [username]);
        if (adminCheck.rowCount === 0) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }
        
        const isValid = await bcrypt.compare(password, adminCheck.rows[0].password);
        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        if (!targetUserId) {
            return new Response(JSON.stringify({ error: 'Falta targetUserId' }), { status: 400 });
        }

        // 2. Fetch User Stats & Details
        const userRes = await query(`
            SELECT 
                us.user_id, us.username, us.calculated_score, us.parroquias_visitadas, 
                us.respuestas_enviadas, us.respuestas_correctas,
                u.phone, u.cedula, u.referidos, u.email, u.is_active, u.deactivation_reason
            FROM user_stats us
            JOIN users u ON us.user_id = u.id
            WHERE us.user_id = $1
        `, [targetUserId]);

        if (userRes.rowCount === 0) {
            return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404 });
        }

        const userDetails = userRes.rows[0];

        // 3. Fetch Visited Parroquias
        const visitsRes = await query(`
            SELECT 
                p.name, 
                p.code, 
                v.visited_at, 
                v.points_awarded,
                v.photo_url
            FROM user_parroquia_visits v
            JOIN parroquias p ON v.parroquia_id = p.id
            WHERE v.user_id = $1
            ORDER BY v.visited_at DESC
        `, [targetUserId]);

        userDetails.visited_parroquias = visitsRes.rows;

        // 4. Fetch Receipts
        const receiptsRes = await query(`
            SELECT receipt_url 
            FROM ticket_registers 
            WHERE phone = $1 AND receipt_url IS NOT NULL
        `, [userDetails.phone]);

        userDetails.receipts = receiptsRes.rows.map(row => row.receipt_url);

        // 5. Fetch Referrals and their Receipts
        const referralsRes = await query(`
            SELECT 
                ur.referred_phone, 
                u.username as referred_name,
                (
                    SELECT array_agg(tr.receipt_url) 
                    FROM ticket_registers tr 
                    WHERE tr.phone = ur.referred_phone AND tr.receipt_url IS NOT NULL
                ) as receipts
            FROM user_referrals ur
            LEFT JOIN users u ON ur.referred_phone = u.phone
            WHERE ur.referrer_phone = $1
        `, [userDetails.phone]);

        userDetails.referralsList = referralsRes.rows.map(row => ({
            phone: row.referred_phone,
            name: row.referred_name || 'Desconocido',
            receipts: row.receipts || []
        }));

        // 6. Fetch Daily Trivia Stats
        const dailyStatsRes = await query(`
            SELECT 
                to_char(answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') as date, 
                COUNT(*) as count 
            FROM user_trivia_answers 
            WHERE user_id = $1 
              AND answered_at >= '2026-08-24'
            GROUP BY date
            ORDER BY date DESC
        `, [targetUserId]);

        userDetails.daily_trivia_stats = dailyStatsRes.rows;

        return new Response(JSON.stringify(userDetails), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
        console.error("❌ Error en userDetails API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
