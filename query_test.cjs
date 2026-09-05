const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT * FROM users LIMIT 1').then(res => {
    console.log(Object.keys(res.rows[0]));
    process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
