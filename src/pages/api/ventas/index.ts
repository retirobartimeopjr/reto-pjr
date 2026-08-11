import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ request }) => {
    try {
        // Fetch configuration
        const configRes = await query("SELECT value FROM app_config WHERE key = 'ventas_config'");
        let config = { limits: { arroz_con_pollo: 60, tamal: 40 }, prices: { arroz_con_pollo: { sencillo: 20000, combo: 22000 }, tamal: { sencillo: 10000, combo: 13000 } } };
        
        if (configRes.rows.length > 0) {
            try {
                config = typeof configRes.rows[0].value === 'string' ? JSON.parse(configRes.rows[0].value) : configRes.rows[0].value;
            } catch (e) {
                console.error("Error parsing config", e);
            }
        }

        // Fetch sales
        const ventasRes = await query(`
            SELECT * FROM ventas_reservas 
            ORDER BY created_at DESC
        `);
        
        const ventas = ventasRes.rows;
        
        // Calculate stats (only for ACTIVA)
        let soldArroz = 0;
        let soldTamal = 0;
        let gananciaParcial = 0;

        ventas.forEach(v => {
            if (v.estado === 'ACTIVA') {
                if (v.producto === 'Arroz con Pollo') {
                    soldArroz += v.cantidad;
                } else if (v.producto === 'Tamal') {
                    soldTamal += v.cantidad;
                }
                gananciaParcial += (v.precio_unitario * v.cantidad);
            }
        });

        return new Response(JSON.stringify({
            success: true,
            config,
            ventas,
            stats: {
                soldArroz,
                soldTamal,
                remainingArroz: config.limits.arroz_con_pollo - soldArroz,
                remainingTamal: config.limits.tamal - soldTamal,
                gananciaParcial
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error("GET /api/ventas Error:", e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { vendedor, comprador_nombre, comprador_telefono, hora_recogida, producto, variante, cantidad = 1, precio_unitario } = body;

        if (!vendedor || !comprador_nombre || !producto || !variante || !precio_unitario) {
            return new Response(JSON.stringify({ success: false, error: 'Faltan campos obligatorios' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const insertRes = await query(`
            INSERT INTO ventas_reservas (vendedor, comprador_nombre, comprador_telefono, hora_recogida, producto, variante, cantidad, precio_unitario, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVA')
            RETURNING *;
        `, [vendedor, comprador_nombre, comprador_telefono, hora_recogida, producto, variante, cantidad, precio_unitario]);

        return new Response(JSON.stringify({ success: true, reserva: insertRes.rows[0] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error("POST /api/ventas Error:", e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
