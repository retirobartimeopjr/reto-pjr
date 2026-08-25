import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import { getServerTicketAllocations } from '../../lib/serverTickets';

export const GET: APIRoute = async () => {
    try {
        const res = await query("SELECT id, full_name as server_name, tickets_sold, avatar_url FROM servidores WHERE is_v_retiro = true ORDER BY full_name ASC");
        
        const allocations = await getServerTicketAllocations();

        const serversWithAllocations = res.rows.map(server => ({
            ...server,
            assigned_tickets: allocations[server.server_name] || []
        }));

        return new Response(JSON.stringify({ success: true, data: serversWithAllocations }), {
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
            const exists = await query("SELECT id FROM servidores WHERE full_name = $1", [server_name.trim()]);
            if (exists.rows.length === 0) {
                await query(
                    `INSERT INTO servidores (full_name, tickets_sold) VALUES ($1, '[]'::jsonb)`,
                    [server_name.trim()]
                );
            }
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            
        } else if (action === 'link_phone') {
            const { phone } = body;
            if (!phone) return new Response(JSON.stringify({ success: false, error: 'Falta el número de teléfono' }), { status: 400 });

            // Buscar usuario en el reto por teléfono
            const userRes = await query(`SELECT id, username, phone FROM users WHERE phone = $1 OR phone LIKE '%' || $1`, [phone.trim()]);
            if (userRes.rows.length === 0) {
                return new Response(JSON.stringify({ success: false, error: 'No se encontró ningún competidor registrado con ese número de teléfono.' }), { status: 404 });
            }
            const user = userRes.rows[0];

            // Buscar boletas que tenga este usuario asignadas
            const ticketsRes = await query(`SELECT ticket_number, payed FROM tickets WHERE user_id = $1`, [user.id]);
            if (ticketsRes.rows.length === 0) {
                return new Response(JSON.stringify({ success: false, error: 'El competidor está registrado pero no tiene ninguna boleta asignada aún.' }), { status: 400 });
            }

            const ticketNumbers = ticketsRes.rows.map((t: any) => t.ticket_number).join(', ');

            // Formatear como venta para el servidor
            const newTicket = {
                id: Date.now().toString(),
                numeros_boleta: ticketNumbers,
                nombre_comprador: user.username,
                telefono_comprador: user.phone,
                cantidad: ticketsRes.rows.length,
                medio_pago: 'Ya registrado',
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

            return new Response(JSON.stringify({ success: true, data: updateRes.rows[0], user_name: user.username }), { status: 200, headers: { 'Content-Type': 'application/json' } });

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
            if (!server_name || !ticket || !ticket.nombre_comprador || !ticket.telefono_comprador || !ticket.numeros_boleta || !ticket.receipt_url) {
                return new Response(JSON.stringify({ success: false, error: 'Faltan datos requeridos, el teléfono, o el comprobante' }), { status: 400 });
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

            // 0. Encontrar o crear usuario
            const phone = ticket.telefono_comprador.trim();
            const crypto = await import('crypto');
            
            let userRes = await query('SELECT id FROM users WHERE phone = $1', [phone]);
            let userId = null;

            if (userRes.rowCount > 0) {
                userId = userRes.rows[0].id;
            } else {
                userId = crypto.randomUUID();
                await query(`
                    INSERT INTO users (id, phone, username, referencia, tickets_quantity, payed_tickets, total_points, daily_trivia_count)
                    VALUES ($1, $2, $3, $4, 0, 0, 0, 0)
                `, [userId, phone, ticket.nombre_comprador, server_name]);
            }

            // 1. Bloquear tickets y asignar al usuario
            const updatePlaceholders = requestedTickets.map((_, i) => `$${i + 1}`).join(', ');
            await query(`
                UPDATE tickets 
                SET user_id = '${userId}', payed = 'yes', updated_at = CURRENT_TIMESTAMP
                WHERE ticket_number IN (${updatePlaceholders})
            `, requestedTickets);

            // 2. Registro de auditoria con comprobante
            const registerId = crypto.randomUUID();
            const regPlaceholders = requestedTickets.map((_, i) => `$${i + 8}`).join(', ');
            await query(`
                INSERT INTO ticket_registers (id, ticket_number, phone, username, payed, status, user_id, imported_at, receipt_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8)
            `, [
                registerId,
                requestedTickets[0], 
                phone, 
                ticket.nombre_comprador,
                'yes',
                'OK',
                userId,
                ticket.receipt_url
            ]);

            // 3. Sumar a la meta del servidor
            const newTicketObj = {
                id: Date.now().toString(),
                nombre_comprador: ticket.nombre_comprador,
                telefono_comprador: phone,
                numeros_boleta: requestedTickets.join(', '),
                cantidad: requestedTickets.length,
                medio_pago: ticket.medio_pago || 'Otro',
                costo_pagado: ticket.costo_pagado || 0,
                receipt_url: ticket.receipt_url,
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
