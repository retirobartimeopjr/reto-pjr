import { query } from './db';

export async function getServerTicketAllocations(): Promise<Record<string, number[]>> {
    // 1. Fetch current allocations from app_config
    const configRes = await query(`SELECT value FROM app_config WHERE key = 'server_ticket_allocations'`);
    let allocations: Record<string, number[]> = {};
    if (configRes.rows.length > 0) {
        allocations = configRes.rows[0].value;
    }

    // 2. Fetch all current servers
    const serversRes = await query(`SELECT full_name, tickets_sold FROM servidores WHERE is_v_retiro = true ORDER BY id ASC`);
    const servers = serversRes.rows;

    let needsUpdate = false;
    let highestAllocatedTicket = 299;

    // Find the highest ticket currently allocated to anyone
    for (const serverName in allocations) {
        for (const t of allocations[serverName]) {
            if (t > highestAllocatedTicket) {
                highestAllocatedTicket = t;
            }
        }
    }

    // 3. Fetch all taken tickets >= 300 in the general pool just in case we need to skip them
    const takenRes = await query(`SELECT ticket_number FROM tickets WHERE ticket_number >= 300 AND user_id IS NOT NULL`);
    const takenTickets = new Set(takenRes.rows.map(r => r.ticket_number));

    // 4. Allocate for new servers or top-up existing ones
    for (const serverRow of servers) {
        const server = serverRow.full_name;
        const currentAssigned = allocations[server] || [];
        
        // Calculate how many of their assigned tickets they have already sold
        let soldAssignedCount = 0;
        if (serverRow.tickets_sold && Array.isArray(serverRow.tickets_sold)) {
            const soldTicketsStr = serverRow.tickets_sold.map((t: any) => t.numeros_boleta).join(',');
            const soldSet = new Set(soldTicketsStr.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n)));
            soldAssignedCount = currentAssigned.filter(t => soldSet.has(t)).length;
        }

        const availableAssigned = currentAssigned.length - soldAssignedCount;
        let needed = 0;

        // Base allocation of 10
        if (currentAssigned.length < 10) {
            needed = 10 - currentAssigned.length;
        } 
        // Top-up condition: if they have 2 or fewer tickets left to sell, give them 8 more
        else if (availableAssigned <= 2) {
            needed = 8;
        }

        if (needed > 0) {
            let candidate = highestAllocatedTicket + 1;
            while (needed > 0) {
                // If candidate is not taken by a general user, assign it
                if (!takenTickets.has(candidate)) {
                    currentAssigned.push(candidate);
                    highestAllocatedTicket = candidate;
                    needed--;
                } else {
                    highestAllocatedTicket = candidate; // Skip it
                }
                candidate++;
            }
            
            allocations[server] = currentAssigned.sort((a, b) => a - b);
            needsUpdate = true;
        }
    }

    // 5. Save back if updated
    if (needsUpdate) {
        await query(`
            INSERT INTO app_config (key, value) 
            VALUES ('server_ticket_allocations', $1::jsonb)
            ON CONFLICT (key) DO UPDATE SET value = $1::jsonb
        `, [JSON.stringify(allocations)]);
    }

    return allocations;
}
