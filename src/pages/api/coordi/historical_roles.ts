import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import fs from 'fs';
import path from 'path';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        // Create tables if they don't exist
        await query(`
            CREATE TABLE IF NOT EXISTS retiro_activities (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                jornadas JSONB DEFAULT '[]'::jsonb
            );
            
            CREATE TABLE IF NOT EXISTS v_retiro_assignments (
                id SERIAL PRIMARY KEY,
                server_id INTEGER REFERENCES servidores(id) ON DELETE CASCADE,
                activity_id INTEGER REFERENCES retiro_activities(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(server_id, activity_id)
            );
            
            CREATE TABLE IF NOT EXISTS historical_roles (
                id SERIAL PRIMARY KEY,
                original_name VARCHAR(150) NOT NULL,
                server_id INTEGER REFERENCES servidores(id) ON DELETE SET NULL,
                role_name VARCHAR(100) NOT NULL,
                retreat_num INTEGER NOT NULL,
                UNIQUE(original_name, role_name, retreat_num)
            );
        `);

        if (action === 'get_reconciliation_status') {
            // Get all unique original names and their roles
            const historicalRes = await query(`
                SELECT 
                    original_name,
                    MAX(server_id) as server_id,
                    jsonb_agg(jsonb_build_object('role', role_name, 'retreat', retreat_num)) as participations
                FROM historical_roles 
                GROUP BY original_name
                ORDER BY original_name ASC
            `);
            
            const serversRes = await query("SELECT id, full_name FROM servidores");
            const servers = serversRes.rows;
            const historicals = historicalRes.rows;

            const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

            const results = historicals.map(h => {
                const normOriginal = normalize(h.original_name);
                let status = 'sin_coincidencia'; // 🔴
                const suggestedServers = [];

                if (h.server_id !== null) {
                    status = 'confirmado'; // ✅
                    // We don't need suggestions if it's confirmed, but let's find the confirmed name
                    const confirmedServer = servers.find(s => s.id === h.server_id);
                    if (confirmedServer) {
                        suggestedServers.push({ id: confirmedServer.id, name: confirmedServer.full_name, score: 100, isConfirmed: true });
                    }
                } else {
                    // Try to find suggestions
                    let exactMatchFound = false;

                    for (const s of servers) {
                        const normServer = normalize(s.full_name);
                        
                        // Exact match
                        if (normServer === normOriginal) {
                            suggestedServers.push({ id: s.id, name: s.full_name, score: 100 });
                            exactMatchFound = true;
                            continue;
                        }

                        // Word overlap logic
                        const originalWords = normOriginal.split(/[\s\-\/\:]+/).filter(w => w.length > 2);
                        const serverWords = normServer.split(/\s+/).filter(w => w.length > 2);
                        
                        let sharedWords = 0;
                        for (const ow of originalWords) {
                            if (serverWords.includes(ow)) sharedWords++;
                        }
                        
                        // Calculate a basic score based on shared words
                        let score = 0;
                        if (sharedWords > 0) {
                            score = Math.round((sharedWords / Math.max(originalWords.length, serverWords.length)) * 100);
                        }

                        // High confidence if 2+ words match or if original is fully contained in server
                        if ((normServer.length > 4 && normServer.includes(normOriginal)) || (normOriginal.length > 4 && normOriginal.includes(normServer))) {
                            score = Math.max(score, 85);
                            suggestedServers.push({ id: s.id, name: s.full_name, score });
                        } else if (sharedWords >= 2) {
                            score = Math.max(score, 70);
                            suggestedServers.push({ id: s.id, name: s.full_name, score });
                        } else if (sharedWords === 1 && (serverWords.length === 1 || originalWords.length === 1)) {
                            score = Math.max(score, 50);
                            suggestedServers.push({ id: s.id, name: s.full_name, score });
                        }
                    }

                    // Sort suggestions by score descending
                    suggestedServers.sort((a, b) => b.score - a.score);

                    if (suggestedServers.length > 0) {
                        if (exactMatchFound || (suggestedServers.length === 1 && suggestedServers[0].score >= 85) || (suggestedServers.length > 1 && suggestedServers[0].score >= 90 && suggestedServers[0].score - suggestedServers[1].score > 20)) {
                            status = 'segura'; // 🟢
                        } else {
                            status = 'dudosa'; // 🟡
                        }
                    }
                }

                return {
                    original_name: h.original_name,
                    status,
                    participations: h.participations,
                    suggested_servers: suggestedServers
                };
            });

            return new Response(JSON.stringify({ 
                success: true, 
                data: results
            }), { status: 200 });
        }

        if (action === 'get_activities') {
            const res = await query("SELECT * FROM retiro_activities ORDER BY name ASC");
            return new Response(JSON.stringify({ success: true, data: res.rows }), { status: 200 });
        }
        
        if (action === 'get_assignments') {
            const res = await query("SELECT * FROM v_retiro_assignments");
            return new Response(JSON.stringify({ success: true, data: res.rows }), { status: 200 });
        }
        
        if (action === 'get_historical_summary') {
            // Get all mapped roles grouped by server_id
            const res = await query(`
                SELECT server_id, role_name, retreat_num
                FROM historical_roles
                WHERE server_id IS NOT NULL
                ORDER BY retreat_num ASC
            `);
            return new Response(JSON.stringify({ success: true, data: res.rows }), { status: 200 });
        }

        if (action === 'get_activity_history') {
            const roleName = url.searchParams.get('role_name');
            if (!roleName) return new Response(JSON.stringify({ success: false, error: 'role_name is required' }), { status: 400 });
            
            const res = await query(`
                SELECT h.original_name, s.full_name as server_name, h.retreat_num
                FROM historical_roles h
                LEFT JOIN servidores s ON h.server_id = s.id
                WHERE h.role_name = $1
                ORDER BY h.retreat_num ASC
            `, [roleName]);
            
            return new Response(JSON.stringify({ success: true, data: res.rows }), { status: 200 });
        }

        return new Response(JSON.stringify({ success: false, error: 'Acción GET no válida' }), { status: 400 });
    } catch (error) {
        console.error("Error en historical_roles GET:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), { status: 500 });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'parse_md') {
            const mdPath = path.resolve('./roles_retiro_consolidado.md');
            if (!fs.existsSync(mdPath)) {
                return new Response(JSON.stringify({ success: false, error: 'Archivo .md no encontrado' }), { status: 404 });
            }

            // 1. Resetear las tablas de roles históricos y asignaciones
            await query(`TRUNCATE TABLE historical_roles RESTART IDENTITY CASCADE`);
            await query(`TRUNCATE TABLE v_retiro_assignments RESTART IDENTITY CASCADE`);

            const mdContent = fs.readFileSync(mdPath, 'utf8');
            const lines = mdContent.split('\n');
            
            let currentRole = '';
            let isParsingTable = false;
            let recordsAdded = 0;

            for (let line of lines) {
                line = line.trim();
                
                if (line.startsWith('## ')) {
                    currentRole = line.replace('## ', '').trim();
                    isParsingTable = false;
                    
                    // Auto-crear el servicio predeterminado si no existe
                    try {
                        const checkRes = await query(`SELECT id FROM retiro_activities WHERE name = $1`, [currentRole]);
                        if (checkRes.rows.length === 0) {
                            await query(`INSERT INTO retiro_activities (name, jornadas) VALUES ($1, '[]'::jsonb)`, [currentRole]);
                        }
                    } catch(e) {
                        console.error('Error auto-creating activity', e);
                    }
                    
                } else if (line.startsWith('| Retiro 1 |')) {
                    isParsingTable = true;
                } else if (line.startsWith('|---')) {
                    // separator line, skip
                } else if (isParsingTable && line.startsWith('|')) {
                    const columns = line.split('|').map(col => col.trim()).filter((col, index, arr) => index > 0 && index < arr.length - 1);
                    
                    if (columns.length === 4) {
                        for (let i = 0; i < 4; i++) {
                            let name = columns[i];
                            if (name && name !== '-' && name !== '—') {
                                // Clean up name
                                name = name.replace(/\\*\\*/g, ''); // remove bold markdown
                                
                                const retreatNum = i + 1;
                                
                                // Insert without auto-mapping (server_id = NULL)
                                
                                try {
                                    await query(`
                                        INSERT INTO historical_roles (original_name, server_id, role_name, retreat_num)
                                        VALUES ($1, $2, $3, $4)
                                        ON CONFLICT (original_name, role_name, retreat_num) DO NOTHING
                                    `, [name, null, currentRole, retreatNum]);
                                    recordsAdded++;
                                } catch(e) {
                                    console.error("Error inserting historical role", e);
                                }
                            }
                        }
                    }
                } else if (line === '') {
                    // empty line ends table
                    isParsingTable = false;
                }
            }

            return new Response(JSON.stringify({ success: true, message: `Parseo completado. ${recordsAdded} registros insertados o verificados.` }), { status: 200 });
        }

        if (action === 'map_server') {
            const { original_name, server_id } = body;
            if (!original_name) return new Response(JSON.stringify({ success: false, error: 'original_name requerido' }), { status: 400 });
            
            // Allow unmapping by passing server_id = null
            await query(`
                UPDATE historical_roles 
                SET server_id = $1 
                WHERE original_name = $2
            `, [server_id, original_name]);
            
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        
        if (action === 'create_activity') {
            const { name, jornadas } = body;
            if (!name) return new Response(JSON.stringify({ success: false, error: 'Nombre requerido' }), { status: 400 });
            
            const res = await query(`
                INSERT INTO retiro_activities (name, jornadas) 
                VALUES ($1, $2) RETURNING *
            `, [name, JSON.stringify(jornadas || [])]);
            
            return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
        }
        
        if (action === 'delete_activity') {
            const { id } = body;
            if (!id) return new Response(JSON.stringify({ success: false, error: 'ID requerido' }), { status: 400 });
            
            await query(`DELETE FROM retiro_activities WHERE id = $1`, [id]);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (action === 'assign_server') {
            const { server_id, activity_id } = body;
            if (!server_id || !activity_id) return new Response(JSON.stringify({ success: false, error: 'Faltan parámetros' }), { status: 400 });
            
            try {
                const res = await query(`
                    INSERT INTO v_retiro_assignments (server_id, activity_id) 
                    VALUES ($1, $2) RETURNING *
                `, [server_id, activity_id]);
                return new Response(JSON.stringify({ success: true, data: res.rows[0] }), { status: 200 });
            } catch(e: any) {
                if (e.code === '23505') { // unique violation
                    return new Response(JSON.stringify({ success: false, error: 'Ya está asignado' }), { status: 400 });
                }
                throw e;
            }
        }
        
        if (action === 'unassign_server') {
            const { server_id, activity_id } = body;
            if (!server_id || !activity_id) return new Response(JSON.stringify({ success: false, error: 'Faltan parámetros' }), { status: 400 });
            
            await query(`
                DELETE FROM v_retiro_assignments 
                WHERE server_id = $1 AND activity_id = $2
            `, [server_id, activity_id]);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ success: false, error: 'Acción POST no válida' }), { status: 400 });
    } catch (error) {
        console.error("Error en historical_roles POST:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno del servidor' }), { status: 500 });
    }
};
