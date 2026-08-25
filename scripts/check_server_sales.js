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
    const sales = [];
    res.rows.forEach(row => {
      const sold = row.tickets_sold;
      if (Array.isArray(sold)) {
        sold.forEach(sale => {
          sales.push({ server: row.full_name, ...sale });
        });
      }
    });
    console.log(`Total sales registered by servers: ${sales.length}`);
    if (sales.length > 0) {
      console.log('Sample sales:');
      console.dir(sales.slice(0, 3), { depth: null });
      
      const missingPhone = sales.filter(s => !s.telefono_comprador);
      console.log(`Sales missing phone number: ${missingPhone.length}`);
    }
  } finally {
    await client.end();
  }
}

run().catch(console.error);
