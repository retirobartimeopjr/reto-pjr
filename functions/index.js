const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Set explicit region to match database location
setGlobalOptions({ region: "southamerica-east1" });

initializeApp();
const db = getFirestore();

// ==================================================================
// ⏰ CIERRE OFICIAL DE LA COMPETENCIA
// Jueves 19 de Marzo de 2026 — 6:00 PM hora Bogotá (Colombia, UTC-5)
// Equivalente UTC: 2026-03-19T23:00:00Z
// Colombia NO usa horario de verano. UTC-5 es permanente.
// ==================================================================
const CHALLENGE_END_UTC = new Date('2026-03-19T23:00:00Z').getTime();

/**
 * Verifica si la competencia ya ha cerrado.
 * Siempre usa el tiempo del servidor (UTC), nunca el del cliente.
 * @returns {boolean} true si la competencia ya terminó
 */
const isChallengeOver = () => {
    return Date.now() >= CHALLENGE_END_UTC;
};

// --- HELPER FUNCTIONS FOR CSV LOGIC ---

const addToCSV = (csv, value) => {
    const strVal = String(value).trim();
    if (!strVal) return csv || "";
    const items = (csv || "").split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (!items.includes(strVal)) {
        items.push(strVal);
    }
    return items.join(',');
};

const removeFromCSV = (csv, value) => {
    const strVal = String(value).trim();
    if (!csv || !strVal) return csv || "";
    const items = csv.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const filtered = items.filter(item => item !== strVal);
    return filtered.join(',');
};

