import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const res = await query("SELECT * FROM participantes_pasados ORDER BY score DESC NULLS LAST");
        return new Response(JSON.stringify({ success: true, data: res.rows }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error obteniendo participantes pasados:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { action, id, contacted } = body;

        if (action === 'update_contacted') {
            if (!id) {
                return new Response(JSON.stringify({ success: false, error: 'Falta ID' }), { status: 400 });
            }
            
            const updateRes = await query(
                `UPDATE participantes_pasados SET contacted = $1 WHERE id = $2 RETURNING *`,
                [contacted, id]
            );

            if (updateRes.rowCount === 0) {
                 return new Response(JSON.stringify({ success: false, error: 'Participante no encontrado' }), { status: 404 });
            }

            return new Response(JSON.stringify({ success: true, data: updateRes.rows[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), { status: 400 });
        
    } catch (error) {
        console.error("Error actualizando participante pasado:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
