import { query } from '../../lib/db';
export async function GET() {
    try {
        const data = await query(`SELECT * FROM users WHERE phone = '3219736840'`);
        return new Response(JSON.stringify(data.rows, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch(e: any) {
        return new Response(e.message, { status: 500 });
    }
}
