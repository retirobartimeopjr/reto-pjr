import { query, pool } from '../src/lib/db';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  console.log("Updating user_stats view to include referral points...");
  await query(`
    DROP VIEW IF EXISTS user_stats CASCADE;
    CREATE VIEW user_stats AS
    SELECT 
        u.id AS user_id,
        u.username,
        u.is_active,
        (SELECT COUNT(*) FROM user_parroquia_visits WHERE user_id = u.id) AS parroquias_visitadas,
        (SELECT COUNT(*) FROM user_trivia_answers WHERE user_id = u.id) AS respuestas_enviadas,
        (SELECT COUNT(*) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true) AS respuestas_correctas,
        (SELECT STRING_AGG(ticket_number::TEXT, ',') FROM tickets WHERE user_id = u.id) AS tickets_numbers,
        (SELECT STRING_AGG(fixed, ',') FROM tickets WHERE user_id = u.id) AS tickets_fixed,
        COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
        COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) +
        COALESCE((SELECT SUM(points_awarded) FROM user_referrals WHERE referrer_phone = u.phone), 0) AS calculated_score
    FROM users u;
  `);

  console.log("Updating sync_user_stats function to include referral points...");
  await query(`
    CREATE OR REPLACE FUNCTION sync_user_stats()
    RETURNS TRIGGER AS $$
    DECLARE
        target_id VARCHAR;
        target_phone VARCHAR;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            target_id := OLD.user_id;
        ELSE
            target_id := NEW.user_id;
        END IF;

        IF target_id IS NOT NULL THEN
            SELECT phone INTO target_phone FROM users WHERE id = target_id;

            UPDATE users u
            SET 
                tickets_quantity = (SELECT COUNT(*) FROM tickets WHERE user_id = u.id),
                payed_tickets = (SELECT COUNT(*) FROM tickets WHERE user_id = u.id AND payed = 'yes'),
                pending_pay = (SELECT COUNT(*) FROM tickets WHERE user_id = u.id AND (payed != 'yes' OR payed IS NULL)),
                total_points = COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
                               COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) +
                               COALESCE((SELECT SUM(points_awarded) FROM user_referrals WHERE referrer_phone = u.phone), 0)
            WHERE u.id = target_id;
        END IF;

        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log("Updating all existing users to fix current score inconsistencies...");
  const updateRes = await query(`
    UPDATE users u
    SET 
        total_points = COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
                       COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) +
                       COALESCE((SELECT SUM(points_awarded) FROM user_referrals WHERE referrer_phone = u.phone), 0);
  `);
  
  console.log(`Successfully updated scores for ${updateRes.rowCount} users.`);
  
  await pool.end();
  console.log("Done.");
}
run().catch(console.error);
