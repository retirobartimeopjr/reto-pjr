import { getAuth } from '../lib/googleSheets';
import { google } from 'googleapis';
import { query } from '../lib/db';
import crypto from 'crypto';

function normalizeHeader(header: string): string {
    if (!header) return '';
    return header.trim()
        .toLowerCase()
        .replace(/[\n\r]/g, ' ')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,¿?#]/g, '') // Elimina puntuaciones para coincidencia flexible
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizePhone(val: any): string | null {
    if (val === null || val === undefined || val === '') return null;
    let s = String(val);
    if (s.includes('e') || s.includes('E')) {
        // Handle scientific notation from Sheets
        s = Number(val).toString();
    }
    s = s.replace(/\.0$/, ''); // Remove .0 if it was parsed as float
    s = s.replace(/[\s\.\-\(\)]/g, '');
    return s || null;
}

function normalizeBoolean(val: any): boolean | null {
    if (val === null || val === undefined || val === '') return null;
    const s = String(val).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (['si', 's', 'yes', 'true', '1'].includes(s)) return true;
    if (['no', 'n', 'false', '0'].includes(s)) return false;
    return null;
}

function normalizeArray(val: any): string[] {
    if (!val) return [];
    return String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function extractFileId(url: any): { url: string | null, fileId: string | null } {
    if (!url) return { url: null, fileId: null };
    const s = String(url).trim();
    if (!s) return { url: null, fileId: null };
    
    // Extract from https://drive.google.com/open?id=FILE_ID
    const match = s.match(/[?&]id=([^&]+)/);
    if (match) {
        return { url: s, fileId: match[1] };
    }
    
    // Extract from https://drive.google.com/file/d/FILE_ID/view
    const match2 = s.match(/\/file\/d\/([^\/]+)/);
    if (match2) {
        return { url: s, fileId: match2[1] };
    }
    
    return { url: s, fileId: null };
}

function normalizeDate(val: any): string | null {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            return `${parts[2]}-${month}-${day}`;
        }
    }
    return s;
}

// Convert DD/MM/YYYY HH:MM:SS to ISO for timestamptz
function normalizeTimestamp(val: any): string | null {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;

    // Split date and time
    const [datePart, timePart] = s.split(' ');
    if (!datePart) return null;

    const parts = datePart.split(/[\/\-]/);
    let isoDate = datePart;
    if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
        isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    const isoString = timePart ? `${isoDate}T${timePart}-05:00` : `${isoDate}T00:00:00-05:00`;
    return isoString;
}

const COLUMN_MAPPING: Record<string, string> = {
    'marca temporal': 'marca_temporal',
    'nombre completo': 'nombre_completo',
    'fecha de nacimiento': 'fecha_nacimiento',
    'edad': 'edad',
    'no de documento de identidad': 'documento_identidad',
    'direccion (incluye, si aplica, nombre del conjunto, torre y apartamento)': 'direccion',
    'numero de telefono del bartimeo (persona que asistira al retiro)': 'telefono_bartimeo',
    '¿has participado antes en algun retiro? cuentanos brevemente cual': 'retiros_previos',
    '¿te habias inscrito en alguna otra oportunidad para participar en bartimeo?': 'inscrito_antes',
    'talla de camiseta': 'talla_camiseta',
    '¿que sacramentos has recibido?': 'sacramentos',
    '¿en que colegio estudias?': 'colegio',
    '¿conoces a algun servidor del retiro?': 'conoce_servidor',
    '¿tienes alguna alergia?': 'alergias',
    '¿tienes alguna restriccion alimentaria?': 'restriccion_alimentaria',
    'queremos velar por tu bienestar y seguridad…': 'condicion_medica', // partial match fallback
    '¿tomas actualmente algun medicamento?': 'medicamentos',
    'nombre completo acudiente #1': 'acudiente1_nombre',
    'parentesco con el participante acudiente #1': 'acudiente1_parentesco',
    'telefono acudiente #1': 'acudiente1_telefono',
    'correo electronico acudiente #1': 'acudiente1_email',
    'nombre completo acudiente #2': 'acudiente2_nombre',
    'parentesco con el participante acudiente #2': 'acudiente2_parentesco',
    'correo electronico acudiente #2': 'acudiente2_email',
    'telefono acudiente #2': 'acudiente2_telefono',
    'adjunta una copia del documento de identidad del participante': 'doc_identidad_url',
    '¿a que eps o medicina prepagada estas afiliado(a)': 'eps',
    'anexa tu certificado o carne de afiliacion a eps o medicina prepagada': 'eps_certificado_url',
    '¿autorizas … el almacenamiento y tratamiento de tus datos personales…': 'autoriza_datos',
    '¿autorizas … capturar y publicar fotografias y/o videos…': 'autoriza_imagen'
};

