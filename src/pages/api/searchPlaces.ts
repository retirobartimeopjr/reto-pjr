import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const city = url.searchParams.get('city');
        const searchTerm = url.searchParams.get('searchTerm') || 'Parroquia';

        if (!city) {
            return new Response(JSON.stringify({ error: "El parámetro 'city' es requerido." }), { status: 400 });
        }

        const apiKey = import.meta.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "No hay API Key de Google Maps configurada." }), { status: 500 });
        }

        // Search using Google Places API (New)
        const placesUrl = `https://places.googleapis.com/v1/places:searchText`;
        
        const payload = {
            textQuery: `${searchTerm} en ${city}`,
            includedType: "church"
        };

        const res = await fetch(placesUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("Google Places API (New) Error:", data);
            return new Response(JSON.stringify({ error: "Error consultando Google Places: " + (data.error?.message || 'Unknown') }), { status: 502 });
        }

        if (!data.places || data.places.length === 0) {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Map results to a clean candidate format
        const candidates = data.places.map((place: any) => ({
            id: place.id,
            name: place.displayName?.text || 'Sin Nombre',
            address: place.formattedAddress,
            center: {
                lat: place.location?.latitude || 0,
                lng: place.location?.longitude || 0
            }
        }));

        return new Response(JSON.stringify(candidates), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error("❌ Error en searchPlaces API:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};