// ==================================================================
// 1. PROCESAR TICKET REGISTER (onCreate)
// ==================================================================
exports.procesarTicketRegister = onDocumentCreated("ticketregister/{registerId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [procesarTicketRegister] Competencia cerrada. Registro ignorado a las ${new Date().toISOString()}`);
        return null;
    }

    const data = snap.data();
    const ticketId = data.ticketId;
    const phone = data.phone;
    const isPayed = data.payed === "yes" || data.payed === true;

    // Nombre que viene en el formulario (puede ser null o incompleto)
    const inputUsername = data.username;

    console.log(`[REGISTER] Processing Ticket ${ticketId} for Phone ${phone}`);

    // Validation
    const ticketNum = parseInt(ticketId);
    if (isNaN(ticketNum) || ticketNum < 1 || ticketNum > 3000) {
        console.error(`Invalid Ticket ID: ${ticketId}. Must be between 1 and 3000.`);
        await snap.ref.update({ status: "ERROR", error: "Ticket ID out of range" });
        return;
    }
    if (!phone) {
        console.error(`Missing phone number for ticket ${ticketId}`);
        return;
    }

    const ticketRef = db.collection('tickets').doc(String(ticketId));

    try {
        await db.runTransaction(async (transaction) => {
            // A. Check Ticket Master
            const ticketDoc = await transaction.get(ticketRef);
            if (!ticketDoc.exists) {
                throw new Error(`Ticket Master ${ticketId} does not exist in 'tickets' collection.`);
            }

            const ticketData = ticketDoc.data();
            const currentOwner = ticketData['user-id'];

            // SECURITY CHECK: Prevent double assignment
            if (currentOwner) {
                throw new Error(`ALREADY_ASSIGNED: Ticket ${ticketId} is already owned by User ${currentOwner}.`);
            }

            const fixedCode = ticketData.fixed || "UNKNOWN";

            // B. User Logic (Idempotency by Phone)
            const userQuery = db.collection('user').where('phone', '==', String(phone)).limit(1);
            const userQuerySnap = await transaction.get(userQuery);

            let userRef;
            let userData;
            let isNewUser = false;

            // Variable para determinar el nombre final que quedará en el ticketregister
            let finalUsernameForRegister = inputUsername || "Nuevo Usuario";

            if (!userQuerySnap.empty) {
                // El usuario YA EXISTE
                const userDoc = userQuerySnap.docs[0];
                userRef = userDoc.ref;
                userData = userDoc.data();

                if (userData.username) {
                    finalUsernameForRegister = userData.username;
                }
            } else {
                // El usuario es NUEVO
                isNewUser = true;
                userRef = db.collection('user').doc();
                userData = {
                    phone: String(phone),
                    username: finalUsernameForRegister, // Usamos el del input
                    cedula: data.cedula || "",
                    email: data.email || "",
                    "tickets-numbers": "",
                    "tickets-fixed": "",
                    "parroquiasVistitadas": "",
                    "tickets-quantity": 0,
                    "payedtickets": 0,
                    "pendingpay": 0,
                    score: 0
                };
            }

            // C. Calculate New User State
            const currentTicketsStr = userData['tickets-numbers'] || "";
            const currentFixedStr = userData['tickets-fixed'] || "";

            const newTicketsStr = addToCSV(currentTicketsStr, ticketId);
            const newFixedStr = addToCSV(currentFixedStr, fixedCode);

            const newQuantity = (userData['tickets-quantity'] || 0) + 1;
            const newPayedCount = (userData['payedtickets'] || 0) + (isPayed ? 1 : 0);
            const newPendingCount = (userData['pendingpay'] || 0) + (isPayed ? 0 : 1);

            // D. Perform Writes

            // 1. Update Registration Doc (Success)
            transaction.update(snap.ref, {
                userId: userRef.id,
                fixed: fixedCode,
                username: finalUsernameForRegister,
                status: "SUCCESS",
                processedAt: FieldValue.serverTimestamp()
            });

            // 2. Update Ticket Master (LOCK THE TICKET)
            transaction.update(ticketRef, {
                "user-id": userRef.id,
                payed: isPayed ? "yes" : "no",
                updatedAt: FieldValue.serverTimestamp()
            });

            // 3. Update/Set User
            if (isNewUser) {
                transaction.set(userRef, {
                    ...userData,
                    "tickets-numbers": newTicketsStr,
                    "tickets-fixed": newFixedStr,
                    "tickets-quantity": newQuantity,
                    "payedtickets": newPayedCount,
                    "pendingpay": newPendingCount,
                    createdAt: FieldValue.serverTimestamp()
                });
            } else {
                const updates = {
                    "tickets-numbers": newTicketsStr,
                    "tickets-fixed": newFixedStr,
                    "tickets-quantity": newQuantity,
                    "payedtickets": newPayedCount,
                    "pendingpay": newPendingCount,
                    lastUpdated: FieldValue.serverTimestamp()
                };

                if (inputUsername) {
                    updates.username = inputUsername;
                }
                if (data.cedula) {
                    updates.cedula = data.cedula;
                }

                transaction.update(userRef, updates);
            }
        });

        console.log(`[SUCCESS] Ticket ${ticketId} registered successfully.`);

    } catch (error) {
        console.error(`[ERROR] Transaction failed for Ticket ${ticketId}:`, error.message);
        try {
            await snap.ref.update({ status: "REJECTED", error: error.message });
        } catch (e) {
            console.error("Could not update register doc with error status", e);
        }
    }
});


