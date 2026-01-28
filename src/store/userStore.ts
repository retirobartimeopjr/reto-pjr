
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
export const userStore = persistentMap<UserProfile>('bartimeo:user', initialState);

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
            userStore.set({
                ...data.user,
                payedTickets: String(data.user.payedTickets),
                score: String(data.user.score),
                isAuthenticated: 'true'
            });
            return { success: true };
        } else {
            return { success: false, error: data.error || 'Autenticación fallida' };
        }

    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: 'Error de conexión' };
    }
};

export const logoutUser = () => {
    userStore.set(initialState);
};

// Action to refresh user data (e.g. after playing a game)
// Silent update, doesn't throw errors to UI usually
export const refreshUserData = async () => {
    const current = userStore.get();
    if (!current.isAuthenticated || !current.docId) return;

    try {
        const userDocRef = doc(db, 'user', current.docId);
        const snapshot = await getDoc(userDocRef);

        if (snapshot.exists()) {
            const data = snapshot.data();
            userStore.set({
                ...current,
                score: String(data.score || 0),
                payedTickets: String(data['payedtickets'] || 0),
                parroquiasVistitadas: data.parroquiasVistitadas || '',
                preguntasVistas: data.preguntasvistas || '',
                referencia: data.referencia || '',
                username: data.username || current.username
            });
        }
    } catch (e) {
        console.error("Failed to refresh user data:", e);
    }
};
