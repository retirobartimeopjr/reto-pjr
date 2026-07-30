import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { tickets } = body;

        if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
            return new Response(JSON.stringify({ success: false, error: 'No tickets provided' }), { status: 400 });
        }

        const placeholders = tickets.map((_, i) => `$${i + 1}`).join(', ');
        const checkRes = await query(`SELECT ticket_number, user_id FROM tickets WHERE ticket_number IN (${placeholders})`, tickets);
        
        let takenTickets = [];
        for (const row of checkRes.rows) {
            if (row.user_id) {
                takenTickets.push(row.ticket_number);
            }
        }

        if (takenTickets.length > 0) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: `¡Ups! Alguien más fue más rápido. Las boletas ${takenTickets.join(', ')} acaban de ser compradas. Por favor elige otras.` 
            }), { status: 400 });
        }

        return new Response(JSON.stringify({ success: true }));

    } catch (error: any) {
        console.error("Check Tickets Error:", error);
        return new Response(JSON.stringify({ success: false, error: 'Internal Server Error' }), { status: 500 });
    }
};