// ==================================================================
// 2. ELIMINAR TICKET REGISTER (onDelete)
// ==================================================================
exports.eliminarTicketRegister = onDocumentDeleted("ticketregister/{registerId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [eliminarTicketRegister] Competencia cerrada. Eliminación ignorada a las ${new Date().toISOString()}`);
        return null;
    }

    const data = snap.data();

    // Skip rollback if it was rejected
    if (data.status === "REJECTED" || data.status === "ERROR") return;

    const ticketId = data.ticketId;
    const userId = data.userId;
    const fixed = data.fixed;
    const isPayed = data.payed === "yes" || data.payed === true;

    console.log(`[DELETE] Rollback Ticket ${ticketId} for User ${userId}`);

    if (!ticketId || !userId) {
        console.error("Missing ticketId or userId in deleted document.");
        return;
    }

    const ticketRef = db.collection('tickets').doc(String(ticketId));
    const userRef = db.collection('user').doc(userId);

    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            // Safety check for owner mismatch
            const ticketCheck = await transaction.get(ticketRef);
            if (ticketCheck.exists && ticketCheck.data()['user-id'] !== userId) {
                console.warn("Ticket owner mismatch inside rollback. Aborting.");
                return;
            }

            if (userDoc.exists) {
                const userData = userDoc.data();

                // Recalculate CSVs
                const newTicketsStr = removeFromCSV(userData['tickets-numbers'], ticketId);
                const newFixedStr = removeFromCSV(userData['tickets-fixed'], fixed);

                // Recalculate Counters (Decrease logic)
                const newQty = Math.max(0, (userData['tickets-quantity'] || 0) - 1);

                let newPayedCount = userData['payedtickets'] || 0;
                let newPendingCount = userData['pendingpay'] || 0;

                if (isPayed) {
                    newPayedCount = Math.max(0, newPayedCount - 1);
                } else {
                    newPendingCount = Math.max(0, newPendingCount - 1);
                }

                transaction.update(userRef, {
                    "tickets-numbers": newTicketsStr,
                    "tickets-fixed": newFixedStr,
                    "tickets-quantity": newQty,
                    "payedtickets": newPayedCount,
                    "pendingpay": newPendingCount,
                    lastRolledBack: FieldValue.serverTimestamp()
                });
            }

            // Clear Master Ticket
            transaction.update(ticketRef, {
                "user-id": null,
                payed: null,
                clearedAt: FieldValue.serverTimestamp()
            });
        });

        console.log(`[SUCCESS] Ticket ${ticketId} rolled back successfully.`);

    } catch (error) {
        console.error(`[ERROR] Rollback failed for Ticket ${ticketId}:`, error);
    }
});


