import { query } from '../../lib/db';
export const GET = async () => {
    try {
        await query(`UPDATE users SET daily_trivia_count = 0, last_trivia_date = '2026-08-24' WHERE phone = '3219736840'`);
        return new Response("Pilar unblocked!");
    } catch(e: any) {
        return new Response(e.message, { status: 500 });
    }
};
