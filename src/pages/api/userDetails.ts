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
                u.phone, u.cedula, u.referidos, u.email
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

        return new Response(JSON.stringify(userDetails), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
        console.error("❌ Error en userDetails API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
