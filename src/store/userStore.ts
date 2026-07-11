import { persistentMap } from '@nanostores/persistent';

// ¡Adiós Firebase! El cliente ya no necesita la librería de Firestore.
// Todo el tráfico ahora va directamente a nuestra propia API (que habla con Postgres).

export type UserProfile = {
    docId: string;
    phone: string;
    username: string;
    ticketsFixed: string;
    payedTickets: string; 
    score: string;       
    parroquiasVistitadas: string;
    preguntasVistas: string;
    referencia: string;
    isAuthenticated: string; 
    'tickets-numbers': string;
};

// Default empty state
const initialState: UserProfile = {
    docId: '',
    phone: '',
    username: '',
    ticketsFixed: '',
    payedTickets: '0',
    score: '0',
    parroquiasVistitadas: '',
    preguntasVistas: '',
    referencia: '',
    isAuthenticated: 'false',
    'tickets-numbers': '',
};

// Persistent store to keep session alive across reloads
export const userStore = persistentMap<UserProfile>('bartimeo:user', initialState);

// UI State Atoms
import { atom } from 'nanostores';
export const isLoginOpen = atom(false);

// GLOBAL EXPOSURE (Critical for Astro Island communication)
if (typeof window !== 'undefined') {
    (window as any).bartimeoUserStore = userStore;
}

// CENTRALIZED HELPERS
export const getCurrentUser = (): UserProfile => {
    if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
        return (window as any).bartimeoUserStore.get();
    }
    return userStore.get();
};

export const isUserAuthenticated = (): boolean => {
    const user = getCurrentUser();
    return user.isAuthenticated === 'true'; 
};

export const loginUser = async (phone: string) => {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });

        const data = await response.json();

        if (response.ok && data.success && data.user) {
            const userData = {
                ...data.user,
                payedTickets: String(data.user.payedTickets),
                score: String(data.user.score),
                isAuthenticated: 'true',
                'tickets-numbers': data.user['tickets-numbers'] || ''
            };

            userStore.set(userData);

            console.log("--- LOGIN SUCCESSFUL (POSTGRES) ---");
            console.log("User Data:", userData);

            if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
                (window as any).bartimeoUserStore.set(userData);
            }

            return { success: true };
        } else {
            return { success: false, error: data.error || 'Autenticación fallida' };
        }

    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: 'Error de conexión - Contacta a soporte' };
    }
};

export const logoutUser = () => {
    userStore.set(initialState);
    if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
        (window as any).bartimeoUserStore.set(initialState);
    }
    localStorage.clear(); 
};

// Action to refresh user data (e.g. after playing a game)
export const refreshUserData = async () => {
    const current = getCurrentUser();
    if (!current.isAuthenticated || !current.docId) return;

    try {
        // En lugar de leer de Firestore, consultamos nuestra propia API (Postgres)
        const response = await fetch(`/api/user/${current.docId}`);
        
        if (response.ok) {
            const data = await response.json();
            const newData = {
                ...current,
                score: String(data.score || 0),
                payedTickets: String(data.payedTickets || 0),
                parroquiasVistitadas: data.parroquiasVistitadas || '',
                preguntasVistas: data.preguntasVistas || '',
                referencia: data.referencia || '',
                username: data.username || current.username,
                'tickets-numbers': data['tickets-numbers'] || ''
            };
            
            userStore.set(newData);
            
            if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
                (window as any).bartimeoUserStore.set(newData);
            }
        }
    } catch (e) {
        console.error("Failed to refresh user data from Postgres API:", e);
    }
};
