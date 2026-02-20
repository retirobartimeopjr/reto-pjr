import type { APIRoute } from 'astro';
import { db } from '../../services/firebase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, referralPhone, newUserPhone } = body;

        if (!referralPhone || (!userId && !newUserPhone)) {
            return new Response(JSON.stringify({ success: false, error: "Faltan datos requeridos." }), { status: 400 });
        }

        const targetPhone = String(referralPhone).replace(/\D/g, '').trim(); // Sanitize referral phone
        const newPhone = newUserPhone ? String(newUserPhone).replace(/\D/g, '').trim() : null; // Sanitize potential new user phone

        // 1. Validate Target User (Does the referrer exist?)
        const referrerQuery = await db.collection('user').where('phone', '==', targetPhone).limit(1).get();

        if (referrerQuery.empty) {
            return new Response(JSON.stringify({ success: false, error: "El número de quien te invitó no está registrado." }), { status: 404 });
        }

        const referrerData = referrerQuery.docs[0].data();

        // 2. Identify the User to be referred (Existing or New)
        let userRef;
        let userData;

        if (userId) {
            userRef = db.collection('user').doc(userId);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
                userData = userSnap.data();
            }
        } else if (newPhone) {
            // Check if user already exists by phone
            const userQuery = await db.collection('user').where('phone', '==', newPhone).limit(1).get();
            if (!userQuery.empty) {
                userRef = userQuery.docs[0].ref;
                userData = userQuery.docs[0].data();
            }
        }

        // SCENARIO A: NEW USER (DOES NOT EXIST YET) -> SAVE PENDING REFERRAL
        if (!userData && newPhone) {
            console.log(`[Referral] Saving PENDING referral for ${newPhone} (Referrer: ${targetPhone})`);

            // Check if pending referral already exists to prevent duplicates
            const pendingRef = db.collection('pending_referrals').doc(newPhone);
            await pendingRef.set({
                newUserPhone: newPhone,
                referralPhone: targetPhone,
                createdAt: new Date().toISOString(),
                status: 'pending'
            });

            return new Response(JSON.stringify({
                success: true,
                message: "Referido guardado (pendiente de registro)",
                referencia: targetPhone
            }), { status: 200 });
        }

        // SCENARIO B: EXISTING USER logic (Validation checks)
        if (!userData) {
            return new Response(JSON.stringify({ success: false, error: "Usuario no encontrado." }), { status: 404 });
        }

        // If we found the user via query but didn't set userRef (legacy behavior fallback)
        if (!userRef && userData) {
            // Should verify we have a ref, if coming from query
            // This block might be redundant if logic above is correct, but safe
        }

        const payedTickets = Number(userData?.payedTickets || userData?.payedtickets || 0);

        // CHECK: Cannot refer self
        if (userData?.phone === targetPhone) {
            return new Response(JSON.stringify({ success: false, error: "No puedes referirte a ti mismo." }), { status: 400 });
        }

        // CHECK: Cannot change if already set
        if (userData?.referencia && userData.referencia.length > 5) {
            return new Response(JSON.stringify({ success: false, error: "Ya tienes un referido asignado." }), { status: 400 });
        }

        // 3. EXECUTE WRITE (Direct Update)
        await userRef?.update({
            referencia: targetPhone
        });

        return new Response(JSON.stringify({
            success: true,
            referencia: targetPhone
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Referral API Error:", error);
        return new Response(JSON.stringify({ success: false, error: "Error interno del servidor." }), { status: 500 });
    }
}
