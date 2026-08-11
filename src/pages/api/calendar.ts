import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export const GET: APIRoute = async () => {
    try {
        const res = await query("SELECT value FROM app_config WHERE key = 'calendar_itinerary'");
        
        let config = null;
        if (res.rows.length > 0) {
            config = res.rows[0].value;
        }

        return new Response(JSON.stringify(config || {}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error obteniendo calendar_itinerary:", error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { password, data } = body;

        if (!password || !data) {
            return new Response(JSON.stringify({ success: false, error: 'Faltan datos' }), { status: 400 });
        }

        const adminPasswordHash = import.meta.env.ADMIN_PASSWORD_HASH;
        
        const isValid = await bcrypt.compare(password, adminPasswordHash);
        if (!isValid) {
            return new Response(JSON.stringify({ success: false, error: 'Contraseña incorrecta' }), { status: 401 });
        }

        await query(
            `INSERT INTO app_config (key, value) 
             VALUES ('calendar_itinerary', $1) 
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [JSON.stringify(data)]
        );

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error actualizando calendar:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
