const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'bartimeodb',
    user: 'postgres',
    password: 'BartimeoRoot2026!*'
});

pool.query("SELECT id, phone, daily_trivia_count, last_trivia_date FROM users WHERE phone = '3219736840'").then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}).catch(console.error);
