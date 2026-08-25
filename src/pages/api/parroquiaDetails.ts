import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, action, searchQuery, parroquiaId, userCedula, visitId } = body;

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
                    v.id as visit_id,
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

        // 4. Add Visit Manually
        if (action === 'add_visit') {
            if (!parroquiaId || !userCedula) {
                return new Response(JSON.stringify({ error: 'Falta parroquiaId o cédula/celular del usuario' }), { status: 400 });
            }

            // Buscar usuario
            const userRes = await query('SELECT id FROM users WHERE cedula = $1 OR phone = $1', [userCedula.trim()]);
            if (userRes.rowCount === 0) {
                return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404 });
            }
            const userId = userRes.rows[0].id;

            // Verificar visita previa (anti-spam 1 al día o cambiar puntaje)
            // Para admin, simplemente agregaremos la visita (pero podríamos verificar si ya tiene visita para dar menos puntos)
            const previousVisitsRes = await query('SELECT COUNT(*) as count FROM user_parroquia_visits WHERE user_id = $1 AND parroquia_id = $2', [userId, parroquiaId]);
            
            const parishRes = await query('SELECT reward FROM parroquias WHERE id = $1', [parroquiaId]);
            if (parishRes.rowCount === 0) {
                return new Response(JSON.stringify({ error: 'Parroquia no encontrada' }), { status: 404 });
            }
            
            let rewardPoints = parishRes.rows[0].reward || 0;
            if (parseInt(previousVisitsRes.rows[0].count) > 0) {
                rewardPoints = 10; // Puntos fijos por visita repetida
            }

            const newVisitId = crypto.randomUUID();
            await query(`
                INSERT INTO user_parroquia_visits (id, user_id, parroquia_id, points_awarded, flagged, flag_reason)
                VALUES ($1, $2, $3, $4, false, 'Visita manual creada por admin')
            `, [newVisitId, userId, parroquiaId, rewardPoints]);

            return new Response(JSON.stringify({ success: true, message: 'Visita registrada con éxito' }), { status: 200 });
        }

        // 5. Delete Visit Manually
        if (action === 'delete_visit') {
            if (!visitId) {
                return new Response(JSON.stringify({ error: 'Falta visitId' }), { status: 400 });
            }

            const res = await query('DELETE FROM user_parroquia_visits WHERE id = $1 RETURNING id', [visitId]);
            
            if (res.rowCount === 0) {
                return new Response(JSON.stringify({ error: 'Visita no encontrada' }), { status: 404 });
            }

            return new Response(JSON.stringify({ success: true, message: 'Visita eliminada con éxito' }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error("❌ Error en parroquiaDetails API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
