const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Set explicit region to match database location
setGlobalOptions({ region: "southamerica-east1" });

initializeApp();
const db = getFirestore();

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

// --------------------------------------------------------
// 1. PROCESAR TICKET REGISTER (onCreate)
// --------------------------------------------------------
exports.procesarTicketRegister = onDocumentCreated("ticketregister/{registerId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

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

                // [LOGICA SOLICITADA]: Si el usuario existe, usamos SU nombre actual
                // para actualizar el ticketregister, garantizando consistencia.
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
            // Aquí inyectamos el userId, el código fixed Y EL USERNAME CORRECTO
            transaction.update(snap.ref, {
                userId: userRef.id,
                fixed: fixedCode,
                username: finalUsernameForRegister, // <--- Actualización automática con el nombre real
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
                // Caso: Usuario Nuevo (Create)
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
                // Caso: Usuario Existente (Update)
                const updates = {
                    "tickets-numbers": newTicketsStr,
                    "tickets-fixed": newFixedStr,
                    "tickets-quantity": newQuantity,
                    "payedtickets": newPayedCount,
                    "pendingpay": newPendingCount,
                    lastUpdated: FieldValue.serverTimestamp()
                };
                
                // Nota: Ya no forzamos la actualización del nombre del usuario desde el ticket
                // porque priorizamos que la fuente de verdad sea el usuario existente.
                // Sin embargo, si quisieras actualizar otros campos (como cédula si falta), irían aquí.

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


// --------------------------------------------------------
// 2. ELIMINAR TICKET REGISTER (onDelete)
// --------------------------------------------------------
exports.eliminarTicketRegister = onDocumentDeleted("ticketregister/{registerId}", async (event) => {
    const snap = event.data;
    if (!snap) return;

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


// --------------------------------------------------------
// 3. SINCRONIZAR DATOS DE USUARIO (onUpdate)
// --------------------------------------------------------
// Actualiza phone, cedula y username en todos los ticketregister asociados
exports.sincronizarDatosUsuario = onDocumentUpdated("user/{userId}", async (event) => {
    const userId = event.params.userId;
    const before = event.data.before.data();
    const after = event.data.after.data();

    // 1. Detectar cambios en los campos clave
    const usernameChanged = before.username !== after.username;
    const phoneChanged = before.phone !== after.phone;
    const cedulaChanged = before.cedula !== after.cedula;

    if (!usernameChanged && !phoneChanged && !cedulaChanged) {
        return; // No hubo cambios relevantes, salir.
    }

    console.log(`[SYNC] Updating user data for userId: ${userId}`);

    // 2. Preparar el objeto de actualización
    const updates = {};
    if (usernameChanged) updates.username = after.username;
    if (phoneChanged) updates.phone = after.phone;
    if (cedulaChanged) updates.cedula = after.cedula;

    // 3. Buscar todos los ticketregister de este usuario
    const registersQuery = db.collection('ticketregister').where('userId', '==', userId);
    
    try {
        const snapshot = await registersQuery.get();
        if (snapshot.empty) return;

        // 4. Batch Update (Escritura por lotes)
        const batch = db.batch();
        
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, updates);
        });

        await batch.commit();
        console.log(`[SYNC] Updated ${snapshot.size} ticket registers for user ${userId}`);

    } catch (error) {
        console.error(`[ERROR] Sync failed for user ${userId}:`, error);
    }
});