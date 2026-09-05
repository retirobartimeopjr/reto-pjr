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
        const { parroquiaId, userLogInfo, photoPath, flagged: clientFlagged, flagReason: clientFlagReason } = body;

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

        let finalFlagged = !!clientFlagged;
        let finalFlagReason = clientFlagReason || '';

        // Anti-spoofing check: less than 3 minutes (180,000 ms) since ANY last visit
        const lastVisitRes = await query(
            'SELECT visited_at FROM user_parroquia_visits WHERE user_id = $1 ORDER BY visited_at DESC LIMIT 1',
            [userId]
        );
        
        if (lastVisitRes.rowCount > 0) {
            const lastVisitTime = new Date(lastVisitRes.rows[0].visited_at).getTime();
            const now = Date.now();
            if (now - lastVisitTime < 120000) { // less than 3 minutes
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Debes esperar al menos 3 minutos entre cada registro de visita.'
                }), { status: 429 });
            }
        }

        // Anti-spam check: Max 1 visit per parish per day
        const todayVisitRes = await query(`
            SELECT COUNT(*) as count 
            FROM user_parroquia_visits 
            WHERE user_id = $1 
            AND parroquia_id = $2 
            AND DATE(visited_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')
        `, [userId, parseInt(parroquiaId)]);

        if (parseInt(todayVisitRes.rows[0].count) > 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Solo puedes registrar una visita por parroquia por día.'
            }), { status: 429 });
        }

        // 1. Validar que la Parroquia exista y obtener su puntaje (reward)
        const parishRes = await query('SELECT reward FROM parroquias WHERE id = $1', [parseInt(parroquiaId)]);
        
        if (parishRes.rowCount === 0) {
             return new Response(JSON.stringify({
                success: false,
                error: 'Parroquia no encontrada en la base de datos'
            }), { status: 404 });
        }
        
        let rewardPoints = parishRes.rows[0].reward || 0;
        
        // 2. Verificar si el usuario ya ha visitado esta parroquia anteriormente
        const previousVisitsRes = await query(
            'SELECT COUNT(*) as count FROM user_parroquia_visits WHERE user_id = $1 AND parroquia_id = $2',
            [userId, parseInt(parroquiaId)]
        );
        const previousVisitsCount = parseInt(previousVisitsRes.rows[0].count);

        if (previousVisitsCount > 0) {
            rewardPoints = 10; // Puntos fijos por visita repetida
        }

        const visitId = crypto.randomUUID(); // Usamos UUID nativo de Node.js

        // 3. Insertar la visita
        try {
            await query(`
                INSERT INTO user_parroquia_visits (id, user_id, parroquia_id, points_awarded, photo_url, flagged, flag_reason)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [visitId, userId, parseInt(parroquiaId), rewardPoints, photoPath || null, finalFlagged, finalFlagReason || null]);

            console.log(`✅ [VISIT POSTGRES] Visita registrada para Usuario ${userId} en Parroquia ${parroquiaId}. Puntos: ${rewardPoints} (Visita #${previousVisitsCount + 1})`);
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Visita registrada y puntos sumados',
                visitId: visitId,
                pointsAwarded: rewardPoints
            }), { status: 200 });

        } catch (err: any) {
            console.error("❌ [VISIT API ERROR Postgres]", err);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error registrando la visita en la base de datos'
            }), { status: 500 });
        }

    } catch (error: any) {
        console.error("❌ [VISIT API ERROR Postgres]", error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error registrando la visita en la base de datos'
        }), { status: 500 });
    }
};
