import { config } from 'dotenv';
config({ path: '.env.local' });
import { query } from './src/lib/db.js';

async function main() {
    try {
        console.log("Checking user_stats view...");
        const viewRes = await query("SELECT pg_get_viewdef('user_stats') as def");
        console.log(viewRes.rows[0].def);
        
        console.log("Updating users.referidos retroactively...");
        const res = await query(`
            UPDATE users u
            SET referidos = (
                SELECT count(*) 
                FROM user_referrals ur 
                WHERE ur.referrer_phone = u.phone
            )
            WHERE EXISTS (
                SELECT 1 FROM user_referrals ur WHERE ur.referrer_phone = u.phone
            )
        `);
        console.log("Updated rows:", res.rowCount);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
