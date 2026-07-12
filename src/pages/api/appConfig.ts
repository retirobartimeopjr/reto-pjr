import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export const GET: APIRoute = async () => {
    try {
        const res = await query('SELECT value FROM app_config WHERE key = $1', ['challenge_state']);
        
        if (res.rowCount === 0) {
            return new Response(JSON.stringify({
                active: true,
                message: "Estado por defecto: Activo"
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(res.rows[0].value), {
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
        const { username, password, active, message } = body;

        // "username" sigue siendo el teléfono por simplicidad como solicitó el usuario,
        // pero lo renombramos a nivel logico en la DB a 'username' para el admin panel
        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Credenciales incompletas' }), { status: 400 });
        }

        // 1. Obtener hash del administrador
        const adminRes = await query('SELECT password FROM admins WHERE username = $1', [username]);
        
        if (adminRes.rowCount === 0) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        const hashedPassword = adminRes.rows[0].password;

        // 2. Validar contraseña con bcrypt
        const isValid = await bcrypt.compare(password, hashedPassword);

        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        // 3. Actualizar Estado
        const newState = { active: !!active, message: message || "Reto pausado temporalmente" };
        
        await query(`
            INSERT INTO app_config (key, value) 
            VALUES ('challenge_state', $1::jsonb)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        `, [JSON.stringify(newState)]);

        return new Response(JSON.stringify({ success: true, state: newState }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error actualizando app_config:", error);
        return new Response(JSON.stringify({ error: 'Error procesando solicitud' }), { status: 500 });
    }
};
