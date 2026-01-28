
import { useStore } from '@nanostores/react';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { db } from '../lib/firebase.client';
import { refreshUserData, userStore } from '../store/userStore';

export default function Referidos() {
    const user = useStore(userStore);
    const [referralPhone, setReferralPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    if (user.isAuthenticated !== 'true') return null;

    const hasReferral = !!user.referencia;
    const canRefer = (Number(user.payedTickets) || 0) > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });

        if (!canRefer) {
            setMsg({ type: 'error', text: 'Necesitas tener al menos un ticket pago para referir.' });
            return;
        }

        if (referralPhone === user.phone) {
            setMsg({ type: 'error', text: 'No puedes referirte a ti mismo.' });
            return;
        }

        setLoading(true);
        try {
            const userRef = doc(db, 'user', user.docId);
            await updateDoc(userRef, {
                referencia: referralPhone
            });
            setMsg({ type: 'success', text: 'Referido guardado exitosamente.' });
            setTimeout(() => refreshUserData(), 1500);
        } catch (error) {
            console.error(error);
            setMsg({ type: 'error', text: 'Error al guardar referido.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-8">
            <h3 className="text-lg font-serif text-[#f8b134] mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Programa de Referidos
            </h3>

            {hasReferral ? (
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                    <p className="text-white/60 text-sm mb-1">Ya has registrado un referido:</p>
                    <p className="text-[#f8b134] font-mono text-lg tracking-wider">{user.referencia}</p>
                </div>
            ) : (
                <>
                    <p className="text-sm text-white/60 mb-4">
                        Ingresa el número de teléfono de quien te invitó. Solo podrás hacerlo una vez.
                    </p>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <input
                            type="tel"
                            value={referralPhone}
                            onChange={(e) => setReferralPhone(e.target.value)}
                            placeholder="Teléfono del amigo (Ej. 312...)"
                            disabled={!canRefer || loading}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 transition-all disabled:opacity-50"
                        />

                        {!canRefer && (
                            <p className="text-xs text-red-400">
                                🔒 Desbloquea esta función comprando al menos un ticket.
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={!canRefer || loading || !referralPhone}
                            className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Guardando...' : 'Guardar Referido'}
                        </button>

                        {msg.text && (
                            <p className={`text-xs text-center p-2 rounded ${msg.type === 'error' ? 'text-red-300 bg-red-500/10' : 'text-green-300 bg-green-500/10'}`}>
                                {msg.text}
                            </p>
                        )}
                    </form>
                </>
            )}
        </div>
    );
}
