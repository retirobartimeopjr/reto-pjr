
import { useStore } from '@nanostores/react';
import confetti from 'canvas-confetti';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { db } from '../lib/firebase.client';
import { refreshUserData, userStore } from '../store/userStore';

interface ParroquiaActionProps {
    parroquiaId: string;
    parroquiaName: string;
}

export default function ParroquiaAction({ parroquiaId, parroquiaName }: ParroquiaActionProps) {
    const user = useStore(userStore);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'already_visited'>('idle');

    // Check if users already visited
    const hasVisited = (user.parroquiasVistitadas || '').split(',').map(s => s.trim()).includes(parroquiaId);

    const handleVisit = async () => {
        if (user.isAuthenticated !== 'true') {
            alert("Debes iniciar sesión para registrar tu visita.");
            return;
        }

        setLoading(true);
        setStatus('idle');

        try {
            // Create Visit Document
            await addDoc(collection(db, 'visit'), {
                userId: user.docId,
                parroquiaid: parroquiaId,
                timestamp: serverTimestamp(),
                userLocation: "GPS_CONFIRMED", // Placeholder, ideally specific coords passed as prop
                platform: "web"
            });

            setStatus('success');
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            // Trigger silent refresh of user data to update UI score eventually
            setTimeout(() => {
                refreshUserData();
            }, 3000);

        } catch (error) {
            console.error("Error registering visit:", error);
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    if (hasVisited || status === 'success') {
        return (
            <div className="w-full p-4 bg-green-500/20 border border-green-500/30 rounded-xl flex items-center gap-3 backdrop-blur-md">
                <div className="p-2 bg-green-500/20 rounded-full text-green-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div>
                    <h4 className="font-bold text-green-100 text-sm">¡Visita Registrada!</h4>
                    <p className="text-green-200/60 text-xs">Ya has peregrinado en este lugar santo.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mt-4">
            <button
                onClick={handleVisit}
                disabled={loading}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] text-black font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:grayscale"
            >
                <div className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                        <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                    <span>{loading ? "Registrando..." : "Confirmar Mi Visita Aquí"}</span>
                </div>

                {/* Shine Effect */}
                <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[30deg] group-hover:animate-[shine_1.5s_infinite]" />
            </button>

            {status === 'error' && (
                <p className="text-red-400 text-xs text-center mt-2">Hubo un error al registrar la visita. Intenta de nuevo.</p>
            )}
        </div>
    );
}

// Add animation to tailwind config or global css: 
// @keyframes shine { 0% { left: -100% } 100% { left: 200% } }
