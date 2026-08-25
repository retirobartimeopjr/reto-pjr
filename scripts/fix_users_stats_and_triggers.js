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

  console.log("Creating sync_user_stats function...");
  await client.query(`
    CREATE OR REPLACE FUNCTION sync_user_stats()
    RETURNS TRIGGER AS $$
    DECLARE
        target_id VARCHAR;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            target_id := OLD.user_id;
        ELSE
            target_id := NEW.user_id;
        END IF;

        IF target_id IS NOT NULL THEN
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

  console.log("Creating sync_user_referrals function...");
  await client.query(`
    CREATE OR REPLACE FUNCTION sync_user_referrals()
    RETURNS TRIGGER AS $$
    DECLARE
        target_phone VARCHAR;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            target_phone := OLD.referrer_phone;
        ELSE
            target_phone := NEW.referrer_phone;
        END IF;

        IF target_phone IS NOT NULL THEN
            UPDATE users u
            SET 
                referidos = (SELECT COUNT(*) FROM user_referrals WHERE referrer_phone = target_phone),
                total_points = COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
                               COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) +
                               COALESCE((SELECT SUM(points_awarded) FROM user_referrals WHERE referrer_phone = target_phone), 0)
            WHERE u.phone = target_phone;
        END IF;

        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log("Creating triggers...");
  
  const triggers = [
      `DROP TRIGGER IF EXISTS trg_sync_user_parroquia_visits ON user_parroquia_visits;
       CREATE TRIGGER trg_sync_user_parroquia_visits
       AFTER INSERT OR UPDATE OR DELETE ON user_parroquia_visits
       FOR EACH ROW EXECUTE FUNCTION sync_user_stats();`,
       
      `DROP TRIGGER IF EXISTS trg_sync_user_trivia_answers ON user_trivia_answers;
       CREATE TRIGGER trg_sync_user_trivia_answers
       AFTER INSERT OR UPDATE OR DELETE ON user_trivia_answers
       FOR EACH ROW EXECUTE FUNCTION sync_user_stats();`,
       
      `DROP TRIGGER IF EXISTS trg_sync_tickets ON tickets;
       CREATE TRIGGER trg_sync_tickets
       AFTER UPDATE OF user_id, payed ON tickets
       FOR EACH ROW EXECUTE FUNCTION sync_user_stats();`,
       
      `DROP TRIGGER IF EXISTS trg_sync_user_referrals ON user_referrals;
       CREATE TRIGGER trg_sync_user_referrals
       AFTER INSERT OR UPDATE OR DELETE ON user_referrals
       FOR EACH ROW EXECUTE FUNCTION sync_user_referrals();`
  ];
  
  for (const t of triggers) {
      await client.query(t);
  }

  console.log("Updating all existing users to fix current inconsistencies...");
  const updateRes = await client.query(`
    UPDATE users u
    SET 
        tickets_quantity = (SELECT COUNT(*) FROM tickets WHERE user_id = u.id),
        payed_tickets = (SELECT COUNT(*) FROM tickets WHERE user_id = u.id AND payed = 'yes'),
        pending_pay = (SELECT COUNT(*) FROM tickets WHERE user_id = u.id AND (payed != 'yes' OR payed IS NULL)),
        total_points = COALESCE((SELECT SUM(points_awarded) FROM user_parroquia_visits WHERE user_id = u.id), 0) +
                       COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) +
                       COALESCE((SELECT SUM(points_awarded) FROM user_referrals WHERE referrer_phone = u.phone), 0),
        referidos = (SELECT COUNT(*) FROM user_referrals WHERE referrer_phone = u.phone);
  `);
  
  console.log(`Successfully updated ${updateRes.rowCount} users.`);
  
  await client.end();
  console.log("Done.");
}
run().catch(console.error);
