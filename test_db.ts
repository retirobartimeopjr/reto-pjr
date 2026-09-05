import { query } from './src/lib/db.js';

async function main() {
    try {
        const res = await query(`
            SELECT original_name, COUNT(*) as count 
            FROM historical_roles 
            WHERE server_id IS NULL 
            GROUP BY original_name 
            ORDER BY count DESC
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch(e) {
        console.error(e);
    }
}
main();
