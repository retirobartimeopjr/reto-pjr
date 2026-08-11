import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const PUT: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { limits, prices } = body;

        if (!limits || !prices) {
            return new Response(JSON.stringify({ success: false, error: 'Faltan campos obligatorios (limits o prices)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const newConfig = { limits, prices };

        await query(`
            UPDATE app_config 
            SET value = $1 
            WHERE key = 'ventas_config'
        `, [JSON.stringify(newConfig)]);

        return new Response(JSON.stringify({ success: true, config: newConfig }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error("PUT /api/ventas/config Error:", e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
