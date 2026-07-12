import { useStore } from '@nanostores/react';
import { isChallengeActive, challengeMessage } from '../store/challengeStore';

export default function EndOfChallengeModal() {
    const active = useStore(isChallengeActive);
    const message = useStore(challengeMessage);

    // Si el reto está activo, no mostramos el overlay de bloqueo
    if (active) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="bg-black/90 border border-brand/50 rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-brand animate-pulse"></div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-brand mb-4">
                    🛑 Reto Bloqueado
                </h2>
                <p className="text-white/90 text-lg mb-6 leading-relaxed">
                    {message}
                </p>
                <div className="inline-block px-4 py-2 bg-brand/10 border border-brand/30 rounded-full text-brand text-sm font-bold tracking-wider">
                    Espera instrucciones de los coordinadores
                </div>
            </div>
        </div>
    );
}
