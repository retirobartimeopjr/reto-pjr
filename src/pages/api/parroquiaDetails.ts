import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, action, searchQuery, parroquiaId } = body;

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

        // 2. Search Parroquias (Directory)
        if (action === 'search') {
            let sql = `
                SELECT 
                    id, name, code, vicaria, reward 
                FROM parroquias
            `;
            let params: any[] = [];

            if (searchQuery && searchQuery.trim().length > 0) {
                sql += ` WHERE name ILIKE $1 OR code ILIKE $1`;
                params.push(`%${searchQuery.trim()}%`);
            }

            sql += ` ORDER BY name ASC LIMIT 50`;

            const res = await query(sql, params);
            return new Response(JSON.stringify(res.rows), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 3. Fetch Parroquia Visitors
        if (action === 'visitors') {
            if (!parroquiaId) {
                return new Response(JSON.stringify({ error: 'Falta parroquiaId' }), { status: 400 });
            }

            const res = await query(`
                SELECT 
                    u.username, 
                    u.cedula,
                    u.phone,
                    v.visited_at,
                    v.points_awarded
                FROM user_parroquia_visits v
                JOIN users u ON v.user_id = u.id
                WHERE v.parroquia_id = $1
                ORDER BY v.visited_at DESC
            `, [parroquiaId]);

            return new Response(JSON.stringify(res.rows), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error("❌ Error en parroquiaDetails API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
