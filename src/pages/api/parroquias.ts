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

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        const { name, vicaria, latitude, longitude, reward } = data;

        if (!name || !latitude || !longitude) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        const res = await query(`
            INSERT INTO parroquias (name, vicaria, latitude, longitude, reward)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, vicaria, latitude, longitude, reward
        `, [name, vicaria || 'San Pedro', latitude, longitude, reward || 200]);

        return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 201 });
    } catch (error) {
        console.error("❌ Error creando parroquia:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}

export const PUT: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        const { id, name, vicaria, latitude, longitude, reward } = data;

        if (!id || !name || !latitude || !longitude) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        const res = await query(`
            UPDATE parroquias 
            SET name = $1, vicaria = $2, latitude = $3, longitude = $4, reward = $5
            WHERE id = $6
            RETURNING id, name, vicaria, latitude, longitude, reward
        `, [name, vicaria || 'San Pedro', latitude, longitude, reward || 200, id]);

        if (res.rowCount === 0) {
            return new Response(JSON.stringify({ error: "Parroquia no encontrada" }), { status: 404 });
        }

        return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
    } catch (error) {
        console.error("❌ Error actualizando parroquia:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
