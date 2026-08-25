import pkg from 'pg';
const { Client } = pkg;
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const client = new Client({ 
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Starting Migration...");

  try {
    await client.query('BEGIN'); // We use a transaction for safety

    // Fetch all servers that have sold tickets
    const serversRes = await client.query('SELECT full_name, tickets_sold FROM servidores WHERE tickets_sold IS NOT NULL');
    
    for (const server of serversRes.rows) {
        const soldArray = server.tickets_sold;
        if (!Array.isArray(soldArray)) continue;

        let serverUpdated = false;

        for (let i = 0; i < soldArray.length; i++) {
            const sale = soldArray[i];
            
            // Generate dummy phone if it doesn't exist
            let phone = sale.telefono_comprador?.trim();
            if (!phone) {
                // We'll use a prefix with the buyer's name (alphanumeric only) to group same buyer
                const cleanName = (sale.nombre_comprador || 'Anónimo').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
                phone = `SINTEL_${cleanName}_${sale.id || Date.now()}`; 
                // Wait, if it's the exact same buyer, we want them grouped.
                // Let's just use SINTEL_ + cleanName so they group together if the name is identical!
                phone = `SINTEL_${cleanName}`;
                
                // Save it back to the sale object so we update the JSON
                sale.telefono_comprador = phone;
                serverUpdated = true;
                console.log(`Assigned dummy phone: ${phone} to ${sale.nombre_comprador}`);
            }

            // Check if user exists
            let userRes = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
            let userId = null;

            if (userRes.rowCount > 0) {
                userId = userRes.rows[0].id;
                console.log(`User already exists for phone ${phone}: ${userId}`);
            } else {
                // Create user
                userId = crypto.randomUUID();
                await client.query(`
                    INSERT INTO users (id, phone, username, referencia, tickets_quantity, payed_tickets, total_points, daily_trivia_count)
                    VALUES ($1, $2, $3, $4, 0, 0, 0, 0)
                `, [userId, phone, sale.nombre_comprador, server.full_name]);
                console.log(`Created NEW user for phone ${phone}: ${userId}`);
            }

            // Extract ticket numbers
            if (sale.numeros_boleta) {
                const requestedTickets = sale.numeros_boleta.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
                
                if (requestedTickets.length > 0) {
                    const updatePlaceholders = requestedTickets.map((_, i) => `$${i + 1}`).join(', ');
                    // Update tickets table: Assign to this user!
                    const updateTicketsRes = await client.query(`
                        UPDATE tickets 
                        SET user_id = '${userId}', payed = 'yes', updated_at = CURRENT_TIMESTAMP
                        WHERE ticket_number IN (${updatePlaceholders})
                    `, requestedTickets);

                    console.log(`Updated ${updateTicketsRes.rowCount} tickets for user ${userId}`);

                    // Update ticket_registers
                    const regPlaceholders = requestedTickets.map((_, i) => `$${i + 3}`).join(', ');
                    const updateRegsRes = await client.query(`
                        UPDATE ticket_registers
                        SET user_id = '${userId}', phone = $1, username = $2
                        WHERE ticket_number IN (${regPlaceholders})
                    `, [phone, sale.nombre_comprador, ...requestedTickets]);
                    console.log(`Updated ${updateRegsRes.rowCount} ticket_registers for user ${userId}`);
                }
            }
        }

        // Save updated JSON array back to the server if we modified it
        if (serverUpdated) {
            await client.query(`
                UPDATE servidores 
                SET tickets_sold = $1::jsonb 
                WHERE full_name = $2
            `, [JSON.stringify(soldArray), server.full_name]);
            console.log(`Updated JSON tickets_sold for server: ${server.full_name}`);
        }
    }

    await client.query('COMMIT');
    console.log("Migration completed successfully!");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed, rolled back.", err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
