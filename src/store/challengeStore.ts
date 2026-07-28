import { atom, onMount } from 'nanostores';

export const isChallengeActive = atom<boolean>(true);
export const challengeMessage = atom<string>("¡El Reto ha terminado!");
export const challengeStartTime = atom<number | null>(null);
export const challengeEndTime = atom<number | null>(null);

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
                if (data.challenge_start_time) {
                    challengeStartTime.set(new Date(data.challenge_start_time).getTime());
                } else {
                    challengeStartTime.set(null);
                }
                if (data.challenge_end_time) {
                    challengeEndTime.set(new Date(data.challenge_end_time).getTime());
                } else {
                    challengeEndTime.set(null);
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
