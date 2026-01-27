
import type { APIRoute } from 'astro';
import { db } from '../../services/firebase';

export const GET: APIRoute = async () => {
    try {
        const snapshot = await db.collection('parroquias').get();

        const parroquias = snapshot.docs.map(doc => {
            const data = doc.data();

            // Coordinates are stored as "lat, lng" string in Firebase (from Excel)
            // or sometimes might be separated if migration changed. 
            // Based on migration, it's a direct copy, so it's a string "lat, ln".


            // Check if coordinates exist (some data has 'location', some 'coordinates')
            const rawCoords = data.coordinates || data.location;
            if (!rawCoords) return null;

            const parts = rawCoords.toString().split(',');
            if (parts.length !== 2) return null;

            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());

            if (isNaN(lat) || isNaN(lng)) return null;

            return {
                id: data.id || doc.id,
                name: data.name,
                center: { lat, lng },
                vicaria: data.vicaria
            };
        }).filter(p => p !== null);

        return new Response(JSON.stringify(parroquias), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error("API Error", error);
        return new Response(JSON.stringify({ error: "Failed to fetch data" }), { status: 500 });
    }
}
