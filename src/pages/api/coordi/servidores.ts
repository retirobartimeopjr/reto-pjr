import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        // Temp migration for servidores table
        try {
            await query(`
                ALTER TABLE servidores 
                ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
                ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
                ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS retreat_role VARCHAR(20) DEFAULT 'none',
                ADD COLUMN IF NOT EXISTS antiquity VARCHAR(20) DEFAULT 'antiguo',
                ADD COLUMN IF NOT EXISTS shifts JSONB DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS meals JSONB DEFAULT '{"cena": false, "almuerzo": false}'::jsonb,
                ADD COLUMN IF NOT EXISTS merchandise JSONB DEFAULT '{"camiseta": null, "saco": false, "mono": false, "kanguro": false, "custom": []}'::jsonb,
                ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS scholarship INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS family_group VARCHAR(255) DEFAULT ''
            `);
            
            await query(`
                CREATE TABLE IF NOT EXISTS servidores_config (
                    id SERIAL PRIMARY KEY,
                    cena_price INTEGER DEFAULT 25000,
                    almuerzo_price INTEGER DEFAULT 42000,
                    base_nuevo INTEGER DEFAULT 380000,
                    base_antiguo INTEGER DEFAULT 320000,
                    camiseta_price INTEGER DEFAULT 35000,
                    saco_price INTEGER DEFAULT 65000,
                    mono_price INTEGER DEFAULT 15000,
                    kanguro_price INTEGER DEFAULT 45000,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Insert default config if not exists
            const configCheck = await query(`SELECT COUNT(*) FROM servidores_config`);
            if (parseInt(configCheck.rows[0].count) === 0) {
                await query(`INSERT INTO servidores_config DEFAULT VALUES`);
            }
        } catch (e) {
            console.error('Migration error:', e);
        }

        const res = await query(`
            SELECT id, full_name as server_name, birthdate, is_v_retiro, gender, phone, reminder_sent, retreat_role, 
                   antiquity, shifts, meals, merchandise, payments, scholarship, family_group
            FROM servidores 
            ORDER BY full_name ASC
        `);
        
        const configRes = await query(`SELECT * FROM servidores_config ORDER BY id DESC LIMIT 1`);
        
        return new Response(JSON.stringify({ success: true, data: res.rows, config: configRes.rows[0] }), {
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
        const { action, server_name, birthdate, is_v_retiro, server_id, gender, phone, reminder_sent,
                antiquity, shifts, meals, merchandise, scholarship, payment, configData } = body;

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
            
            // First fetch the existing record to merge data
            const existingRes = await query(`SELECT * FROM servidores WHERE id = $1`, [server_id]);
            if (existingRes.rowCount === 0) return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            const existing = existingRes.rows[0];

            const bdate = birthdate !== undefined ? (birthdate || null) : existing.birthdate;
            const vRetiro = is_v_retiro !== undefined ? (is_v_retiro === true) : existing.is_v_retiro;
            const sGender = gender !== undefined ? (gender || null) : existing.gender;
            const sPhone = phone !== undefined ? (phone || null) : existing.phone;
            const bReminder = reminder_sent !== undefined ? (reminder_sent === true) : existing.reminder_sent;
            const sAntiquity = antiquity !== undefined ? (antiquity || 'antiguo') : (existing.antiquity || 'antiguo');
            const sShifts = shifts !== undefined ? shifts : existing.shifts;
            const sMeals = meals !== undefined ? meals : existing.meals;
            const sMerch = merchandise !== undefined ? merchandise : existing.merchandise;
            const iScholarship = scholarship !== undefined ? scholarship : existing.scholarship;
            const sRetreatRole = body.retreat_role !== undefined ? body.retreat_role : existing.retreat_role;
            const sFamilyGroup = body.family_group !== undefined ? body.family_group : existing.family_group;

            const res = await query(
                `UPDATE servidores SET full_name = $1, birthdate = $2, is_v_retiro = $3, gender = $4, phone = $5, reminder_sent = $6, antiquity = $7, shifts = $8, meals = $9, merchandise = $10, scholarship = $11, retreat_role = $12, family_group = $13, updated_at = CURRENT_TIMESTAMP WHERE id = $14 RETURNING *`,
                [server_name.trim(), bdate, vRetiro, sGender, sPhone, bReminder, sAntiquity, JSON.stringify(sShifts), JSON.stringify(sMeals), JSON.stringify(sMerch), iScholarship, sRetreatRole, sFamilyGroup, server_id]
            );

            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }
        
        else if (action === 'reset_finances') {
            if (!server_id) return new Response(JSON.stringify({ success: false, error: 'ID es requerido' }), { status: 400 });
            const res = await query(
                `UPDATE servidores SET payments = '[]'::jsonb, meals = '{}'::jsonb, merchandise = '{}'::jsonb, scholarship = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
                [server_id]
            );
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }
        
        else if (action === 'add_payment') {
            if (!server_id || !payment) return new Response(JSON.stringify({ success: false, error: 'ID y pago son requeridos' }), { status: 400 });
            
            const serverRes = await query(`SELECT payments FROM servidores WHERE id = $1`, [server_id]);
            if (serverRes.rowCount === 0) return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            
            const currentPayments = serverRes.rows[0].payments || [];
            const newPayment = {
                id: Date.now().toString(),
                amount: Number(payment.amount),
                date: new Date().toISOString(),
                receiptUrl: payment.receiptUrl || '',
                note: payment.note || ''
            };
            
            currentPayments.push(newPayment);
            
            const res = await query(
                `UPDATE servidores SET payments = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
                [JSON.stringify(currentPayments), server_id]
            );
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }

        else if (action === 'delete_payment') {
            const { payment_index } = body;
            if (!server_id || payment_index === undefined) return new Response(JSON.stringify({ success: false, error: 'ID y payment_index son requeridos' }), { status: 400 });
            
            const serverRes = await query(`SELECT payments FROM servidores WHERE id = $1`, [server_id]);
            if (serverRes.rowCount === 0) return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            
            let currentPayments = serverRes.rows[0].payments || [];
            if (payment_index >= 0 && payment_index < currentPayments.length) {
                currentPayments.splice(payment_index, 1);
            } else {
                return new Response(JSON.stringify({ success: false, error: 'Índice de pago inválido' }), { status: 400 });
            }
            
            const res = await query(
                `UPDATE servidores SET payments = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
                [JSON.stringify(currentPayments), server_id]
            );
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }

        else if (action === 'update_config') {
            if (!configData) return new Response(JSON.stringify({ success: false, error: 'Faltan datos de configuración' }), { status: 400 });
            
            const res = await query(
                `UPDATE servidores_config SET cena_price = $1, almuerzo_price = $2, base_nuevo = $3, base_antiguo = $4, camiseta_price = $5, saco_price = $6, mono_price = $7, kanguro_price = $8, updated_at = CURRENT_TIMESTAMP RETURNING *`,
                [configData.cena_price, configData.almuerzo_price, configData.base_nuevo, configData.base_antiguo, configData.camiseta_price, configData.saco_price, configData.mono_price, configData.kanguro_price]
            );
            return new Response(JSON.stringify({ success: true, config: res.rows[0] }), { status: 200 });
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
        
        else if (action === 'update_retreat_role') {
            const { retreat_role } = body;
            if (!server_id || !retreat_role) return new Response(JSON.stringify({ success: false, error: 'ID y rol son requeridos' }), { status: 400 });
            
            const res = await query(`UPDATE servidores SET retreat_role = $1 WHERE id = $2 RETURNING *`, [retreat_role, server_id]);
            
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }

        return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error("Error gestionando servidores coordi:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error procesando solicitud' }), { status: 500 });
    }
};
