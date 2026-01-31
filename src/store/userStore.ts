
import { persistentMap } from '@nanostores/persistent';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.client';

export type UserProfile = {
    docId: string;
    phone: string;
    username: string;
    ticketsFixed: string;
    payedTickets: string; // Changed to string for persistentMap compatibility
    score: string;       // Changed to string for persistentMap compatibility
    parroquiasVistitadas: string;
    preguntasVistas: string;
    referencia: string;
    isAuthenticated: string; // Changed to string ('true'/'false')
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
};

// Persistent store to keep session alive across reloads
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
    // Try window instance first (most up to date in client)
    if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
        return (window as any).bartimeoUserStore.get();
    }
    return userStore.get();
};

export const isUserAuthenticated = (): boolean => {
    const user = getCurrentUser();
    return user.isAuthenticated === 'true' || user.isAuthenticated === true; // Handle persistent string vs boolean
};

export const loginUser = async (phone: string, code: string) => {
    try {
        // Updated to use Server-Side API logic
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, code })
        });

        const data = await response.json();

        if (response.ok && data.success && data.user) {
            // Success! Save to store
            const userData = {
                ...data.user,
                payedTickets: String(data.user.payedTickets),
                score: String(data.user.score),
                isAuthenticated: 'true'
            };

            userStore.set(userData);

            // Log for user request
            console.log("--- LOGIN SUCCESSFUL ---");
            console.log("User Data:", userData);

            // Force update global if needed (though map shares ref)
            if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
                (window as any).bartimeoUserStore.set(userData);
            }

            return { success: true };
        } else {
            return { success: false, error: data.error || 'Autenticación fallida' };
        }

    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: 'Error de conexión - Contacta a 3123415728' };
    }
};

export const logoutUser = () => {
    userStore.set(initialState);
    if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
        (window as any).bartimeoUserStore.set(initialState);
    }
    localStorage.clear(); // Nuclear option for logout to be safe
    // Or just clear specific keys to avoid clearing preferences
    // localStorage.removeItem('bartimeo:user:isAuthenticated');
    // ... but clear() is requested "centralized" cleanup usually.
};

// Action to refresh user data (e.g. after playing a game)
// Silent update, doesn't throw errors to UI usually
export const refreshUserData = async () => {
    const current = getCurrentUser();
    if (!current.isAuthenticated || !current.docId) return;

    try {
        const userDocRef = doc(db, 'user', current.docId);
        const snapshot = await getDoc(userDocRef);

        if (snapshot.exists()) {
            const data = snapshot.data();
            const newData = {
                ...current,
                score: String(data.score || 0),
                payedTickets: String(data['payedtickets'] || 0),
                parroquiasVistitadas: data.parroquiasVistitadas || '',
                preguntasVistas: data.preguntasvistas || '',
                referencia: data.referencia || '',
                username: data.username || current.username
            };
            userStore.set(newData);
            if (typeof window !== 'undefined' && (window as any).bartimeoUserStore) {
                (window as any).bartimeoUserStore.set(newData);
            }
        }
    } catch (e) {
        console.error("Failed to refresh user data:", e);
    }
};