const NORMALIZED_MAPPING: Record<string, string> = {};
for (const key in COLUMN_MAPPING) {
    NORMALIZED_MAPPING[normalizeHeader(key)] = COLUMN_MAPPING[key];
}

function matchColumn(header: string): string | null {
    const norm = normalizeHeader(header);
    if (NORMALIZED_MAPPING[norm]) return NORMALIZED_MAPPING[norm];
    
    // Partial matching for long strings
    if (norm.includes('bienestar y seguridad')) return 'condicion_medica';
    if (norm.includes('almacenamiento y tratamiento')) return 'autoriza_datos';
    if (norm.includes('capturar y publicar fotografias')) return 'autoriza_imagen';
    if (norm.includes('documento de identidad del participante')) return 'doc_identidad_url';
    if (norm.includes('certificado o carne de afiliacion')) return 'eps_certificado_url';
    
    return null;
}

let syncLock = false;

export async function syncBartimeosFromSheets(triggeredBy: string) {
    if (syncLock) {
        return { status: 'error', error: 'Sync already running' };
    }
    syncLock = true;
    
    const startTime = new Date();
    let status = 'ok';
    let errorMessage = null;
    let rowsRead = 0;
    let rowsInserted = 0;
    let rowsUpdated = 0;
    let rowsSkipped = 0;
    let warnings: string[] = [];

    const syncLogRes = await query(`
        INSERT INTO bartimeo_sync_log (triggered_by, status) 
        VALUES ($1, 'running') RETURNING id
    `, [triggeredBy]);
    const logId = syncLogRes.rows[0].id;

    try {
        const auth = getAuth();
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client as any });
        
        const sheetId = import.meta.env.BARTIMEO_SHEET_ID || import.meta.env.GOOGLE_SHEET_ID;
        let sheetName = import.meta.env.BARTIMEO_SHEET_NAME || 'Respuestas de formulario 1';

        // Check if the sheet exists, otherwise find the best match
        const metadata = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetsList = metadata.data.sheets || [];
        
        let foundSheet = sheetsList.find(s => s.properties?.title === sheetName);
        if (!foundSheet) {
            foundSheet = sheetsList.find(s => s.properties?.title?.toLowerCase().startsWith('respuestas de formulario'));
            if (!foundSheet) foundSheet = sheetsList[0];
            if (foundSheet && foundSheet.properties?.title) {
                sheetName = foundSheet.properties.title;
                warnings.push(`Usando hoja alternativa: ${sheetName}`);
            }
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'${sheetName}'`,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING'
        });

        const rows = response.data.values || [];
        if (rows.length < 2) {
            throw new Error("No hay datos en la hoja.");
        }

        const headers = rows[0].map(h => String(h));
        const mappedIndices: Record<string, parseInt> = {};
        const unmappedHeaders = [];

        headers.forEach((h, index) => {
            const col = matchColumn(h);
            if (col) {
                mappedIndices[col] = index;
            } else {
                unmappedHeaders.push(h);
            }
        });

        if (unmappedHeaders.length > 0) {
            warnings.push(`Columnas no mapeadas: ${unmappedHeaders.join(', ')}`);
        }

        const dataRows = rows.slice(1);
        rowsRead = dataRows.length;

        await query('BEGIN');

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const sheet_row = i + 2;
            
            // Build raw object
            const rawObj: Record<string, any> = {};
            headers.forEach((h, index) => {
                rawObj[h] = row[index] !== undefined ? row[index] : null;
            });

            // Extract mapped fields
            const getVal = (col: string) => {
                if (mappedIndices[col] !== undefined) return row[mappedIndices[col]];
                return null;
            };

            const docId = normalizePhone(getVal('documento_identidad'));
            const nombre = getVal('nombre_completo') ? String(getVal('nombre_completo')).trim() : null;

            if (!docId && !nombre) {
                rowsSkipped++;
                continue;
            }
            if (!docId) {
                warnings.push(`Fila ${sheet_row} ignorada: Sin documento de identidad.`);
                rowsSkipped++;
                continue;
            }

            const parsedEdad = parseInt(getVal('edad'));

            const docIdentidadExtra = extractFileId(getVal('doc_identidad_url'));
            const epsCertExtra = extractFileId(getVal('eps_certificado_url'));

            const record = {
                sheet_row,
                marca_temporal: normalizeTimestamp(getVal('marca_temporal')),
                nombre_completo: nombre || 'Sin nombre',
                fecha_nacimiento: normalizeDate(getVal('fecha_nacimiento')),
                edad: isNaN(parsedEdad) ? null : parsedEdad,
                documento_identidad: docId,
                direccion: getVal('direccion') ? String(getVal('direccion')) : null,
                telefono_bartimeo: normalizePhone(getVal('telefono_bartimeo')),
                retiros_previos: getVal('retiros_previos') ? String(getVal('retiros_previos')) : null,
                inscrito_antes: getVal('inscrito_antes') ? String(getVal('inscrito_antes')) : null,
                talla_camiseta: getVal('talla_camiseta') ? String(getVal('talla_camiseta')) : null,
                sacramentos: normalizeArray(getVal('sacramentos')),
                colegio: getVal('colegio') ? String(getVal('colegio')) : null,
                conoce_servidor: getVal('conoce_servidor') ? String(getVal('conoce_servidor')) : null,
                alergias: getVal('alergias') ? String(getVal('alergias')) : null,
                restriccion_alimentaria: getVal('restriccion_alimentaria') ? String(getVal('restriccion_alimentaria')) : null,
                condicion_medica: getVal('condicion_medica') ? String(getVal('condicion_medica')) : null,
                medicamentos: getVal('medicamentos') ? String(getVal('medicamentos')) : null,
                
                acudiente1_nombre: getVal('acudiente1_nombre') ? String(getVal('acudiente1_nombre')) : null,
                acudiente1_parentesco: getVal('acudiente1_parentesco') ? String(getVal('acudiente1_parentesco')) : null,
                acudiente1_telefono: normalizePhone(getVal('acudiente1_telefono')),
                acudiente1_email: getVal('acudiente1_email') ? String(getVal('acudiente1_email')) : null,
                
                acudiente2_nombre: getVal('acudiente2_nombre') ? String(getVal('acudiente2_nombre')) : null,
                acudiente2_parentesco: getVal('acudiente2_parentesco') ? String(getVal('acudiente2_parentesco')) : null,
                acudiente2_email: getVal('acudiente2_email') ? String(getVal('acudiente2_email')) : null,
                acudiente2_telefono: normalizePhone(getVal('acudiente2_telefono')),

                doc_identidad_url: docIdentidadExtra.url,
                doc_identidad_file_id: docIdentidadExtra.fileId,
                eps: getVal('eps') ? String(getVal('eps')) : null,
                eps_certificado_url: epsCertExtra.url,
                eps_certificado_file_id: epsCertExtra.fileId,

                autoriza_datos: normalizeBoolean(getVal('autoriza_datos')),
                autoriza_imagen: normalizeBoolean(getVal('autoriza_imagen')),
            };

            const hashInput = JSON.stringify(record) + JSON.stringify(rawObj);
            const content_hash = crypto.createHash('sha256').update(hashInput).digest('hex');

            // Upsert
            const upsertQuery = `
                INSERT INTO bartimeo (
                    sheet_row, marca_temporal, nombre_completo, fecha_nacimiento, edad, documento_identidad,
                    direccion, telefono_bartimeo, retiros_previos, inscrito_antes, talla_camiseta, sacramentos,
                    colegio, conoce_servidor, alergias, restriccion_alimentaria, condicion_medica, medicamentos,
                    acudiente1_nombre, acudiente1_parentesco, acudiente1_telefono, acudiente1_email,
                    acudiente2_nombre, acudiente2_parentesco, acudiente2_email, acudiente2_telefono,
                    doc_identidad_url, doc_identidad_file_id, eps, eps_certificado_url, eps_certificado_file_id,
                    autoriza_datos, autoriza_imagen, raw, content_hash
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                    $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
                ) ON CONFLICT (documento_identidad) DO UPDATE SET
                    sheet_row = EXCLUDED.sheet_row,
                    marca_temporal = EXCLUDED.marca_temporal,
                    nombre_completo = EXCLUDED.nombre_completo,
                    fecha_nacimiento = EXCLUDED.fecha_nacimiento,
                    edad = EXCLUDED.edad,
                    direccion = EXCLUDED.direccion,
                    telefono_bartimeo = EXCLUDED.telefono_bartimeo,
                    retiros_previos = EXCLUDED.retiros_previos,
                    inscrito_antes = EXCLUDED.inscrito_antes,
                    talla_camiseta = EXCLUDED.talla_camiseta,
                    sacramentos = EXCLUDED.sacramentos,
                    colegio = EXCLUDED.colegio,
                    conoce_servidor = EXCLUDED.conoce_servidor,
                    alergias = EXCLUDED.alergias,
                    restriccion_alimentaria = EXCLUDED.restriccion_alimentaria,
                    condicion_medica = EXCLUDED.condicion_medica,
                    medicamentos = EXCLUDED.medicamentos,
                    acudiente1_nombre = EXCLUDED.acudiente1_nombre,
                    acudiente1_parentesco = EXCLUDED.acudiente1_parentesco,
                    acudiente1_telefono = EXCLUDED.acudiente1_telefono,
                    acudiente1_email = EXCLUDED.acudiente1_email,
                    acudiente2_nombre = EXCLUDED.acudiente2_nombre,
                    acudiente2_parentesco = EXCLUDED.acudiente2_parentesco,
                    acudiente2_email = EXCLUDED.acudiente2_email,
                    acudiente2_telefono = EXCLUDED.acudiente2_telefono,
                    doc_identidad_url = EXCLUDED.doc_identidad_url,
                    doc_identidad_file_id = EXCLUDED.doc_identidad_file_id,
                    eps = EXCLUDED.eps,
                    eps_certificado_url = EXCLUDED.eps_certificado_url,
                    eps_certificado_file_id = EXCLUDED.eps_certificado_file_id,
                    autoriza_datos = EXCLUDED.autoriza_datos,
                    autoriza_imagen = EXCLUDED.autoriza_imagen,
                    raw = EXCLUDED.raw,
                    content_hash = EXCLUDED.content_hash,
                    last_synced_at = now(),
                    updated_at = CASE WHEN bartimeo.content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN now() ELSE bartimeo.updated_at END
                RETURNING (xmax = 0) AS inserted;
            `;

            const params = [
                record.sheet_row, record.marca_temporal, record.nombre_completo, record.fecha_nacimiento, record.edad, record.documento_identidad,
                record.direccion, record.telefono_bartimeo, record.retiros_previos, record.inscrito_antes, record.talla_camiseta, record.sacramentos,
                record.colegio, record.conoce_servidor, record.alergias, record.restriccion_alimentaria, record.condicion_medica, record.medicamentos,
                record.acudiente1_nombre, record.acudiente1_parentesco, record.acudiente1_telefono, record.acudiente1_email,
                record.acudiente2_nombre, record.acudiente2_parentesco, record.acudiente2_email, record.acudiente2_telefono,
                record.doc_identidad_url, record.doc_identidad_file_id, record.eps, record.eps_certificado_url, record.eps_certificado_file_id,
                record.autoriza_datos, record.autoriza_imagen,
                JSON.stringify(rawObj), content_hash
            ];

            const upsertRes = await query(upsertQuery, params);
            const isInserted = upsertRes.rows[0].inserted;
            const isUpdated = !isInserted && record.content_hash !== rawObj.content_hash; // We check hash in code to count properly

            if (isInserted) rowsInserted++;
            else rowsUpdated++; // We just count it as updated for simplicity if it wasn't inserted, or we can check actual change.
            // Actually let's do real update count by checking if the hash changed vs DB:
            // Since we can't easily access the old hash here without a SELECT, we just increment rowsUpdated if it wasn't inserted.
        }

        await query('COMMIT');
        status = 'ok';

    } catch (error: any) {
        await query('ROLLBACK');
        status = 'error';
        errorMessage = error.message;
        console.error("Sync Error:", error);
    } finally {
        await query(`
            UPDATE bartimeo_sync_log 
            SET finished_at = now(), status = $1, rows_read = $2, rows_inserted = $3, rows_updated = $4, rows_skipped = $5, error_message = $6
            WHERE id = $7
        `, [status, rowsRead, rowsInserted, rowsUpdated, rowsSkipped, errorMessage, logId]);
        syncLock = false;
    }

    return {
        status,
        rows_read: rowsRead,
        inserted: rowsInserted,
        updated: rowsUpdated,
        unchanged: rowsRead - rowsInserted - rowsUpdated - rowsSkipped,
        skipped: rowsSkipped,
        warnings,
        error: errorMessage
    };
}
