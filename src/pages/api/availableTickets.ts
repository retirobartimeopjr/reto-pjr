import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import { getServerTicketAllocations } from '../../lib/serverTickets';

export const GET: APIRoute = async () => {
    try {
        // 1. Obtener asignaciones de servidores para bloquearlas
        const allocations = await getServerTicketAllocations();
        const reservedTickets = new Set<number>();
        for (const server in allocations) {
            allocations[server].forEach(t => reservedTickets.add(t));
        }

        // 2. Obtener todas las boletas disponibles (que no tengan dueño)
        let res = await query(`
            SELECT ticket_number 
            FROM tickets 
            WHERE user_id IS NULL 
            ORDER BY ticket_number ASC
        `);
        
        let availableTickets = res.rows
            .map((row: any) => row.ticket_number)
            .filter((t: number) => !reservedTickets.has(t));

        // 2. Reposición inteligente (si hay menos de 50 disponibles)
        if (availableTickets.length < 50) {
            // Encontrar el número de ticket más alto en toda la tabla
            const maxRes = await query(`SELECT MAX(ticket_number) as max_ticket FROM tickets`);
            let maxTicket = maxRes.rows[0]?.max_ticket || 0;

            const ticketsToGenerate = 50; // Agregamos 50 nuevas como el script original
            const newTickets = [];
            
            for (let i = 1; i <= ticketsToGenerate; i++) {
                newTickets.push(maxTicket + i);
            }

            // Insertar masivamente
            const values = newTickets.map(num => `(${num})`).join(', ');
            await query(`
                INSERT INTO tickets (ticket_number) 
                VALUES ${values}
            `);

            // Añadirlos a la lista de disponibles (ordenados)
            availableTickets = [...availableTickets, ...newTickets].sort((a, b) => a - b);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            available: availableTickets 
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Error fetching available tickets:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), { status: 500 });
    }
}
