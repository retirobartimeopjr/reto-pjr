import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const res = await query(`
            SELECT id, code, name, vicaria, latitude, longitude, reward 
            FROM parroquias
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `);

        const parroquias = res.rows.map(row => {
            return {
                id: row.id.toString(), // Mantenemos string id por compatibilidad con el frontend
                code: row.code || '',
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

export const DELETE: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        const { id } = data;

        if (!id) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        // Primero eliminamos las visitas asociadas (esto disparará el trigger que descuenta los puntos a los usuarios)
        await query(`
            DELETE FROM user_parroquia_visits
            WHERE parroquia_id = $1
        `, [id]);

        // Luego eliminamos la parroquia
        const res = await query(`
            DELETE FROM parroquias 
            WHERE id = $1
            RETURNING id
        `, [id]);

        if (res.rowCount === 0) {
            return new Response(JSON.stringify({ error: "Parroquia no encontrada" }), { status: 404 });
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error("❌ Error eliminando parroquia:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}

export const PATCH: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        const { ids, reward } = data;

        if (!ids || !Array.isArray(ids) || reward === undefined) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        const res = await query(`
            UPDATE parroquias 
            SET reward = $1
            WHERE id = ANY($2::int[])
            RETURNING id
        `, [reward, ids.map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)]);

        return new Response(JSON.stringify({ success: true, count: res.rowCount }), { status: 200 });
    } catch (error) {
        console.error("❌ Error bulk actualizando parroquias:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
