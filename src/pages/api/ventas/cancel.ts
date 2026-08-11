import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const PUT: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return new Response(JSON.stringify({ success: false, error: 'ID es requerido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const res = await query(`
            UPDATE ventas_reservas 
            SET estado = 'CANCELADA' 
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (res.rowCount === 0) {
            return new Response(JSON.stringify({ success: false, error: 'Reserva no encontrada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, reserva: res.rows[0] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error("PUT /api/ventas/cancel Error:", e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
