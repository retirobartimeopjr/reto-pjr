import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import { jwtVerify } from 'jose';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // 1. VALIDACIÓN JWT DE SEGURIDAD
        const token = cookies.get('auth_token')?.value;
        if (!token) {
            return new Response(JSON.stringify({ success: false, error: 'No autorizado. Inicia sesión.' }), { status: 401 });
        }

        let jwtPayload;
        try {
            const secret = new TextEncoder().encode(import.meta.env.JWT_SECRET || process.env.JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);
            jwtPayload = payload;
        } catch (e) {
            return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), { status: 403 });
        }

        const body = await request.json();
        const { referralPhone, newUserPhone } = body;

        // El usuario logueado
        const userId = jwtPayload.userId;

        if (!referralPhone) {
            return new Response(JSON.stringify({ success: false, error: "Faltan datos requeridos." }), { status: 400 });
        }

        const targetPhone = String(referralPhone).replace(/\D/g, '').trim(); 
        const newPhone = newUserPhone ? String(newUserPhone).replace(/\D/g, '').trim() : null; 

        // 1. Validar que la persona que invitó realmente exista
        const referrerRes = await query('SELECT id FROM users WHERE phone = $1', [targetPhone]);

        if (referrerRes.rowCount === 0) {
            return new Response(JSON.stringify({ success: false, error: "El número de quien te invitó no está registrado." }), { status: 404 });
        }

        // 2. Identificar al usuario a ser referido (Debe ser el mismo que está logueado, a menos que sea un nuevo pre-registro, lo cual en este flujo ya debería estar registrado porque tiene token JWT)
        let userData: any = null;

        if (userId) {
            const userRes = await query('SELECT id, phone, referencia FROM users WHERE id = $1', [userId]);
            if (userRes.rowCount > 0) userData = userRes.rows[0];
        }

        // ESCENARIO: USUARIO EXISTENTE (Validaciones)
        if (!userData) {
            return new Response(JSON.stringify({ success: false, error: "Usuario no encontrado." }), { status: 404 });
        }

        // RESTRICCIÓN: No referirse a sí mismo
        if (userData.phone === targetPhone) {
            return new Response(JSON.stringify({ success: false, error: "No puedes referirte a ti mismo." }), { status: 400 });
        }

        // RESTRICCIÓN: Ya tiene referido
        if (userData.referencia && userData.referencia.length > 5) {
            return new Response(JSON.stringify({ success: false, error: "Ya tienes un referido asignado." }), { status: 400 });
        }

        // 3. EJECUTAR ESCRITURA
        await query(`UPDATE users SET referencia = $1 WHERE id = $2`, [targetPhone, userData.id]);

        return new Response(JSON.stringify({
            success: true,
            referencia: targetPhone
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("❌ Postgres Referral API Error:", error);
        return new Response(JSON.stringify({ success: false, error: "Error interno del servidor (Postgres)." }), { status: 500 });
    }
}
