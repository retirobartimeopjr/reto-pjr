import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
    if (line.trim() && !line.startsWith('#') && line.includes('=')) {
        const [key, ...rest] = line.split('=');
        process.env[key.trim()] = rest.join('=').trim().replace(/^'|'$/g, '').replace(/^"|"$/g, '');
    }
}
import { pool } from '../src/lib/db.js';
import bcrypt from 'bcryptjs';

async function run() {
    try {
        const res = await pool.query('SELECT username, password FROM admins');
        console.log(`Found ${res.rowCount} admins`);

        for (const row of res.rows) {
            const { username, password } = row;
            // Solo hashear si no está hasheada (las de bcrypt empiezan por $2a$ o $2b$)
            if (!password.startsWith('$2a$') && !password.startsWith('$2b$')) {
                const hash = await bcrypt.hash(password, 10);
                await pool.query('UPDATE admins SET password = $1 WHERE username = $2', [hash, username]);
                console.log(`Hashed password for admin: ${username}`);
            } else {
                console.log(`Password for admin ${username} is already hashed`);
            }
        }
        console.log('Done!');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
}

run();
