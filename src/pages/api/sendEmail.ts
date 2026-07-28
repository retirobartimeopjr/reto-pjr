import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, action, to, subject, htmlMessage } = body;

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

        // 2. Configure Nodemailer Transporter
        const emailUser = import.meta.env.EMAIL_USER || process.env.EMAIL_USER;
        const emailPass = import.meta.env.EMAIL_PASS || process.env.EMAIL_PASS;

        if (!emailUser || !emailPass) {
            return new Response(JSON.stringify({ error: 'El servidor no tiene configuradas las credenciales SMTP de Gmail.' }), { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });

        // 3. Determine Recipients
        let recipients: string[] = [];

        if (action === 'broadcast') {
            const usersRes = await query(`SELECT email FROM users WHERE email IS NOT NULL AND email != '' AND is_active = true`);
            recipients = usersRes.rows.map(r => r.email);
            
            if (recipients.length === 0) {
                return new Response(JSON.stringify({ error: 'No hay usuarios con correo registrado para enviar.' }), { status: 404 });
            }
        } else if (action === 'individual') {
            if (!to) {
                return new Response(JSON.stringify({ error: 'Falta el destinatario (to)' }), { status: 400 });
            }
            // Soporte para múltiples correos separados por comas
            recipients = to.split(',').map((email: string) => email.trim()).filter((email: string) => email.length > 0);
        } else {
            return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });
        }

        if (!subject || !htmlMessage) {
            return new Response(JSON.stringify({ error: 'Falta asunto o mensaje' }), { status: 400 });
        }

        // 4. Send Emails (Using BCC for privacy if multiple recipients)
        const isMultiple = recipients.length > 1 || action === 'broadcast';

        const mailOptions = {
            from: `"Retiro Bartimeo" <${emailUser}>`,
            to: isMultiple ? emailUser : recipients[0], // Send to self if multiple, BCC the rest
            bcc: isMultiple ? recipients : undefined,
            subject: subject,
            html: htmlMessage
        };

        const info = await transporter.sendMail(mailOptions);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Correo enviado con éxito a ${recipients.length} destinatario(s)`,
            info: info.messageId 
        }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("❌ Error en sendEmail API:", error);
        return new Response(JSON.stringify({ error: 'Error enviando correo: ' + error.message }), { status: 500 });
    }
};
