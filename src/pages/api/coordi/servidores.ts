import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        // Temp migration
        try {
            await query(`
                ALTER TABLE servidores 
                ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
                ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
                ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false
            `);
        } catch (e) {
            console.error('Migration error:', e);
        }

        const res = await query("SELECT id, full_name as server_name, birthdate, is_v_retiro, gender, phone, reminder_sent FROM servidores ORDER BY full_name ASC");
        
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
        const { action, server_name, birthdate, is_v_retiro, server_id, gender, phone, reminder_sent } = body;

        if (!action) {
            return new Response(JSON.stringify({ success: false, error: 'Falta acción' }), { status: 400 });
        }

        if (action === 'create') {
            if (!server_name) return new Response(JSON.stringify({ success: false, error: 'Nombre es requerido' }), { status: 400 });
            
            const bdate = birthdate || null;
            const vRetiro = is_v_retiro === true;
            const sGender = gender || null;
            const sPhone = phone || null;

            const res = await query(
                `INSERT INTO servidores (full_name, birthdate, is_v_retiro, gender, phone, reminder_sent, tickets_sold) VALUES ($1, $2, $3, $4, $5, false, '[]'::jsonb) RETURNING *`,
                [server_name.trim(), bdate, vRetiro, sGender, sPhone]
            );
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        } 
        
        else if (action === 'update') {
            if (!server_id || !server_name) return new Response(JSON.stringify({ success: false, error: 'ID y Nombre son requeridos' }), { status: 400 });
            
            const bdate = birthdate || null;
            const vRetiro = is_v_retiro === true;
            const sGender = gender || null;
            const sPhone = phone || null;
            const bReminder = reminder_sent === true;

            const res = await query(
                `UPDATE servidores SET full_name = $1, birthdate = $2, is_v_retiro = $3, gender = $4, phone = $5, reminder_sent = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *`,
                [server_name.trim(), bdate, vRetiro, sGender, sPhone, bReminder, server_id]
            );

            if (res.rowCount === 0) return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }
        
        else if (action === 'delete') {
            if (!server_id) return new Response(JSON.stringify({ success: false, error: 'ID es requerido' }), { status: 400 });
            
            await query(`DELETE FROM servidores WHERE id = $1`, [server_id]);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        
        else if (action === 'mark_reminder') {
            if (!server_id) return new Response(JSON.stringify({ success: false, error: 'ID es requerido' }), { status: 400 });
            
            const bReminder = reminder_sent === true;
            const res = await query(`UPDATE servidores SET reminder_sent = $1 WHERE id = $2 RETURNING *`, [bReminder, server_id]);
            
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }

        return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error("Error gestionando servidores coordi:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error procesando solicitud' }), { status: 500 });
    }
};
