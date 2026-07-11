import fs from 'fs/promises';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

// Lee el password de las variables de entorno, o usa una por defecto si estás probando
const dbPassword = process.env.DB_PASSWORD;

if (!dbPassword) {
    console.error("⚠️ ERROR: Debes proporcionar la contraseña de la base de datos.");
    console.error("Ejecuta el script así: DB_PASSWORD=tu_contraseña node migrate.js");
    process.exit(1);
}

// Eliminamos el string de conexión para evitar errores con caracteres especiales en la URL
// Función para parsear fechas raras de Firebase (_seconds y _nanoseconds)
function parseTimestamp(ts) {
    if (!ts) return null;
    if (ts._seconds) return new Date(ts._seconds * 1000);
    return null;
}

// Función para parsear fechas normales en string
function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d;
}

async function run() {
    const client = new Client({
        user: 'postgres',
        password: dbPassword,
        host: 'localhost',
        port: 5432,
        database: 'bartimeodb',
        ssl: {
            rejectUnauthorized: false
        }
    });
    try {
        await client.connect();
        console.log("✅ Conectado a PostgreSQL (AWS RDS) a través del Túnel!");

        const dataDir = path.join(process.cwd(), 'exports');

        // Leer JSONs
        console.log("📂 Leyendo archivos JSON...");
        const users = JSON.parse(await fs.readFile(path.join(dataDir, 'user.json'), 'utf8'));
        const parroquias = JSON.parse(await fs.readFile(path.join(dataDir, 'parroquias.json'), 'utf8'));
        const preguntas = JSON.parse(await fs.readFile(path.join(dataDir, 'pregunta.json'), 'utf8'));
        const tickets = JSON.parse(await fs.readFile(path.join(dataDir, 'tickets.json'), 'utf8'));
        const visits = JSON.parse(await fs.readFile(path.join(dataDir, 'visit.json'), 'utf8'));
        const answers = JSON.parse(await fs.readFile(path.join(dataDir, 'respuesta.json'), 'utf8'));

        // ===============================================
        // 1. MIGRACIÓN DE USUARIOS
        // ===============================================
        console.log(`\n🚀 Migrando ${users.length} usuarios...`);
        for (const u of users) {
            await client.query(`
                INSERT INTO users (id, phone, username, cedula, email, referencia, referidos, last_trivia_date, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
            `, [
                u.id, 
                u.phone || null, 
                u.username || null, 
                u.cedula || null, 
                u.email || null, 
                u.referencia || null, 
                parseInt(u.referidos) || 0, 
                parseDate(u.lastTriviaDate), 
                parseTimestamp(u.createdAt) || new Date()
            ]);
        }
        console.log("✅ Usuarios migrados.");
        
        // ===============================================
        // 2. MIGRACIÓN DE PARROQUIAS
        // ===============================================
        console.log(`🚀 Migrando ${parroquias.length} parroquias...`);
        for (const p of parroquias) {
            let lat = null, lng = null;
            if (p.location && p.location.includes(',')) {
                const parts = p.location.split(',');
                lat = parseFloat(parts[0].trim());
                lng = parseFloat(parts[1].trim());
            }
            await client.query(`
                INSERT INTO parroquias (id, code, name, vicaria, arcipestre, latitude, longitude, reward, foto, horarios, santisimo, radius, euclidean)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO NOTHING
            `, [
                parseInt(p.id),
                p.code || null,
                p.name || 'Sin Nombre',
                p.vicaria || null,
                p.arcipestre || null,
                isNaN(lat) ? null : lat,
                isNaN(lng) ? null : lng,
                parseInt(p.reward) || 0,
                p.foto || null,
                p.horarios || null,
                p.santisimo || null,
                p.radius || null,
                p.euclidean || null
            ]);
        }
        // Sincronizar el contador de IDs (Secuencia)
        await client.query(`SELECT setval('parroquias_id_seq', (SELECT MAX(id) FROM parroquias));`);
        console.log("✅ Parroquias migradas.");

        // ===============================================
        // 3. MIGRACIÓN DE PREGUNTAS (TRIVIA)
        // ===============================================
        console.log(`🚀 Migrando ${preguntas.length} preguntas...`);
        for (const p of preguntas) {
            await client.query(`
                INSERT INTO preguntas (id, tipo, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, dia, mes, hora, reward)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (id) DO NOTHING
            `, [
                parseInt(p.id) || parseInt(p.preguntaid),
                p.tipo || 'multiple',
                p.pregunta || '?',
                p.opcionA || '',
                p.opcionB || '',
                p.opcionC || null,
                p.opcionD || null,
                p.respuestaCorrecta || '',
                parseInt(p.dia) || null,
                parseInt(p.mes) || null,
                parseInt(p.hora) || null,
                parseInt(p.reward) || 0
            ]);
        }
        await client.query(`SELECT setval('preguntas_id_seq', (SELECT MAX(id) FROM preguntas));`);
        console.log("✅ Preguntas migradas.");

        // ===============================================
        // 4. MIGRACIÓN DE TICKETS
        // ===============================================
        console.log(`🚀 Migrando ${tickets.length} tickets (Boletos)...`);
        for (const t of tickets) {
            let userId = t["user-id"] || null;
            // Verificar si el usuario realmente existe en Postgres (para mantener integridad)
            if (userId) {
                const res = await client.query(`SELECT id FROM users WHERE id = $1`, [userId]);
                if (res.rowCount === 0) userId = null; // Si se borró en Firebase, el ticket vuelve a quedar disponible
            }

            await client.query(`
                INSERT INTO tickets (ticket_number, fixed, security, user_id, payed, cleared_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (ticket_number) DO NOTHING
            `, [
                parseInt(t.ticket),
                t.fixed || null,
                t.security || null,
                userId,
                t.payed || null,
                parseTimestamp(t.clearedAt),
                parseTimestamp(t.updatedAt) || new Date()
            ]);
        }
        console.log("✅ Tickets migrados.");

        // ===============================================
        // PREPARAR CACHÉ EN MEMORIA PARA VALIDACIÓN
        // (Evita hacer 10,000 consultas a la base de datos por la red)
        // ===============================================
        const validUsers = new Set(users.map(u => u.id));
        const validParroquias = new Set(parroquias.map(p => parseInt(p.id)));
        const validPreguntas = new Set(preguntas.map(p => parseInt(p.id) || parseInt(p.preguntaid)));

        // ===============================================
        // 5. MIGRACIÓN DE VISITAS (Check-ins)
        // ===============================================
        console.log(`🚀 Migrando ${visits.length} visitas a parroquias...`);
        let visitCount = 0;
        for (const v of visits) {
            try {
                if (validUsers.has(v.userId) && validParroquias.has(parseInt(v.parroquiaid))) {
                    await client.query(`
                        INSERT INTO user_parroquia_visits (id, user_id, parroquia_id, points_awarded, photo_url, visited_at)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (id) DO NOTHING
                    `, [
                        v.id,
                        v.userId,
                        parseInt(v.parroquiaid),
                        parseInt(v.pointsAwarded) || 0,
                        v.photoUrl || null,
                        parseTimestamp(v.timestamp) || new Date()
                    ]);
                    visitCount++;
                }
            } catch (err) {
                // Ignorar visitas duplicadas silenciosamente
            }
        }
        console.log(`✅ ${visitCount} visitas válidas migradas.`);

        // ===============================================
        // 6. MIGRACIÓN DE RESPUESTAS (Trivia)
        // ===============================================
        console.log(`🚀 Migrando ${answers.length} respuestas de trivia...`);
        let answerCount = 0;
        for (const a of answers) {
            try {
                if (validUsers.has(a.userId) && validPreguntas.has(parseInt(a.preguntaid))) {
                    await client.query(`
                        INSERT INTO user_trivia_answers (id, user_id, pregunta_id, respuesta_enviada, is_correct, snapshot_reward, answered_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (id) DO NOTHING
                    `, [
                        a.id,
                        a.userId,
                        parseInt(a.preguntaid),
                        a.respuesta || null,
                        a.correcta === true,
                        parseInt(a.snapshotReward) || 0,
                        parseTimestamp(a.timestamp) || new Date()
                    ]);
                    answerCount++;
                }
            } catch (err) {
                // Ignorar respuestas duplicadas
            }
        }
        console.log(`✅ ${answerCount} respuestas válidas migradas.`);

        console.log("\n🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO! 🎉");
        console.log("Abre DBeaver y revisa la vista 'user_stats' para ver la magia en acción.");

    } catch (e) {
        console.error("❌ Error CRÍTICO durante la migración:", e);
    } finally {
        await client.end();
    }
}

run();
