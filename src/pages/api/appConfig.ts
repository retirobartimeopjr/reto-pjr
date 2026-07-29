import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export const GET: APIRoute = async () => {
    try {
        const res = await query("SELECT key, value FROM app_config WHERE key IN ('challenge_state', 'proximity_threshold', 'challenge_start_time', 'challenge_end_time', 'referral_points', 'ticket_price')");
        
        const config: any = {
            active: true,
            message: "Estado por defecto: Activo",
            proximity_threshold: 350,
            challenge_start_time: null,
            challenge_end_time: null,
            referral_points: 150,
            ticket_price: 20000
        };

        for (const row of res.rows) {
            if (row.key === 'challenge_state') {
                config.active = row.value.active ?? true;
                config.message = row.value.message ?? config.message;
            } else if (row.key === 'proximity_threshold') {
                config.proximity_threshold = Number(row.value) || 350;
            } else if (row.key === 'challenge_start_time') {
                config.challenge_start_time = row.value; // Store as ISO string
            } else if (row.key === 'challenge_end_time') {
                config.challenge_end_time = row.value; // Store as ISO string
            } else if (row.key === 'referral_points') {
                config.referral_points = Number(row.value) || 150;
            } else if (row.key === 'ticket_price') {
                config.ticket_price = Number(row.value) || 20000;
            }
        }

        return new Response(JSON.stringify(config), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error obteniendo app_config:", error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, active, message, proximity_threshold, challenge_start_time, challenge_end_time, referral_points, ticket_price } = body;

        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Credenciales incompletas' }), { status: 400 });
        }

        const adminRes = await query('SELECT password FROM admins WHERE username = $1', [username]);
        
        if (adminRes.rowCount === 0) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        const hashedPassword = adminRes.rows[0].password;
        const isValid = await bcrypt.compare(password, hashedPassword);

        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        const newState: any = { active: !!active, message: message || "Reto pausado temporalmente" };
        
        await query(`
            INSERT INTO app_config (key, value) 
            VALUES ('challenge_state', $1::jsonb)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        `, [JSON.stringify(newState)]);

        if (proximity_threshold !== undefined) {
            await query(`
                INSERT INTO app_config (key, value) 
                VALUES ('proximity_threshold', $1::jsonb)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            `, [JSON.stringify(Number(proximity_threshold))]);
            newState.proximity_threshold = Number(proximity_threshold);
        }

        if (challenge_start_time !== undefined) {
            await query(`
                INSERT INTO app_config (key, value) 
                VALUES ('challenge_start_time', $1::jsonb)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            `, [JSON.stringify(challenge_start_time)]);
            newState.challenge_start_time = challenge_start_time;
        }

        if (challenge_end_time !== undefined) {
            await query(`
                INSERT INTO app_config (key, value) 
                VALUES ('challenge_end_time', $1::jsonb)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            `, [JSON.stringify(challenge_end_time)]);
            newState.challenge_end_time = challenge_end_time;
        }

        if (referral_points !== undefined) {
            await query(`
                INSERT INTO app_config (key, value) 
                VALUES ('referral_points', $1::jsonb)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            `, [JSON.stringify(Number(referral_points))]);
            newState.referral_points = Number(referral_points);
        }

        if (ticket_price !== undefined) {
            await query(`
                INSERT INTO app_config (key, value) 
                VALUES ('ticket_price', $1::jsonb)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            `, [JSON.stringify(Number(ticket_price))]);
            newState.ticket_price = Number(ticket_price);
        }

        return new Response(JSON.stringify({ success: true, state: newState }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error actualizando app_config:", error);
        return new Response(JSON.stringify({ error: 'Error procesando solicitud' }), { status: 500 });
    }
};
