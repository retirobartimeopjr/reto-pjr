import { query } from '../../lib/db';

export async function GET() {
    try {
        await query(`ALTER TABLE bartimeo ADD COLUMN IF NOT EXISTS respuesta_recibida BOOLEAN DEFAULT false;`);
        return new Response('OK');
    } catch (e: any) {
        return new Response(e.message, { status: 500 });
    }
}
