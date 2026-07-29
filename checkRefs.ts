import { config } from 'dotenv';
config({ path: '.env.local' });
import { query } from './src/lib/db.js';

async function main() {
    try {
        const refs = await query('SELECT * FROM user_referrals');
        console.log("User Referrals:", refs.rows);
        
        const pending = await query('SELECT * FROM pending_referrals');
        console.log("Pending Referrals:", pending.rows);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