// ==================================================================
// 3. SINCRONIZAR DATOS DE USUARIO + LÓGICA DE REFERIDOS (onUpdate)
// ==================================================================
exports.sincronizarDatosUsuario = onDocumentUpdated("user/{userId}", async (event) => {
    const userId = event.params.userId;

    // Validamos que existan los datos (por si acaso es un borrado parcial, aunque onUpdate implica ambos)
    if (!event.data.before.exists || !event.data.after.exists) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [sincronizarDatosUsuario] Competencia cerrada. Sincronización ignorada a las ${new Date().toISOString()}`);
        return null;
    }

    const before = event.data.before.data();
    const after = event.data.after.data();

    // --- PARTE A: SINCRONIZACIÓN DE DATOS EN TICKETREGISTER ---
    // Usamos Optional Chaining (?.) y valores por defecto para seguridad
    const usernameChanged = (before.username || "") !== (after.username || "");
    const phoneChanged = (before.phone || "") !== (after.phone || "");
    const cedulaChanged = (before.cedula || "") !== (after.cedula || "");

    if (usernameChanged || phoneChanged || cedulaChanged) {
        console.log(`[SYNC] Updating ticket registers for userId: ${userId}`);
        const updates = {};
        if (usernameChanged) updates.username = after.username;
        if (phoneChanged) updates.phone = after.phone;
        if (cedulaChanged) updates.cedula = after.cedula;

        const registersQuery = db.collection('ticketregister').where('userId', '==', userId);

        try {
            const snapshot = await registersQuery.get();
            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.update(doc.ref, updates));
                await batch.commit();
                console.log(`[SYNC] Updated ${snapshot.size} ticket registers.`);
            }
        } catch (error) {
            console.error(`[ERROR] Sync failed:`, error);
        }
    }

    // --- PARTE B: LÓGICA DE REFERIDOS ---

    // 1. Lectura segura de los campos (Manejo de undefined/null)
    const oldReferencia = (before.referencia || "").trim();
    const newReferencia = (after.referencia || "").trim();

    // Solo procesamos si hubo un cambio real
    if (oldReferencia !== newReferencia) {

        // LOOP FIX / REGLA DE ORO:
        // Si ya EXISTÍA una referencia previa (old != ""), 
        // simplemente IGNORAMOS cualquier cambio posterior.
        // No revertimos (para evitar bucles infinitos donde la "mala" se vuelve "old"),
        // ni procesamos puntos de nuevo.
        if (oldReferencia !== "") {
            console.log(`[REFERIDOS] User ${userId} changed referral from ${oldReferencia} to ${newReferencia}. Ignoring (already set).`);
            return;
        }

        // Caso base: Si es un borrado (new == ""), y venimos de empty (por lógica arriba), nada que hacer.
        if (newReferencia === "") return;

        // A PARTIR DE AQUI: Estamos seguros que es una NUEVA ASIGNACIÓN (old == "")
        console.log(`[REFERIDOS] Processing FIRST-TIME referral: ${newReferencia} for user ${userId}`);

        // CONDICIÓN 2: Auto-referencia prohibida
        const userPhone = (after.phone || "").trim();
        if (newReferencia === userPhone) {
            console.warn(`[REFERIDOS] Self-referral attempt. Reverting to empty.`);
            // Al revertir a "", el siguiente trigger tendrá old="SELF", new="", entrará en el 'if(old!=="")' y saldrá. Loop roto.
            return event.data.after.ref.update({ referencia: "" });
        }

        // CONDICIÓN 3: Debe tener al menos 1 ticket pagado
        const payedTickets = after.payedtickets || 0;
        if (payedTickets < 1) {
            console.warn(`[REFERIDOS] User ${userId} has 0 payed tickets. Reverting to empty.`);
            return event.data.after.ref.update({ referencia: "" });
        }

        // CONDICIÓN 4: VALIDAR EXISTENCIA EN LA BD
        try {
            await db.runTransaction(async (transaction) => {
                const padrinoQuery = db.collection('user').where('phone', '==', newReferencia).limit(1);
                const padrinoSnap = await transaction.get(padrinoQuery);

                if (padrinoSnap.empty) {
                    // --- CASO: NO EXISTE EL PADRINO ---
                    console.warn(`[REFERIDOS] Phone ${newReferencia} does NOT exist. Reverting to empty.`);
                    transaction.update(event.data.after.ref, { referencia: "" });
                    return;
                }

                // --- CASO: SÍ EXISTE EL PADRINO ---
                const padrinoDoc = padrinoSnap.docs[0];
                const padrinoRef = padrinoDoc.ref;

                // Sumamos +1 al contador.
                transaction.update(padrinoRef, {
                    referidos: FieldValue.increment(1),
                    score: FieldValue.increment(100) // <--- Esta línea sumaría puntos al total
                });

                console.log(`[REFERIDOS] Success! Verified padrino ${padrinoDoc.id}. Incrementing +1.`);
            });
        } catch (error) {
            console.error(`[ERROR] Referral transaction failed:`, error);
        }
    }
});


// ==================================================================
// 4. PROCESAR VISITA (onCreate) - CORREGIDO
// ==================================================================
exports.procesarVisita = onDocumentCreated("visit/{visitId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [procesarVisita] Competencia cerrada. Visita ignorada a las ${new Date().toISOString()}`);
        return null;
    }

    const data = snap.data();
    const userId = data.userId;
    const parroquiaId = data.parroquiaid;

    if (!userId || !parroquiaId) {
        console.error("Missing userId or parroquiaId in visit document");
        return;
    }

    const parroquiaRef = db.collection('parroquias').doc(String(parroquiaId));
    const userRef = db.collection('user').doc(userId);

    try {
        await db.runTransaction(async (transaction) => {
            // 1. Leer Parroquia y Usuario
            const parroquiaDoc = await transaction.get(parroquiaRef);
            if (!parroquiaDoc.exists) throw new Error(`Parroquia ${parroquiaId} not found.`);

            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error(`User ${userId} not found.`);

            const parroquiaData = parroquiaDoc.data();
            const reward = Number(parroquiaData.reward) || 0;
            const userData = userDoc.data();

            // Verificación CSV
            const visitadasStr = userData.parroquiasVistitadas || "";
            const visitadasArray = visitadasStr.split(',').map(s => s.trim());
            const yaVisitada = visitadasArray.includes(String(parroquiaId));

            // 2. Siempre aumentamos el contador global de la parroquia
            // (Porque hay un documento de visita físico creado)
            transaction.update(parroquiaRef, {
                visits: FieldValue.increment(1)
            });

            // 3. Lógica de Puntos con BANDERA DE SEGURIDAD
            if (!yaVisitada) {
                // ES NUEVA: Sumamos puntos y marcamos el doc como VALIDO
                const newVisitadasStr = addToCSV(visitadasStr, parroquiaId);

                transaction.update(userRef, {
                    score: FieldValue.increment(reward),
                    parroquiasVistitadas: newVisitadasStr
                });

                // *** IMPORTANTE: Marcamos que esta visita SÍ dio puntos ***
                transaction.update(snap.ref, {
                    puntosOtorgados: true,
                    valorOtorgado: reward
                });

                console.log(`[VISIT] User ${userId} First time at ${parroquiaId}. Added ${reward} points.`);
            } else {
                // ES DUPLICADA: No sumamos puntos y marcamos como FALSE
                transaction.update(snap.ref, {
                    puntosOtorgados: false,
                    valorOtorgado: 0
                });
                console.log(`[VISIT] User ${userId} duplicate visit at ${parroquiaId}. No points added.`);
            }
        });

    } catch (error) {
        console.error(`[ERROR] Visit transaction failed for ${parroquiaId}:`, error.message);
    }
});

