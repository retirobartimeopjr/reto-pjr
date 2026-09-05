import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import bcrypt from 'bcryptjs';
import { syncBartimeosFromSheets } from '../../../../services/bartimeoSync';
import { paintRowGreenByDocument, paintRowRedByDocument } from '../../../../lib/googleSheets';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, action } = body;

        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Credenciales incompletas' }), { status: 400 });
        }

        const adminRes = await query('SELECT password FROM admins WHERE username = $1', [username]);
        if (adminRes.rowCount === 0) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        const hashedPassword = adminRes.rows[0].password;
        const isValid = await bcrypt.compare(password, hashedPassword);
        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        if (action === 'sync') {
            const syncResult = await syncBartimeosFromSheets(username);
            if (syncResult.status === 'error') {
                return new Response(JSON.stringify({ error: syncResult.error, ...syncResult }), { status: 500 });
            }
            return new Response(JSON.stringify(syncResult), { status: 200 });
        }
        
        else if (action === 'list') {
            const { searchQuery, sortBy } = body;
            
            // Auto-migration for new columns
            try {
                await query('ALTER TABLE bartimeo ADD COLUMN IF NOT EXISTS participacion_confirmada BOOLEAN DEFAULT false;');
                await query('ALTER TABLE bartimeo ADD COLUMN IF NOT EXISTS beca_otorgada VARCHAR(50) DEFAULT \'Ninguna\';');
                await query('ALTER TABLE bartimeo ADD COLUMN IF NOT EXISTS genero_override VARCHAR(20) DEFAULT NULL;');
            } catch (e) {}

            let queryStr = `
                SELECT 
                    b.*,
                    (SELECT COALESCE(SUM(amount), 0) FROM bartimeo_payments WHERE bartimeo_id = b.id) as total_paid,
                    (SELECT row_to_json(c) FROM (SELECT target_person, coordinator_name, contact_method, created_at FROM bartimeo_contacts WHERE bartimeo_id = b.id AND contact_method = 'WhatsApp' ORDER BY created_at DESC LIMIT 1) c) as latest_wp_contact,
                    (SELECT row_to_json(c) FROM (SELECT target_person, coordinator_name, contact_method, created_at FROM bartimeo_contacts WHERE bartimeo_id = b.id AND contact_method = 'Correo' ORDER BY created_at DESC LIMIT 1) c) as latest_email_contact
                FROM bartimeo b
            `;
            const params: any[] = [];
            
            if (searchQuery) {
                queryStr += ` WHERE 
                    nombre_completo ILIKE $1 OR 
                    documento_identidad ILIKE $1 OR 
                    colegio ILIKE $1
                `;
                params.push(`%${searchQuery}%`);
            }
            
            if (sortBy === 'name') {
                queryStr += ` ORDER BY nombre_completo ASC`;
            } else if (sortBy === 'date_desc') {
                queryStr += ` ORDER BY marca_temporal DESC`;
            } else {
                queryStr += ` ORDER BY marca_temporal ASC NULLS LAST`;
            }

            const data = await query(queryStr, params);
            
            // Get last sync status
            const lastSyncRes = await query(`
                SELECT finished_at, status, rows_inserted, rows_updated
                FROM bartimeo_sync_log 
                ORDER BY started_at DESC LIMIT 1
            `);
            const lastSync = lastSyncRes.rowCount > 0 ? lastSyncRes.rows[0] : null;

            return new Response(JSON.stringify({ data: data.rows, lastSync }), { status: 200 });
        }
        
        else if (action === 'details') {
            const { id } = body;
            if (!id) return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400 });
            
            const data = await query(`SELECT * FROM bartimeo WHERE id = $1`, [id]);
            if (data.rowCount === 0) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
            
            return new Response(JSON.stringify(data.rows[0]), { status: 200 });
        }
        
        else if (action === 'update_tracking') {
            const { 
                id, 
                coordi_contactado, 
                acudiente1_contactado, 
                acudiente2_contactado, 
                comentarios, 
                correo_enviado,
                valor_pagado,
                requiere_beca,
                es_candidato,
                participacion_confirmada,
                beca_otorgada,
                genero_override
            } = body;
            if (!id) return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400 });

            const data = await query(`
                UPDATE bartimeo SET
                    coordi_contactado = $1,
                    acudiente1_contactado = $2,
                    acudiente2_contactado = $3,
                    comentarios = $4,
                    correo_enviado = $5,
                    valor_pagado = $6,
                    requiere_beca = $7,
                    es_candidato = $8,
                    participacion_confirmada = $9,
                    beca_otorgada = $10,
                    genero_override = $11
                WHERE id = $12
                RETURNING id
            `, [
                coordi_contactado, 
                Boolean(acudiente1_contactado), 
                Boolean(acudiente2_contactado), 
                comentarios, 
                Boolean(correo_enviado),
                valor_pagado ? parseInt(valor_pagado) : 0,
                Boolean(requiere_beca),
                Boolean(es_candidato),
                Boolean(participacion_confirmada),
                beca_otorgada || 'Ninguna',
                genero_override || null,
                id
            ]);
            
            if (data.rowCount === 0) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
            
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        else if (action === 'send_acceptance_email') {
            const { id, gender, isTestMode } = body; // gender: 'chico' | 'chica'
            if (!id || !gender) return new Response(JSON.stringify({ error: 'Faltan datos requeridos' }), { status: 400 });

            const emailUser = import.meta.env.EMAIL_USER || process.env.EMAIL_USER;
            const emailPass = import.meta.env.EMAIL_PASS || process.env.EMAIL_PASS;
            if (!emailUser || !emailPass) return new Response(JSON.stringify({ error: 'Credenciales SMTP no configuradas' }), { status: 500 });

            const data = await query(`SELECT nombre_completo, acudiente1_email, acudiente2_email FROM bartimeo WHERE id = $1`, [id]);
            if (data.rowCount === 0) return new Response(JSON.stringify({ error: 'Inscrito no encontrado' }), { status: 404 });

            const p = data.rows[0];
            const name = p.nombre_completo;
            const firstName = name ? name.split(' ')[0] : 'tu hijo/a';
            const wordSon = gender === 'chica' ? 'hija' : 'hijo';
            const wordThe = gender === 'chica' ? 'la' : 'el';
            
            let toEmails = [];
            if (isTestMode) {
                toEmails = ['jedatrasfu@gmail.com'];
            } else {
                if (p.acudiente1_email) toEmails.push(p.acudiente1_email.trim());
                if (p.acudiente2_email) toEmails.push(p.acudiente2_email.trim());
                toEmails = toEmails.filter(e => e.includes('@')); // basic validation
                if (toEmails.length === 0) {
                    return new Response(JSON.stringify({ error: 'No hay correos de acudientes registrados válidos' }), { status: 400 });
                }
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: emailUser, pass: emailPass }
            });

            const configRes = await query("SELECT value FROM app_config WHERE key = 'payment_deadline_date'");
            const paymentDeadlineDate = configRes.rowCount > 0 ? String(configRes.rows[0].value).replace(/['"]+/g, '') : '4 DE SEPTIEMBRE';

            const htmlMessage = `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.5; max-width: 800px;">
                    <p>Queridos Padres:</p>
                    <p>¡Reciban un cordial saludo!</p>
                    <p>Nos alegra mucho compartirles que su ${wordSon} <strong>${name}</strong> ha sido aceptada para <strong>participar en el V Retiro Bartimeo</strong>🎉</p>
                    <p>📌 Si aún no han enviado los documentos (tarjeta de identidad y certificado de EPS) les solicitamos remitirlos lo antes posible al correo: 📩 <a href="mailto:retiro.bartimeo.pjr@gmail.com">retiro.bartimeo.pjr@gmail.com</a>.</p>
                    <p>💰 <strong>Valor de la inversión: $500.000 por persona.</strong><br/>
                    Puedes realizar el pago a la cuenta indicada en la imagen adjunta o con los siguientes datos:<br/>
                    <strong>Banco Caja Social</strong><br/>
                    <strong>Cuenta de ahorros No. 24117167427</strong><br/>
                    <strong>Parroquia Jesucristo Redentor</strong><br/>
                    <strong>Nit. 830023101-6</strong></p>
                    <p>Te pedimos el favor de realizar el pago correspondiente a tu ${wordSon} lo antes posible y enviar el comprobante a este mismo correo o por WhatsApp a los siguientes números: 📱 300 331 1251 – 318 200 4659 - 3123415728.</p>
                    <p style="color: #d32f2f; font-size: 18px;"><strong>¡PLAZO MÁXIMO PARA REALIZAR EL PAGO: ${paymentDeadlineDate}!</strong></p>
                    <p><em>*Si el pago del retiro no se ve reflejado para esta fecha y no se tiene razón alguna, el cupo se le brindará a algún joven de la lista de espera.</em></p>
                    <p>📞 Antes del retiro, uno de los jóvenes servidores se comunicarán con <strong>${firstName}</strong> para brindarle información específica y resolver cualquier duda sobre el desarrollo del retiro.</p>
                    <p>🔐 <strong>IMPORTANTE:</strong> Esta información es de carácter personal y solo es válida para quien la recibe. Esto responde a los requisitos propios del retiro, con el fin de mantener un equilibrio entre las edades y el número de chicos y chicas.</p>
                    <ul>
                        <li><strong>Si en el formulario, te hizo falta especificar alguna situación de salud, ya sea física o psicológica, de quién participará en el Retiro, por favor comunicarse al siguiente número: <span style="color: #d32f2f;">3182004659 - 3003311251 - 3123415728</span> Esta información es CONFIDENCIAL, y se solicita con el fin de proteger y custodiar correctamente a tu ${wordSon}.</strong></li>
                    </ul>
                    <p>Gracias por confiar en el equipo Bartimeo. Estamos muy emocionados de vivir este retiro junto a <strong>${firstName}</strong> y quedamos atentos a cualquier inquietud que tengan.</p>
                    <p>Con cariño,<br/><strong>Coordinadores del Retiro Bartimeo</strong><br/><strong>Alejandra, Nicolás y Jesús</strong></p>
                    
                    <div style="margin-top: 20px;">
                        <img src="cid:pago_retiro" alt="Información de Pago" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
                    </div>
                </div>
            `;

            // En gender validation, check if it should say "aceptado" or "aceptada". I hardcoded 'aceptada', let's fix it:
            const acceptadoText = gender === 'chica' ? 'aceptada' : 'aceptado';
            const fixedHtmlMessage = htmlMessage.replace('ha sido aceptada', `ha sido ${acceptadoText}`);

            const mailOptions = {
                from: `"CUENTA BARTIMEO COLOMBIA" <${emailUser}>`,
                to: toEmails.join(', '),
                subject: `[Confirmación] Participación de ${name} en el V Retiro Bartimeo PJR`,
                html: fixedHtmlMessage,
                attachments: [
                    {
                        filename: 'INFO_PAGO_RETIRO.png',
                        path: path.join(process.cwd(), 'public', 'INFO_PAGO_RETIRO.png'),
                        cid: 'pago_retiro' // same cid value as in the html img src
                    }
                ]
            };

            await transporter.sendMail(mailOptions);

            // Update DB if sent successfully and not in test mode
            if (!isTestMode) {
                await query(`UPDATE bartimeo SET correo_enviado = true WHERE id = $1`, [id]);
            }

            return new Response(JSON.stringify({ success: true, to: toEmails }), { status: 200 });
        }

        else if (action === 'get_contacts') {
            const { id } = body;
            const res = await query('SELECT * FROM bartimeo_contacts WHERE bartimeo_id = $1 ORDER BY created_at DESC', [id]);
            return new Response(JSON.stringify(res.rows), { status: 200 });
        }
        else if (action === 'add_contact') {
            const { id, targetPerson, coordinatorName, contactMethod } = body;
            await query(`
                INSERT INTO bartimeo_contacts (bartimeo_id, target_person, coordinator_name, contact_method)
                VALUES ($1, $2, $3, $4)
            `, [id, targetPerson, coordinatorName, contactMethod]);
            
            // Legacy fallbacks for whatsapp
            if (contactMethod === 'WhatsApp') {
                if (targetPerson === 'Acudiente 1') await query(`UPDATE bartimeo SET acudiente1_contactado = true WHERE id = $1`, [id]);
                if (targetPerson === 'Acudiente 2') await query(`UPDATE bartimeo SET acudiente2_contactado = true WHERE id = $1`, [id]);
            }
            
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        else if (action === 'get_payments') {
            const { id } = body;
            const res = await query('SELECT * FROM bartimeo_payments WHERE bartimeo_id = $1 ORDER BY created_at DESC', [id]);
            return new Response(JSON.stringify(res.rows), { status: 200 });
        }
        else if (action === 'add_payment') {
            const { id, amount, paymentMethod, receiptUrl } = body;
            await query(`
                INSERT INTO bartimeo_payments (bartimeo_id, amount, payment_method, receipt_url)
                VALUES ($1, $2, $3, $4)
            `, [id, amount, paymentMethod, receiptUrl]);
            
            // Automatically confirm participation
            await query('UPDATE bartimeo SET participacion_confirmada = true WHERE id = $1', [id]);

            // Check if total is >= 500000
            try {
                const totalRes = await query(`
                    SELECT SUM(bp.amount) as total_paid, MAX(b.documento_identidad) as documento_identidad, MAX(b.nombre_completo) as nombre_completo
                    FROM bartimeo_payments bp
                    JOIN bartimeo b ON b.id = bp.bartimeo_id
                    WHERE bp.bartimeo_id = $1
                `, [id]);
                
                if (totalRes.rows.length > 0) {
                    const totalPaid = parseInt(totalRes.rows[0].total_paid || 0);
                    const documento = totalRes.rows[0].documento_identidad;
                    const nombre = totalRes.rows[0].nombre_completo;
                    
                    if (totalPaid > 0 && documento) {
                        await paintRowGreenByDocument(documento, nombre);
                    }
                }
            } catch (err) {
                console.error("Error al intentar pintar la fila en verde por documento:", err);
            }

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        else if (action === 'toggle_respuesta') {
            const { id, status } = body;
            // Add column if it doesn't exist, ignore error if it does
            try {
                await query('ALTER TABLE bartimeo ADD COLUMN IF NOT EXISTS respuesta_recibida BOOLEAN DEFAULT false;');
            } catch (e) {}
            await query(`UPDATE bartimeo SET respuesta_recibida = $1 WHERE id = $2`, [status, id]);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        } else if (action === 'cancel_attendance') {
            const { id } = body;
            
            // 1. Marcar en la base de datos (es_candidato = false, row_color rojo) y recuperar el documento
            const resUpdate = await query(`
                UPDATE bartimeo 
                SET es_candidato = false, row_color = '#ff0000'
                WHERE id = $1
                RETURNING documento_identidad
            `, [id]);
            
            if (resUpdate.rows.length === 0) {
                return new Response(JSON.stringify({ error: 'Inscrito no encontrado' }), { status: 404 });
            }
            
            const documento = resUpdate.rows[0].documento_identidad;
            
            // 2. Pintar en rojo en Google Sheets
            if (documento) {
                try {
                    await paintRowRedByDocument(documento);
                } catch (err) {
                    console.error("Error al pintar fila de rojo:", err);
                }
            }
            
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Acción inválida' }), { status: 400 });

    } catch (error: any) {
        console.error("Error en coordi/bartimeo API:", error);
        return new Response(JSON.stringify({ error: 'Error procesando solicitud' }), { status: 500 });
    }
};
