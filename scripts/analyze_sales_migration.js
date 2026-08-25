import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const client = new Client({ 
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const res = await client.query('SELECT full_name, tickets_sold FROM servidores WHERE tickets_sold IS NOT NULL');
    const allSales = [];
    res.rows.forEach(row => {
      const sold = row.tickets_sold;
      if (Array.isArray(sold)) {
        sold.forEach(sale => {
          allSales.push({ server: row.full_name, ...sale });
        });
      }
    });

    console.log(`Found ${allSales.length} total sales in servidores.`);

    const byPhone = {};
    const noPhone = [];

    for (const sale of allSales) {
        let phone = sale.telefono_comprador?.trim();
        
        // Sometimes it's stored differently?
        if (!phone) {
            noPhone.push(sale);
        } else {
            if (!byPhone[phone]) byPhone[phone] = { sales: [], user: null };
            byPhone[phone].sales.push(sale);
        }
    }

    console.log(`Sales WITH phone: ${Object.keys(byPhone).length} unique phones.`);
    console.log(`Sales WITHOUT phone: ${noPhone.length} sales.`);

    // Check which phones exist in users
    for (const phone of Object.keys(byPhone)) {
        const userRes = await client.query('SELECT id, username FROM users WHERE phone = $1 OR phone LIKE $2', [phone, `%${phone}`]);
        if (userRes.rowCount > 0) {
            byPhone[phone].user = userRes.rows[0];
        }
    }

    let existingUsers = 0;
    let newUsers = 0;
    let totalTicketsExisting = 0;
    let totalTicketsNew = 0;

    for (const phone of Object.keys(byPhone)) {
        const info = byPhone[phone];
        let count = info.sales.reduce((acc, s) => acc + (s.cantidad || 0), 0);
        if (info.user) {
            existingUsers++;
            totalTicketsExisting += count;
        } else {
            newUsers++;
            totalTicketsNew += count;
        }
    }

    let totalTicketsNoPhone = noPhone.reduce((acc, s) => acc + (s.cantidad || 0), 0);

    console.log(`--- ANALYSIS ---`);
    console.log(`Phones that EXIST in /reto: ${existingUsers} (representing ${totalTicketsExisting} tickets)`);
    console.log(`Phones that DO NOT EXIST in /reto: ${newUsers} (representing ${totalTicketsNew} tickets)`);
    console.log(`Sales WITHOUT a phone number: ${noPhone.length} (representing ${totalTicketsNoPhone} tickets)`);
    
    if (noPhone.length > 0) {
        console.log(`\nSample of sales without phone:`);
        console.dir(noPhone.slice(0, 3), { depth: null });
    }

  } finally {
    await client.end();
  }
}

run().catch(console.error);
