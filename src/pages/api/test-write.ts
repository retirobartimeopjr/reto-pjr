
import type { APIRoute } from 'astro';
import { appendRow } from '../../lib/googleSheets';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { id, timestamp } = body;

        if (id === undefined) {
            return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400 });
        }

        // Writes to 'test' sheet, Column A gets the ID
        // Assuming 'test' sheet exists.
        await appendRow('test!A:B', [id, timestamp || new Date().toISOString()]);

        return new Response(JSON.stringify({ success: true, id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Write API Error", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
