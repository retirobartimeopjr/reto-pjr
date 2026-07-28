import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, action, targetUserId, newActiveState, searchQuery } = body;

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

        // 2. Handle Action: Fetch Users
        if (action === 'fetch') {
            let sql = `
                SELECT 
                    us.user_id, 
                    us.username, 
                    us.is_active, 
                    us.calculated_score,
                    u.phone,
                    u.cedula,
                    u.email
                FROM user_stats us
                JOIN users u ON us.user_id = u.id
            `;
            let params: any[] = [];

            if (searchQuery && searchQuery.trim().length > 0) {
                sql += ` WHERE us.username ILIKE $1 OR u.phone ILIKE $1 OR u.cedula ILIKE $1`;
                params.push(`%${searchQuery.trim()}%`);
            }

            sql += ` ORDER BY us.calculated_score DESC LIMIT 50`; // Limit to 50 for performance

            const usersRes = await query(sql, params);
            return new Response(JSON.stringify(usersRes.rows), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 3. Handle Action: Toggle Active Status
        if (action === 'toggle') {
            if (!targetUserId) {
                return new Response(JSON.stringify({ error: 'Falta targetUserId' }), { status: 400 });
            }
            const updateRes = await query(`
                UPDATE users 
                SET is_active = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 
                RETURNING id, is_active
            `, [newActiveState, targetUserId]);

            if (updateRes.rowCount === 0) {
                return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404 });
            }

            return new Response(JSON.stringify({ success: true, user: updateRes.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error("❌ Error en manageUsers API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
