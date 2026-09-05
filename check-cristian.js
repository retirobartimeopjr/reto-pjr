import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'BartimeoRoot2026!*',
  database: 'bartimeodb'
});

async function run() {
  try {
    const user = await pool.query("SELECT * FROM users WHERE phone = '3178038919'");
    if (user.rows.length === 0) {
       console.log("User not found");
       return;
    }
    const u = user.rows[0];
    console.log("CRISTIAN USER DATA:");
    console.log(`- daily_trivia_count: ${u.daily_trivia_count}`);
    console.log(`- last_trivia_date: ${u.last_trivia_date}`);

    const isTodayQuery = await pool.query(`
        SELECT 
            (last_trivia_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE) as is_today_new,
            (last_trivia_date = ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota') - INTERVAL '5 hours')::DATE) as is_today_old,
            (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE as today_bogota
        FROM users WHERE id = $1
    `, [u.id]);
    console.log("TIMEZONE EVALUATION:");
    console.log(isTodayQuery.rows[0]);

    const answers = await pool.query(`
        SELECT 
            id, 
            pregunta_id,
            respuesta_enviada,
            answered_at,
            answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota' as bogota_time
        FROM user_trivia_answers 
        WHERE user_id = $1 
        ORDER BY answered_at DESC 
        LIMIT 20
    `, [u.id]);
    console.log("\nLATEST ANSWERS:");
    answers.rows.forEach(r => {
        console.log(`- Q_ID: ${r.pregunta_id} | UTC: ${r.answered_at.toISOString()} | Bogota: ${r.bogota_time}`);
    });
    
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
