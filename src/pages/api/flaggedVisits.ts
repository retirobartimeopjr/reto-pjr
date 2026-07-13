import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const sql = `
            SELECT 
                v.id,
                v.points_awarded,
                v.visited_at,
                v.flag_reason,
                u.username,
                u.phone,
                p.name as parroquia_name
            FROM user_parroquia_visits v
            JOIN users u ON v.user_id = u.id
            JOIN parroquias p ON v.parroquia_id = p.id
            WHERE v.flagged = true
            ORDER BY v.visited_at DESC;
        `;
        const res = await query(sql);

        return new Response(JSON.stringify(res.rows), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error obteniendo flagged visits:", error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