// ==================================================================
// 5. ELIMINAR VISITA (onDelete) - CORREGIDO
// ==================================================================
exports.eliminarVisita = onDocumentDeleted("visit/{visitId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [eliminarVisita] Competencia cerrada. Eliminación de visita ignorada a las ${new Date().toISOString()}`);
        return null;
    }

    const data = snap.data();
    const userId = data.userId;
    const parroquiaId = data.parroquiaid;

    // LEEMOS LA BANDERA: ¿Esta visita dio puntos originalmente?
    const debioSumarPuntos = data.puntosOtorgados === true;
    // Recuperamos cuánto valía (por si cambiaron el valor en la parroquia después)
    const valorOriginal = Number(data.valorOtorgado) || 0;

    if (!userId || !parroquiaId) {
        console.error("Missing userId or parroquiaId in deleted visit document");
        return;
    }

    console.log(`[DELETE VISIT] Rollback: User ${userId}, Parroquia ${parroquiaId}. ¿Dio Puntos?: ${debioSumarPuntos}`);

    const parroquiaRef = db.collection('parroquias').doc(String(parroquiaId));
    const userRef = db.collection('user').doc(userId);

    try {
        await db.runTransaction(async (transaction) => {
            const parroquiaDoc = await transaction.get(parroquiaRef);
            const userDoc = await transaction.get(userRef);

            // 1. Siempre restamos el conteo global (porque se borró un doc físico)
            if (parroquiaDoc.exists) {
                transaction.update(parroquiaRef, {
                    visits: FieldValue.increment(-1)
                });
            }

            // 2. Solo castigamos al usuario si la visita borrada ERA LEGÍTIMA
            if (debioSumarPuntos && userDoc.exists) {
                const userData = userDoc.data();
                const visitadasStr = userData.parroquiasVistitadas || "";

                // Quitamos del CSV
                const newVisitadasStr = removeFromCSV(visitadasStr, parroquiaId);

                // Determinamos cuántos puntos restar
                let rewardARestar = valorOriginal;

                // Fallback: Si no guardamos valorOtorgado, leemos de la parroquia actual
                if (rewardARestar === 0 && parroquiaDoc.exists) {
                    rewardARestar = Number(parroquiaDoc.data().reward) || 0;
                }

                const updates = {
                    parroquiasVistitadas: newVisitadasStr,
                    score: FieldValue.increment(-rewardARestar)
                };

                transaction.update(userRef, updates);
                console.log(`[ROLLBACK] Se restaron ${rewardARestar} puntos porque se eliminó una visita legítima.`);
            } else {
                console.log(`[ROLLBACK] NO se restaron puntos (era un duplicado o no otorgó puntos).`);
            }
        });

        console.log(`[SUCCESS] Visit rollback completed for ${parroquiaId}`);

    } catch (error) {
        console.error(`[ERROR] Visit rollback failed:`, error);
    }
});


