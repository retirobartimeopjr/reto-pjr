import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const region = import.meta.env.AWS_REGION || process.env.AWS_REGION || 'sa-east-1';
const bucketName = import.meta.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'bartimeo-assets-prod';
const accessKeyId = import.meta.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const s3Config: any = { region };
if (accessKeyId && secretAccessKey) {
    s3Config.credentials = { accessKeyId, secretAccessKey };
}
const s3Client = new S3Client(s3Config);

async function deleteS3File(url: string) {
    try {
        if (!url || !url.includes('.amazonaws.com/')) return;
        const key = url.split('.amazonaws.com/')[1];
        if (key) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: decodeURIComponent(key) }));
        }
    } catch (e) {
        console.error("Error deleting from S3:", url, e);
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, action, targetUserId, newActiveState, searchQuery, sortBy } = body;

        // 1. Authenticate Admin
        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Credenciales requeridas' }), { status: 401 });
        }
        
        const adminCheck = await query('SELECT password FROM admins WHERE username = $1', [username]);
        if (adminCheck.rowCount === 0) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }
        
        const isValid = await bcrypt.compare(password, adminCheck.rows[0].password);
        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        // 2. Handle Action: Fetch Users
        if (action === 'fetch') {
            let sql = `
                SELECT 
                    us.user_id, 
                    us.username, 
                    us.is_active, 
                    us.calculated_score,
                    u.phone,
                    u.cedula,
                    u.email,
                    u.referidos
                FROM user_stats us
                JOIN users u ON us.user_id = u.id
            `;
            let params: any[] = [];

            if (searchQuery && searchQuery.trim().length > 0) {
                sql += ` WHERE us.username ILIKE $1 OR u.phone ILIKE $1 OR u.cedula ILIKE $1`;
                params.push(`%${searchQuery.trim()}%`);
            }

            if (sortBy === 'referrals') {
                sql += ` ORDER BY u.referidos DESC LIMIT 1000`;
            } else {
                sql += ` ORDER BY us.calculated_score DESC LIMIT 1000`; // Increased limit to show more users in admin
            }

            const usersRes = await query(sql, params);
            return new Response(JSON.stringify(usersRes.rows), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 3. Handle Action: Upload Manual Receipt
        if (action === 'upload_receipt') {
            if (!targetUserId || !body.targetUserPhone || !body.receiptUrl) {
                return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
            }
            const registerId = crypto.randomUUID();
            await query(`
                INSERT INTO ticket_registers (id, phone, username, payed, status, user_id, imported_at, receipt_url) 
                VALUES ($1, $2, 'Carga Manual Admin', 'yes', 'OK', $3, CURRENT_TIMESTAMP, $4)
            `, [registerId, body.targetUserPhone, targetUserId, body.receiptUrl]);

            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 3. Handle Action: Toggle Active Status
        if (action === 'toggle') {
            if (!targetUserId) {
                return new Response(JSON.stringify({ error: 'Falta targetUserId' }), { status: 400 });
            }
            
            const deactivationReason = newActiveState ? null : (body.deactivationReason || 'Desactivado manualmente');

            const updateRes = await query(`
                UPDATE users 
                SET is_active = $1, deactivation_reason = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 
                RETURNING id, is_active
            `, [newActiveState, targetUserId, deactivationReason]);

            if (updateRes.rowCount === 0) {
                return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404 });
            }

            // Si estamos activando al usuario, asumimos que su pago fue verificado y aprobado.
            // Actualizamos sus boletas pendientes a pagadas.
            if (newActiveState) {
                await query(`
                    UPDATE tickets 
                    SET payed = 'yes', updated_at = CURRENT_TIMESTAMP 
                    WHERE user_id = $1 AND (payed = 'no' OR payed IS NULL)
                `, [targetUserId]);
                
                await query(`
                    UPDATE ticket_registers
                    SET payed = 'yes'
                    WHERE user_id = $1 AND (payed = 'no' OR payed IS NULL)
                `, [targetUserId]);
            }

            return new Response(JSON.stringify({ success: true, user: updateRes.rows[0] }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        if (action === 'add_extra_trivia') {
            if (!targetUserId || typeof body.extraAmount !== 'number') {
                return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
            }
            
            // Subtract the extra amount from daily_trivia_count so they can play more
            await query(`
                UPDATE users 
                SET daily_trivia_count = COALESCE(daily_trivia_count, 0) - $1 
                WHERE id = $2
            `, [body.extraAmount, targetUserId]);

            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        if (action === 'delete') {
            if (!targetUserId) {
                return new Response(JSON.stringify({ error: 'Falta targetUserId' }), { status: 400 });
            }

            // Fetch URLs to delete from S3
            const urlsToDelete: string[] = [];
            const receiptsRes = await query(`SELECT receipt_url FROM ticket_registers WHERE user_id = $1 AND receipt_url IS NOT NULL`, [targetUserId]);
            urlsToDelete.push(...receiptsRes.rows.map(r => r.receipt_url));
            const photosRes = await query(`SELECT photo_url FROM user_parroquia_visits WHERE user_id = $1 AND photo_url IS NOT NULL`, [targetUserId]);
            urlsToDelete.push(...photosRes.rows.map(r => r.photo_url));

            // Delete from S3
            for (const url of urlsToDelete) {
                await deleteS3File(url);
            }

            // Clean up referrals where this user is involved
            const userPhoneRes = await query(`SELECT phone FROM users WHERE id = $1`, [targetUserId]);
            if (userPhoneRes.rowCount > 0) {
                const phone = userPhoneRes.rows[0].phone;
                await query(`DELETE FROM user_referrals WHERE referrer_phone = $1`, [phone]);
                await query(`DELETE FROM pending_referrals WHERE referrer_phone = $1 OR new_user_phone = $1`, [phone]);
            }

            // Finally, delete user from DB
            const deleteRes = await query(`DELETE FROM users WHERE id = $1`, [targetUserId]);

            if (deleteRes.rowCount === 0) {
                return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404 });
            }

            return new Response(JSON.stringify({ success: true, message: 'Usuario eliminado' }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error("❌ Error en manageUsers API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
