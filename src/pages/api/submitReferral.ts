import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, referralPhone, newUserPhone } = body;

        if (!referralPhone || (!userId && !newUserPhone)) {
            return new Response(JSON.stringify({ success: false, error: "Faltan datos requeridos." }), { status: 400 });
        }

        const targetPhone = String(referralPhone).replace(/\D/g, '').trim(); 
        const newPhone = newUserPhone ? String(newUserPhone).replace(/\D/g, '').trim() : null; 

        // 1. Validar que la persona que invitó realmente exista
        const referrerRes = await query('SELECT id FROM users WHERE phone = $1', [targetPhone]);

        if (referrerRes.rowCount === 0) {
            return new Response(JSON.stringify({ success: false, error: "El número de quien te invitó no está registrado." }), { status: 404 });
        }

        // 2. Identificar al usuario a ser referido
        let userData: any = null;

        if (userId) {
            const userRes = await query('SELECT id, phone, referencia FROM users WHERE id = $1', [userId]);
            if (userRes.rowCount > 0) userData = userRes.rows[0];
        } else if (newPhone) {
            const userRes = await query('SELECT id, phone, referencia FROM users WHERE phone = $1', [newPhone]);
            if (userRes.rowCount > 0) userData = userRes.rows[0];
        }

        // ESCENARIO A: NUEVO USUARIO (AÚN NO EXISTE) -> GUARDAR REFERIDO PENDIENTE
        if (!userData && newPhone) {
            console.log(`[Referral Postgres] Guardando referido pendiente para ${newPhone} (Referrer: ${targetPhone})`);

            // Asegurar que la tabla existe (se crea automáticamente si no existe)
            await query(`
                CREATE TABLE IF NOT EXISTS pending_referrals (
                    phone VARCHAR(50) PRIMARY KEY, 
                    referrer_phone VARCHAR(50), 
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Usamos UPSERT (ON CONFLICT) para no duplicar ni causar errores si intentan varias veces
            await query(`
                INSERT INTO pending_referrals (phone, referrer_phone) 
                VALUES ($1, $2)
                ON CONFLICT (phone) DO UPDATE SET referrer_phone = EXCLUDED.referrer_phone
            `, [newPhone, targetPhone]);

            return new Response(JSON.stringify({
                success: true,
                message: "Referido guardado (pendiente de registro)",
                referencia: targetPhone
            }), { status: 200 });
        }

        // ESCENARIO B: USUARIO EXISTENTE (Validaciones)
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
