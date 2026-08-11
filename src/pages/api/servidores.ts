import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const res = await query("SELECT id, full_name as server_name, tickets_sold, avatar_url FROM servidores WHERE is_v_retiro = true ORDER BY full_name ASC");
        
        return new Response(JSON.stringify({ success: true, data: res.rows }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error obteniendo servidores:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { action, server_name, ticket } = body;

        if (!action || !server_name) {
            return new Response(JSON.stringify({ success: false, error: 'Faltan datos requeridos (action, server_name)' }), { status: 400 });
        }

        if (action === 'add_server') {
            // Añadir un nuevo servidor (no hacemos ON CONFLICT DO NOTHING porque full_name no es UNIQUE en el nuevo esquema, pero podríamos comprobar)
            const exists = await query("SELECT id FROM servidores WHERE full_name = $1", [server_name.trim()]);
            if (exists.rows.length === 0) {
                await query(
                    `INSERT INTO servidores (full_name, tickets_sold) VALUES ($1, '[]'::jsonb)`,
                    [server_name.trim()]
                );
            }
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            
        } else if (action === 'add_ticket') {
            // Añadir una boleta vendida a un servidor
            if (!ticket || !ticket.nombre_comprador || !ticket.numeros_boleta || !ticket.cantidad || !ticket.medio_pago) {
                return new Response(JSON.stringify({ success: false, error: 'Faltan datos de la boleta (nombre, numeros de boleta, cantidad, medio de pago)' }), { status: 400 });
            }

            // 1. Extraer y parsear números de boleta solicitados
            const requestedTickets = ticket.numeros_boleta.split(',').map((n: string) => parseInt(n.trim(), 10)).filter((n: number) => !isNaN(n));
            if (requestedTickets.length === 0) {
                return new Response(JSON.stringify({ success: false, error: 'Números de boleta inválidos' }), { status: 400 });
            }

            // 2. Validar que las boletas existan, tengan user_id y estén pagadas en la tabla tickets
            const ticketsCheckRes = await query(
                `SELECT ticket_number FROM tickets WHERE ticket_number = ANY($1::int[]) AND user_id IS NOT NULL AND payed = 'yes'`,
                [requestedTickets]
            );
            
            if (ticketsCheckRes.rows.length !== requestedTickets.length) {
                return new Response(JSON.stringify({ success: false, error: 'Una o más boletas indicadas no han sido vendidas o pagadas oficialmente en el sistema.' }), { status: 400 });
            }

            // 3. Validar que NINGÚN servidor haya registrado ya alguna de estas boletas
            const allServersRes = await query(`SELECT full_name as server_name, tickets_sold FROM servidores`);
            for (const server of allServersRes.rows) {
                const soldArray = server.tickets_sold || [];
                for (const sale of soldArray) {
                    if (!sale.numeros_boleta) continue;
                    const saleTickets = sale.numeros_boleta.split(',').map((n: string) => parseInt(n.trim(), 10)).filter((n: number) => !isNaN(n));
                    
                    const intersection = requestedTickets.filter((n: number) => saleTickets.includes(n));
                    if (intersection.length > 0) {
                        return new Response(JSON.stringify({ success: false, error: `La boleta ${intersection[0]} ya fue registrada por el servidor: ${server.server_name}.` }), { status: 400 });
                    }
                }
            }

            const newTicket = {
                id: Date.now().toString(),
                ...ticket,
                fecha: new Date().toISOString()
            };

            const updateRes = await query(
                `UPDATE servidores 
                 SET tickets_sold = tickets_sold || $1::jsonb 
                 WHERE full_name = $2
                 RETURNING *`,
                [JSON.stringify([newTicket]), server_name]
            );

            if (updateRes.rowCount === 0) {
                 return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            }

            return new Response(JSON.stringify({ success: true, data: updateRes.rows[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            
        } else if (action === 'delete_ticket') {
            const { ticket_id } = body;
            if (!ticket_id) return new Response(JSON.stringify({ success: false, error: 'Falta ticket_id' }), { status: 400 });

            // Fetch current tickets
            const res = await query("SELECT tickets_sold FROM servidores WHERE full_name = $1", [server_name]);
            if (res.rows.length === 0) return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            
            const currentTickets = res.rows[0].tickets_sold || [];
            const newTickets = currentTickets.filter((t: any) => t.id !== ticket_id);

            await query("UPDATE servidores SET tickets_sold = $1::jsonb WHERE full_name = $2", [JSON.stringify(newTickets), server_name]);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        } else if (action === 'register_no_competitor') {
            const { ticket } = body;
            if (!server_name || !ticket || !ticket.nombre_comprador || !ticket.numeros_boleta || !ticket.receipt_url) {
                return new Response(JSON.stringify({ success: false, error: 'Faltan datos requeridos o el comprobante' }), { status: 400 });
            }

            const requestedTickets = ticket.numeros_boleta.split(',').map((n: string) => parseInt(n.trim(), 10)).filter((n: number) => !isNaN(n));
            if (requestedTickets.length === 0) {
                return new Response(JSON.stringify({ success: false, error: 'Números de boleta inválidos' }), { status: 400 });
            }

            // Validar que estén libres
            const checkRes = await query(`SELECT ticket_number, user_id FROM tickets WHERE ticket_number = ANY($1::int[])`, [requestedTickets]);
            for (const row of checkRes.rows) {
                if (row.user_id) {
                    return new Response(JSON.stringify({ success: false, error: `La boleta ${row.ticket_number} ya no está disponible.` }), { status: 400 });
                }
            }

            // 1. Bloquear tickets
            const updatePlaceholders = requestedTickets.map((_, i) => `$${i + 2}`).join(', ');
            await query(`
                UPDATE tickets 
                SET user_id = 'no-competitor', payed = 'yes', updated_at = CURRENT_TIMESTAMP
                WHERE ticket_number IN (${updatePlaceholders})
            `, ['no-competitor', ...requestedTickets]);

            // 2. Registro de auditoria con comprobante
            const crypto = await import('crypto');
            const registerId = crypto.randomUUID();
            await query(`
                INSERT INTO ticket_registers (id, ticket_number, phone, username, payed, status, user_id, imported_at, receipt_url, payment_value)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9)
            `, [
                registerId,
                requestedTickets[0], 
                '0000000000', 
                ticket.nombre_comprador + ' (No Competidor)',
                'yes',
                'OK',
                'no-competitor',
                ticket.receipt_url,
                ticket.costo_pagado || 0
            ]);

            // 3. Sumar a la meta del servidor
            const newTicketObj = {
                id: Date.now().toString(),
                nombre_comprador: ticket.nombre_comprador,
                numeros_boleta: requestedTickets.join(', '),
                cantidad: requestedTickets.length,
                medio_pago: ticket.medio_pago || 'Otro',
                costo_pagado: ticket.costo_pagado || 0,
                fecha: new Date().toISOString()
            };

            const updateRes = await query(
                `UPDATE servidores SET tickets_sold = tickets_sold || $1::jsonb WHERE full_name = $2 RETURNING *`,
                [JSON.stringify([newTicketObj]), server_name]
            );

            return new Response(JSON.stringify({ success: true, data: updateRes.rows[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

            const { ticket_id, ticket_data } = body;
            if (!ticket_id || !ticket_data) return new Response(JSON.stringify({ success: false, error: 'Faltan datos' }), { status: 400 });

            const res = await query("SELECT tickets_sold FROM servidores WHERE full_name = $1", [server_name]);
            if (res.rows.length === 0) return new Response(JSON.stringify({ success: false, error: 'Servidor no encontrado' }), { status: 404 });
            
            const currentTickets = res.rows[0].tickets_sold || [];
            const newTickets = currentTickets.map((t: any) => t.id === ticket_id ? { ...t, ...ticket_data } : t);

            await query("UPDATE servidores SET tickets_sold = $1::jsonb WHERE full_name = $2", [JSON.stringify(newTickets), server_name]);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        } else if (action === 'update_avatar') {
            const { avatar_url } = body;
            await query("UPDATE servidores SET avatar_url = $1 WHERE full_name = $2", [avatar_url || null, server_name]);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), { status: 400 });
        
    } catch (error) {
        console.error("Error actualizando servidor:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
