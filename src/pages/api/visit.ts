
import type { APIRoute } from 'astro';
import { admin, db } from '../../services/firebase';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, parroquiaId, userLogInfo, photoPath } = body;

        // Log user info as requested by user
        if (userLogInfo) {
            console.log("--- LOGGED IN USER INFO FROM CLIENT ---");
            console.log("UserID:", userId);
            console.log("ParroquiaID:", parroquiaId);
            console.log("Photo URL:", photoPath);
            console.log("User Snapshot:", JSON.stringify(userLogInfo, null, 2));
            console.log("---------------------------------------");
        }

        if (!userId || !parroquiaId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'UserID y ParroquiaID son requeridos'
            }), { status: 400 });
        }

        // 1. Run Transaction to Update User & Log Visit
        const userRef = db.collection('user').doc(userId);
        const visitRef = db.collection('visit').doc();

        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) {
                throw new Error("User does not exist");
            }

            // Fetch Parish Data to get Reward
            let rewardPoints = 0;
            const parishDocRef = db.collection('parroquias').doc(parroquiaId);
            const parishDoc = await t.get(parishDocRef);

            if (parishDoc.exists) {
                rewardPoints = parseInt(parishDoc.data()?.reward || "0");
            } else {
                // Fallback: Search by 'id' field if not found by Doc ID
                const query = db.collection('parroquias').where('id', '==', parroquiaId).limit(1);
                const querySnapshot = await t.get(query);
                if (!querySnapshot.empty) {
                    rewardPoints = parseInt(querySnapshot.docs[0].data()?.reward || "0");
                } else {
                    console.warn(`Parish ${parroquiaId} not found during visit. Defaulting reward to 0.`);
                }
            }

            // Prevent Duplicates
            const userData = userDoc.data();
            const visitedStr = userData?.parroquiasVistitadas || "";
            const visitedArr = visitedStr.split(',').map((s: string) => s.trim()).filter((s: string) => s);

            if (visitedArr.includes(parroquiaId.toString())) {
                throw new Error("Duplicate Visit");
            }

            // Update State
            const newVisited = [...visitedArr, parroquiaId].join(',');
            const currentScore = parseInt(userData?.score || "0");
            const newScore = currentScore + rewardPoints;

            t.update(userRef, {
                parroquiasVistitadas: newVisited,
                score: newScore.toString()
            });

            t.set(visitRef, {
                userId,
                parroquiaid: parroquiaId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                pointsAwarded: rewardPoints,
                photoUrl: photoPath || null
            });

            console.log(`✅ [VISIT] Recorded visit for User ${userId} at Parroquia ${parroquiaId}. Awarded ${rewardPoints} points.`);
        });

        return new Response(JSON.stringify({
            success: true,
            message: 'Visita registrada y puntos sumados',
            visitId: visitRef.id
        }), { status: 200 });

    } catch (error: any) {
        console.error("❌ [VISIT API ERROR]", error);

        if (error.message === 'Duplicate Visit') {
            return new Response(JSON.stringify({
                success: false,
                code: 'DUPLICATE_VISIT',
                error: 'Ya has visitado esta parroquia'
            }), { status: 409 });
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Error registrando la visita'
        }), { status: 500 });
    }
};
