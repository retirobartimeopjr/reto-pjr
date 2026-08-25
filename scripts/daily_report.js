import pg from 'pg';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Cargar variables de entorno locales si existen, de lo contrario usará las del sistema (PM2)
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'bartimeodb',
});

async function main() {
    try {
        console.log("Iniciando generación de reporte diario...");

        const today = new Date();
        const cutoffDate = new Date('2026-09-26T00:00:00-05:00');
        if (today >= cutoffDate) {
            console.log("El reto ha finalizado (25 de Septiembre superado). No se enviarán más reportes diarios.");
            return;
        }

        const res = await pool.query(`
            SELECT username, phone, email, calculated_score 
            FROM user_stats 
            ORDER BY calculated_score DESC
        `);

        const participants = res.rows;
        if (participants.length === 0) {
            console.log("No hay participantes para reportar.");
            return;
        }

        let html = `
            <h2>Reporte Diario - V Retiro Bartimeo</h2>
            <p>A continuación se listan los puntajes actualizados al día de hoy:</p>
            <table border="1" cellpadding="8" style="border-collapse: collapse; text-align: left;">
                <tr>
                    <th>Ranking</th>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Puntaje Total</th>
                </tr>
        `;

        participants.forEach((p, index) => {
            html += `
                <tr>
                    <td>#${index + 1}</td>
                    <td>${p.username || 'Sin Nombre'}</td>
                    <td>${p.phone || '-'}</td>
                    <td><b>${p.calculated_score}</b> pts</td>
                </tr>
            `;
        });

        html += `</table><br><p>Generado automáticamente a las 6:00 AM.</p>`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        console.log("Enviando correo a:", process.env.EMAIL_USER);
        await transporter.sendMail({
            from: `"Bartimeo App" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: `📊 Reporte de Puntajes /RETO - ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`,
            html: html
        });

        console.log("Correo enviado exitosamente.");
    } catch (e) {
        console.error("Error ejecutando el cron de reporte diario:", e);
    } finally {
        await pool.end();
    }
}

main();