// ==================================================================
// 6. LIMPIAR DATOS DE USUARIO ELIMINADO (onDelete)
//    (Libera Tickets + Resta Referido al Padrino)
// ==================================================================
exports.limpiarUsuarioEliminado = onDocumentDeleted("user/{userId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [limpiarUsuarioEliminado] Competencia cerrada. Limpieza ignorada a las ${new Date().toISOString()}`);
        return null;
    }

    const userData = snap.data();
    const userId = event.params.userId;

    // --- TAREA 1: LIBERAR TICKETS ---
    const ticketsStr = userData['tickets-numbers'];
    if (ticketsStr) {
        const ticketIds = ticketsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (ticketIds.length > 0) {
            console.log(`[USER DELETE] Clearing ${ticketIds.length} tickets for user ${userId}`);
            const chunks = [];
            for (let i = 0; i < ticketIds.length; i += 500) {
                chunks.push(ticketIds.slice(i, i + 500));
            }
            try {
                for (const chunk of chunks) {
                    const batch = db.batch();
                    chunk.forEach(ticketId => {
                        batch.update(db.collection('tickets').doc(String(ticketId)), { "user-id": "", "payed": "" });
                    });
                    await batch.commit();
                }
            } catch (error) {
                console.error(`[ERROR] Failed to clear tickets:`, error);
            }
        }
    }

    // --- TAREA 2: RESTAR REFERIDO (Si tenía uno) ---
    const referenciaPhone = userData.referencia;
    if (referenciaPhone) {
        console.log(`[USER DELETE] User had referral ${referenciaPhone}. Decrementing count.`);
        try {
            const padrinoQuery = await db.collection('user').where('phone', '==', referenciaPhone).limit(1).get();
            if (!padrinoQuery.empty) {
                const padrinoRef = padrinoQuery.docs[0].ref;
                // Usamos decremento atómico
                await padrinoRef.update({
                    referidos: FieldValue.increment(-1)
                });
                console.log(`[SUCCESS] Decremented referral count for padrino.`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to decrement referral:`, error);
        }
    }
});


// ==================================================================
// 7. PROCESAR RESPUESTA (onCreate) - CORREGIDO
// ==================================================================
exports.procesarRespuesta = onDocumentCreated("respuesta/{respuestaId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [procesarRespuesta] Competencia cerrada. Respuesta ignorada a las ${new Date().toISOString()}`);
        return null;
    }

    const data = snap.data();
    const userId = data.userId;
    const preguntaId = data.preguntaid;
    const respuestaUsuario = data.respuesta;

    if (!userId || !preguntaId) {
        console.error("Missing userId or preguntaid");
        return;
    }

    const preguntaRef = db.collection('pregunta').doc(String(preguntaId));
    const userRef = db.collection('user').doc(userId);

    try {
        await db.runTransaction(async (transaction) => {
            // ------------------------------------------------------
            // PASO 1: LECTURAS (TODAS JUNTAS AL PRINCIPIO)
            // ------------------------------------------------------
            const preguntaDoc = await transaction.get(preguntaRef);
            const userDoc = await transaction.get(userRef); // <--- MOVIDO AQUÍ ARRIBA

            // Validaciones de existencia
            if (!preguntaDoc.exists) throw new Error(`Pregunta ${preguntaId} not found.`);
            if (!userDoc.exists) throw new Error(`User ${userId} not found.`);

            // ------------------------------------------------------
            // PASO 2: LÓGICA EN MEMORIA (CÁLCULOS)
            // ------------------------------------------------------

            // A. Datos de Pregunta
            const preguntaData = preguntaDoc.data();
            const reward = Number(preguntaData.reward) || 0;
            const respuestaCorrectaOficial = preguntaData.respuestaCorrecta;

            // B. Validación de Respuesta
            const esCorrecta = (respuestaUsuario === respuestaCorrectaOficial);

            // C. Datos de Usuario y CSV
            const userData = userDoc.data();
            const preguntasVistasStr = userData.preguntasvistas || "";
            // Usamos tu función helper (Asegúrate de tenerla definida arriba en index.js)
            const newPreguntasVistasStr = addToCSV(preguntasVistasStr, preguntaId);

            // ------------------------------------------------------
            // PASO 3: ESCRITURAS (TODAS JUNTAS AL FINAL)
            // ------------------------------------------------------

            // A. Actualizar documento 'respuesta' (Snapshot y verificación)
            if (data.correcta !== esCorrecta) {
                transaction.update(snap.ref, {
                    correcta: esCorrecta,
                    verifiedAt: FieldValue.serverTimestamp(),
                    snapshotReward: reward
                });
            } else {
                transaction.update(snap.ref, {
                    snapshotReward: reward
                });
            }

            // B. Actualizar documento 'user'
            const updates = {
                respuestasEnviadas: FieldValue.increment(1),
                preguntasvistas: newPreguntasVistasStr
            };

            if (esCorrecta) {
                updates.score = FieldValue.increment(reward);
                updates.respuestasCorrectas = FieldValue.increment(1);
            }

            transaction.update(userRef, updates);
        });

        console.log(`[RESPUESTA] Success for User ${userId}. Correct: ${data.respuesta === (await preguntaRef.get()).data()?.respuestaCorrecta}`); // Log simplificado

    } catch (error) {
        console.error(`[ERROR] Transaction failed for Q-${preguntaId}:`, error);
    }
});


