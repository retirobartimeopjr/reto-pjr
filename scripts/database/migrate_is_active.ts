import { pool, query } from '../../src/lib/db';

async function migrate() {
    console.log("🚀 Starting User Deactivation DB Migration...");

    try {
        // 1. Add is_active column to users table
        console.log("Adding is_active column to users table (if it doesn't exist)...");
        await query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        `);
        console.log("✅ Column added.");

        // 2. Update user_stats view to include u.is_active
        console.log("Updating user_stats view...");
        await query(`DROP VIEW IF EXISTS user_stats;`);
        await query(`
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
                COALESCE((SELECT SUM(snapshot_reward) FROM user_trivia_answers WHERE user_id = u.id AND is_correct = true), 0) AS calculated_score
            FROM users u;
        `);
        console.log("✅ View updated.");

        console.log("Migration complete!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
    } finally {
        await pool.end();
    }
}

migrate();
