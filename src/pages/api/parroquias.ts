import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const res = await query(`
            SELECT id, name, vicaria, latitude, longitude, reward 
            FROM parroquias
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `);

        const parroquias = res.rows.map(row => {
            return {
                id: row.id.toString(), // Mantenemos string id por compatibilidad con el frontend
                name: row.name,
                center: { 
                    lat: Number(row.latitude), 
                    lng: Number(row.longitude) 
                },
                vicaria: row.vicaria,
                reward: row.reward || 0
            };
        });

        return new Response(JSON.stringify(parroquias), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error("❌ Postgres Parroquias API Error:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch data from Postgres" }), { status: 500 });
    }
}
