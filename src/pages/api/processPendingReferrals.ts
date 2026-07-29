import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password } = body;

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

        // 2. Fetch pending referrals that now have a registered referrer
        const pendingRes = await query(`
            SELECT p.id, p.referrer_phone, p.new_user_phone 
            FROM pending_referrals p
            JOIN users u ON p.referrer_phone = u.phone
            WHERE p.processed = false
        `);

        if (pendingRes.rowCount === 0) {
            return new Response(JSON.stringify({ success: true, processedCount: 0, message: "No hay referidos en cola listos para procesar." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Process each ready referral
        const refPointsRes = await query(`SELECT value FROM app_config WHERE key = 'referral_points'`);
        const pts = refPointsRes.rowCount > 0 ? Number(refPointsRes.rows[0].value) : 150;
        let processedCount = 0;

        for (const row of pendingRes.rows) {
            // Give points
            const insertRef = await query(`
                INSERT INTO user_referrals (referrer_phone, referred_phone, points_awarded)
                VALUES ($1, $2, $3)
                ON CONFLICT (referrer_phone, referred_phone) DO NOTHING
                RETURNING *
            `, [row.referrer_phone, row.new_user_phone, pts]);

            if (insertRef.rowCount > 0) {
                await query(`UPDATE users SET referidos = COALESCE(referidos, 0) + 1 WHERE phone = $1`, [row.referrer_phone]);
            }

            // Mark as processed
            await query(`UPDATE pending_referrals SET processed = true WHERE id = $1`, [row.id]);
            
            processedCount++;
        }

        return new Response(JSON.stringify({ success: true, processedCount, message: `Se procesaron ${processedCount} referidos exitosamente.` }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error("❌ Process Pending Referrals API Error:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
