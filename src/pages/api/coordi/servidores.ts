import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const res = await query("SELECT id, full_name as server_name, birthdate, is_v_retiro FROM servidores ORDER BY full_name ASC");
        
        return new Response(JSON.stringify({ success: true, data: res.rows }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error obteniendo servidores para coordi:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { action, server_name, birthdate, is_v_retiro, server_id } = body;

        if (!action) {
            return new Response(JSON.stringify({ success: false, error: 'Falta acción' }), { status: 400 });
        }

        if (action === 'create') {
            if (!server_name) return new Response(JSON.stringify({ success: false, error: 'Nombre es requerido' }), { status: 400 });
            
            const bdate = birthdate || null;
            const vRetiro = is_v_retiro === true;

            const res = await query(
                `INSERT INTO servidores (full_name, birthdate, is_v_retiro, tickets_sold) VALUES ($1, $2, $3, '[]'::jsonb) RETURNING *`,
                [server_name.trim(), bdate, vRetiro]
            );
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        } 
        
        else if (action === 'update') {
            if (!server_id || !server_name) return new Response(JSON.stringify({ success: false, error: 'ID y Nombre son requeridos' }), { status: 400 });
            
            const bdate = birthdate || null;
            const vRetiro = is_v_retiro === true;

            const res = await query(
                `UPDATE servidores SET full_name = $1, birthdate = $2, is_v_retiro = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
                [server_name.trim(), bdate, vRetiro, server_id]
            );

            if (res.rowCount === 0) return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }
        
        else if (action === 'delete') {
            if (!server_id) return new Response(JSON.stringify({ success: false, error: 'ID es requerido' }), { status: 400 });
            
            await query(`DELETE FROM servidores WHERE id = $1`, [server_id]);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error("Error gestionando servidores coordi:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error procesando solicitud' }), { status: 500 });
    }
};
