import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { 
            name, 
            phone, 
            email, 
            paymentMethod, 
            paymentValue, 
            selectedTickets, 
            receiptUrl, 
            referral 
        } = body;

        if (!name || !phone || !selectedTickets || !Array.isArray(selectedTickets) || selectedTickets.length === 0) {
            return new Response(JSON.stringify({ success: false, error: 'Faltan datos requeridos (nombre, teléfono, boletas).' }), { status: 400 });
        }

        const estadoPago = (Number(paymentValue) >= selectedTickets.length * 10000) ? 'yes' : 'no';
        const isActive = estadoPago === 'yes';
        const deactivationReason = isActive ? null : 'Boleta pendiente de pago';

        // 1. Upsert User (Buscar por teléfono)
        const userRes = await query(`SELECT id, username, email FROM users WHERE phone = $1`, [phone]);
        let userId;
        let userNameToUse = name;

        if (userRes.rowCount > 0) {
            userId = userRes.rows[0].id;
            userNameToUse = userRes.rows[0].username || name;
            
            // No sobrescribir nombre ni email original si ya existía.
            // Actualizar estado activo o inactivo
            await query(`
                UPDATE users 
                SET is_active = $1, deactivation_reason = $2, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $3
            `, [isActive, deactivationReason, userId]);
        } else {
            userId = crypto.randomUUID();
            await query(
                `INSERT INTO users (id, phone, username, email, is_active, deactivation_reason, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, phone, name, email || null, isActive, deactivationReason, referral ? String(referral).replace(/\D/g, '').trim() : null]
            );
        }

        // 2. Marcar las boletas como tomadas por este usuario
        const placeholders = selectedTickets.map((_, i) => `$${i + 1}`).join(', ');
        const checkRes = await query(`SELECT ticket_number, user_id FROM tickets WHERE ticket_number IN (${placeholders})`, selectedTickets);
        
        for (const row of checkRes.rows) {
            if (row.user_id && row.user_id !== userId) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: `La boleta ${row.ticket_number} ya fue tomada por alguien más. Por favor elige otra.` 
                }), { status: 400 });
            }
        }



        const updatePlaceholders = selectedTickets.map((_, i) => `$${i + 3}`).join(', ');
        await query(`
            UPDATE tickets 
            SET user_id = $1, payed = $2, updated_at = CURRENT_TIMESTAMP
            WHERE ticket_number IN (${updatePlaceholders})
        `, [userId, estadoPago, ...selectedTickets]);

        const registerId = crypto.randomUUID();

        // 3. Crear registro en ticket_registers
        await query(`
            INSERT INTO ticket_registers (id, ticket_number, phone, username, payed, status, user_id, imported_at, receipt_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8)
        `, [
            registerId,
            selectedTickets[0], 
            phone,
            userNameToUse,
            estadoPago,
            'OK',
            userId,
            receiptUrl || null
        ]);
        
        // 4. Procesar Referido (Si no es el mismo)
        if (referral) {
            const targetReferral = String(referral).replace(/\D/g, '').trim();
            if (targetReferral.length >= 10 && targetReferral !== phone) {
                // Verificar si existe el referente
                const referrerRes = await query(`SELECT id FROM users WHERE phone = $1`, [targetReferral]);
                if (referrerRes.rowCount > 0) {
                    // Darle puntos en user_referrals si no existe ya
                    const refPointsRes = await query(`SELECT value FROM app_config WHERE key = 'referral_points'`);
                    const pts = refPointsRes.rowCount > 0 ? Number(refPointsRes.rows[0].value) : 150;
                    
                    const insertRef = await query(`
                        INSERT INTO user_referrals (referrer_phone, referred_phone, points_awarded)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (referrer_phone, referred_phone) DO NOTHING
                        RETURNING *
                    `, [targetReferral, phone, pts]);

                    if (insertRef.rowCount > 0) {
                        await query(`UPDATE users SET referidos = COALESCE(referidos, 0) + 1 WHERE phone = $1`, [targetReferral]);
                    }
                } else {
                    // Enviar a la cola fantasma
                    await query(`
                        INSERT INTO pending_referrals (referrer_phone, new_user_phone)
                        VALUES ($1, $2)
                        ON CONFLICT (referrer_phone, new_user_phone) DO NOTHING
                    `, [targetReferral, phone]);
                }
                
                // Guardar la referencia en el perfil del usuario para que sepa que ya usó un código
                await query(`UPDATE users SET referencia = $1 WHERE phone = $2 AND (referencia IS NULL OR referencia = '')`, [targetReferral, phone]);
            }
        }

        // 4. Enviar correos de notificación de forma asíncrona (no bloquea el response)
        sendNotifications(email, userNameToUse, selectedTickets, estadoPago, paymentValue, registerId).catch(console.error);

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Registro exitoso',
            is_active: isActive,
            deactivation_reason: deactivationReason
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error('❌ Postgres Registration API Error:', error);
        return new Response(JSON.stringify({ success: false, error: "Error interno del servidor (Postgres)." }), { status: 500 });
    }
}

async function sendNotifications(userEmail: string, name: string, selectedTickets: number[], estadoPago: string, paymentValue: string, registerId: string) {
    const emailUser = import.meta.env.EMAIL_USER || process.env.EMAIL_USER;
    const emailPass = import.meta.env.EMAIL_PASS || process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) return;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass }
    });

    const listaCodigosAcceso = selectedTickets.join(', ');
    const esPlural = selectedTickets.length > 1;
    const txtLlave = esPlural ? "tus llaves" : "tu llave";
    const txtLabel = esPlural ? "TUS CÓDIGOS DE SEGURIDAD" : "TU CÓDIGO DE SEGURIDAD";
    const txtSeguridad = esPlural ? "estos códigos" : "este código";

    // A. Correo al Slack
    const destinatarioSlack = "bartimeo-aaaatbeyexfobujb75ilevtnie@globant.org.slack.com";
    await transporter.sendMail({
        from: `"Retiro Bartimeo" <${emailUser}>`,
        to: destinatarioSlack,
        subject: `🎟️ Ticket: ${name} (${estadoPago.toUpperCase()})`,
        text: `Usuario: ${name}\nBoletas: ${listaCodigosAcceso}\nCódigos Acceso: ${listaCodigosAcceso}\nPago: ${paymentValue}`
    });

    // B. Correo al Usuario
    if (userEmail && userEmail.includes('@') && estadoPago === "yes") {
        const htmlMensaje = `
             <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
               <div style="background-color: #2c3e50; padding: 20px; text-align: center;">
                  <h2 style="color: #ffffff; margin: 0;">¡Bienvenido al Reto Bartimeo!</h2>
               </div>
               
               <div style="padding: 30px;">
                 <p style="font-size: 16px; line-height: 1.5;">Hola <strong>${name}</strong>,</p>
                 <p style="font-size: 16px;">¡Tu registro ha sido exitoso! Aquí tienes ${txtLlave} de Verificacion. Solo tienes que usarla para casos especiales...¡Como la Victoria!</p>
                 
                 <div style="background-color: #fff5f6; border: 2px dashed #ab2a3e; padding: 20px; text-align: center; border-radius: 10px; margin: 25px 0;">
                   <span style="display: block; font-size: 14px; color: #7f8c8d; margin-bottom: 5px;">${txtLabel}</span>
                   <strong style="font-size: 36px; color: #2c3e50; letter-spacing: 2px;">${listaCodigosAcceso}</strong>
                 </div>
                 
                 <div style="text-align: center; margin-bottom: 30px;">
                   <a href="https://retirobartimeo.org" style="background-color: #ab2a3e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 30px; font-size: 18px; font-weight: bold; display: inline-block;">Ingresar al Reto</a>
                 </div>

                 <p style="font-size: 14px; color: #555; background-color: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 5px solid #ab2a3e;">
                   <strong>🛡️ Información:</strong><br>
                   No tienes que usar ${txtSeguridad} para ingresar. No te preocupes: 
                   lo único que se puede hacer con ${txtSeguridad} es <strong>reclamar con mayor seguridad el premio, al finalizar el Reto</strong>.
                 </p>
               </div>
               
               <div style="background-color: #ecf0f1; padding: 15px; text-align: center; font-size: 12px; color: #95a5a6;">
                 Ticket ID: ${registerId} | Generado automáticamente
               </div>
             </div>
           `;

        await transporter.sendMail({
            from: `"Retiro Bartimeo" <${emailUser}>`,
            to: userEmail,
            subject: "🔑 Tu Código de Seguridad - Reto Bartimeo",
            html: htmlMensaje
        });
    }
}
