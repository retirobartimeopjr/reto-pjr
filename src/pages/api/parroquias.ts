
import type { APIRoute } from 'astro';
import { readSheet } from '../../lib/googleSheets';

export const GET: APIRoute = async () => {
    try {
        const rows = await readSheet('parroquia!A:F'); // Fetch A:F to include Vicaria
        if (!rows) {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Format: A=id, B=name, C=address(ignored), D=lat,lng, E=?, F=vicaria
        const parroquias = rows.slice(1).map(row => {
            const coords = row[3]?.split(',').map((n: string) => parseFloat(n.trim()));
            if (!coords || coords.length !== 2) return null;
            return {
                id: row[0],
                name: row[1],
                center: { lat: coords[0], lng: coords[1] },
                vicaria: row[5] // Column F
            };
        }).filter(p => p !== null);

        return new Response(JSON.stringify(parroquias), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error("API Error", error);
        return new Response(JSON.stringify({ error: "Failed to fetch" }), { status: 500 });
    }
}
