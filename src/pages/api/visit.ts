import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import crypto from 'crypto';
import { jwtVerify } from 'jose';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // 1. VALIDACIÓN JWT DE SEGURIDAD (Evita IDOR)
        const token = cookies.get('auth_token')?.value;
        if (!token) {
            return new Response(JSON.stringify({ success: false, error: 'No autorizado. Inicia sesión.' }), { status: 401 });
        }

        let jwtPayload;
        try {
            const secret = new TextEncoder().encode(import.meta.env.JWT_SECRET || process.env.JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);
            jwtPayload = payload;
        } catch (e) {
            return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), { status: 403 });
        }

        const body = await request.json();
        const { parroquiaId, userLogInfo, photoPath } = body;

        // El userId PROVIENE EXCLUSIVAMENTE DEL TOKEN VERIFICADO, no confiamos en el cliente.
        const userId = jwtPayload.userId;

        // Log user info as requested by user
        if (userLogInfo) {
            console.log("--- LOGGED IN USER INFO FROM CLIENT ---");
            console.log("UserID:", userId);
            console.log("ParroquiaID:", parroquiaId);
            console.log("Photo URL:", photoPath);
            console.log("---------------------------------------");
        }

        if (!userId || !parroquiaId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'UserID y ParroquiaID son requeridos'
            }), { status: 400 });
        }

        // 1. Validar que la Parroquia exista y obtener su puntaje (reward)
        const parishRes = await query('SELECT reward FROM parroquias WHERE id = $1', [parseInt(parroquiaId)]);
        
        if (parishRes.rowCount === 0) {
             return new Response(JSON.stringify({
                success: false,
                error: 'Parroquia no encontrada en la base de datos'
            }), { status: 404 });
        }
        
        const rewardPoints = parishRes.rows[0].reward || 0;
        const visitId = crypto.randomUUID(); // Usamos UUID nativo de Node.js

        // 2. Insertar la visita (Postgres evitará automáticamente los duplicados con UNIQUE CONSTRAINT)
        try {
            await query(`
                INSERT INTO user_parroquia_visits (id, user_id, parroquia_id, points_awarded, photo_url)
                VALUES ($1, $2, $3, $4, $5)
            `, [visitId, userId, parseInt(parroquiaId), rewardPoints, photoPath || null]);

            console.log(`✅ [VISIT POSTGRES] Visita registrada para Usuario ${userId} en Parroquia ${parroquiaId}. Puntos: ${rewardPoints}`);
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Visita registrada y puntos sumados',
                visitId: visitId
            }), { status: 200 });

        } catch (err: any) {
            // El código de error 23505 en Postgres significa Unique Violation (Duplicado)
            if (err.code === '23505') {
                 console.log(`⚠️ [VISIT DUPLICATE] El usuario ${userId} intentó visitar de nuevo la parroquia ${parroquiaId}`);
                 return new Response(JSON.stringify({
                    success: false,
                    code: 'DUPLICATE_VISIT',
                    error: 'Ya has visitado esta parroquia'
                }), { status: 409 });
            }
            throw err; // Si es otro error, lo capturará el catch global
        }

    } catch (error: any) {
        console.error("❌ [VISIT API ERROR Postgres]", error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error registrando la visita en la base de datos'
        }), { status: 500 });
    }
};
