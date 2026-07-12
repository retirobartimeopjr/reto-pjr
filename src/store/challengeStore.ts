import { atom, onMount } from 'nanostores';

export const isChallengeActive = atom<boolean>(true);
export const challengeMessage = atom<string>("¡El Reto ha terminado!");

// Este flag evita múltiples intervalos si el componente se monta varias veces en Astro/React
let isPolling = false;

// Iniciamos el polling cuando el átomo es escuchado (por React)
onMount(isChallengeActive, () => {
    if (typeof window === 'undefined') return; // Solo en cliente
    
    if (isPolling) return;
    isPolling = true;

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/appConfig');
            if (res.ok) {
                const data = await res.json();
                isChallengeActive.set(data.active);
                if (data.message) {
                    challengeMessage.set(data.message);
                }
            }
        } catch (e) {
            console.error("Error fetching challenge state:", e);
        }
    };

    // Consultamos inmediatamente
    fetchConfig();

    // Hacemos polling cada 15 segundos
    const intervalId = setInterval(fetchConfig, 15000);

    return () => {
        clearInterval(intervalId);
        isPolling = false;
    };
});
