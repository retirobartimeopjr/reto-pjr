import { config } from 'dotenv';
config({ path: '.env.local' });
import { query } from './src/lib/db.js';

async function main() {
    try {
        console.log("Limpiando referidos fantasma...");

        // Eliminar user_referrals donde el referrer o referred ya no existan en users
        const delRef = await query(`
            DELETE FROM user_referrals 
            WHERE referrer_phone NOT IN (SELECT phone FROM users)
               OR referred_phone NOT IN (SELECT phone FROM users)
        `);
        console.log(`Borrados ${delRef.rowCount} referidos fantasma de user_referrals.`);

        // Eliminar pending_referrals donde el referrer o new_user ya no existan (opcionalmente)
        // O más bien, si el new_user no existe en pending_referrals todavía tiene sentido,
        // pero si el referrer ya no existe, entonces la invitación es inválida.
        const delPending = await query(`
            DELETE FROM pending_referrals
            WHERE referrer_phone NOT IN (SELECT phone FROM users)
        `);
        console.log(`Borrados ${delPending.rowCount} pendientes fantasma de pending_referrals.`);

        // Recalcular el contador de referidos para todos los usuarios existentes por si acaso
        await query(`UPDATE users SET referidos = 0`);
        const updateUsers = await query(`
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
        console.log(`Contador de referidos recalculado para ${updateUsers.rowCount} usuarios.`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