// ==================================================================
// 8. ELIMINAR RESPUESTA (onDelete)
// ==================================================================
// Lógica: Revertir contadores, restar puntos y quitar ID de preguntasvistas
exports.eliminarRespuesta = onDocumentDeleted("respuesta/{respuestaId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

    // 🔒 BLOQUEO TEMPORAL — Competencia cerrada
    if (isChallengeOver()) {
        console.warn(`[LOCKED] [eliminarRespuesta] Competencia cerrada. Eliminación ignorada a las ${new Date().toISOString()}`);
        return null;
    }

    const data = snap.data();
    const userId = data.userId;
    const preguntaId = data.preguntaid;
    const esCorrecta = data.correcta === true;

    let rewardASustraer = data.snapshotReward;

    console.log(`[DELETE RESPUESTA] Rollback for User ${userId}. Was correct? ${esCorrecta}`);

    if (!userId) return;

    const userRef = db.collection('user').doc(userId);

    try {
        await db.runTransaction(async (transaction) => {
            // Recuperar reward si no estaba en el snapshot
            if (esCorrecta && (rewardASustraer === undefined || rewardASustraer === null)) {
                const preguntaRef = db.collection('pregunta').doc(String(preguntaId));
                const pDoc = await transaction.get(preguntaRef);
                if (pDoc.exists) {
                    rewardASustraer = Number(pDoc.data().reward) || 0;
                } else {
                    rewardASustraer = 0;
                }
            }

            // Leer usuario para modificar el CSV
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) return; // Si no existe usuario, nada que actualizar

            const userData = userDoc.data();
            const preguntasVistasStr = userData.preguntasvistas || "";

            // Quitar ID del CSV
            // Usamos la función auxiliar removeFromCSV que ya tienes definida arriba
            const newPreguntasVistasStr = removeFromCSV(preguntasVistasStr, preguntaId);

            const updates = {
                respuestasEnviadas: FieldValue.increment(-1),
                preguntasvistas: newPreguntasVistasStr // <--- Actualizamos el campo limpio
            };

            if (esCorrecta) {
                updates.respuestasCorrectas = FieldValue.increment(-1);
                updates.score = FieldValue.increment(-Number(rewardASustraer));
            }

            transaction.update(userRef, updates);
        });

        console.log(`[SUCCESS] Respuesta rollback completed.`);

    } catch (error) {
        console.error(`[ERROR] Delete respuesta failed:`, error);
    }
});