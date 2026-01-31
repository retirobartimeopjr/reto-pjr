
import { useStore } from '@nanostores/react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { refreshUserData, userStore } from '../store/userStore';

export default function Referidos() {
    const user = useStore(userStore);
    const [referralPhone, setReferralPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: '' });
    const [showConfirm, setShowConfirm] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
        if (toast.text) {
            const timer = setTimeout(() => setToast({ type: null, text: '' }), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    if (user.isAuthenticated !== 'true') return null;

    // Ensure payedTickets is treated as number safe
    const payedTicketsCount = Number(user.payedTickets) || 0;
    const canRefer = payedTicketsCount > 0;

    const showToast = (type: 'success' | 'error', text: string) => {
        setToast({ type, text });
    };

    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!canRefer) return;

        const cleanPhone = referralPhone.trim();

        if (cleanPhone === user.phone) {
            showToast('error', '¡Ups! No puedes referirte a ti mismo.');
            return;
        }

        if (cleanPhone.length < 10) {
            showToast('error', 'El número parece incompleto. Revisa que tenga 10 dígitos.');
            return;
        }

        setShowConfirm(true);
    };

    const handleConfirmSubmit = async () => {
        setShowConfirm(false);
        setLoading(true);

        const targetPhone = referralPhone.trim();

        try {
            const response = await fetch('/api/submitReferral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.docId,
                    referralPhone: targetPhone
                })
            });

            const result = await response.json();

            if (result.success) {
                // SUCCESS
                console.log("[Referidos] API Success:", result);
                showToast('success', '¡Referido confirmado! 🎉');
                await refreshUserData(); // Sync store
                setLoading(false);
            } else {
                // API ERROR
                console.error("[Referidos] API Error:", result.error);
                showToast('error', result.error || 'No se pudo asignar el referido.');
                setLoading(false);
            }

        } catch (error) {
            console.error("[Referidos] Network Error:", error);
            showToast('error', 'Error de conexión. Inténtalo de nuevo.');
            setLoading(false);
        }
    };

    const Portal = ({ children }: { children: React.ReactNode }) => {
        if (!mounted || typeof document === 'undefined') return null;
        return createPortal(children, document.body);
    };

    return (
        <>
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-8 mt-12 relative overflow-hidden">
                {/* Decorative Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#f8b134]/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="relative z-10">
                    <h3 className="text-2xl font-serif text-[#f8b134] mb-2 flex items-center gap-3">
                        <div className="p-2 bg-[#f8b134]/10 rounded-full border border-[#f8b134]/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        Programa de Referidos
                    </h3>
                    <p className="text-white/60 text-sm mb-8 leading-relaxed max-w-lg">
                        Invita a tus amigos a unirse al Reto Bartimeo. Si registras quién te invitó, ¡ambos podrían ganar recompensas!
                    </p>

                    {!!user.referencia ? (
                        <div className="animate-in fade-in zoom-in duration-500">
                            <div className="p-6 bg-green-500/10 rounded-2xl border border-green-500/20 text-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-green-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                <div className="relative z-10">
                                    <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">
                                        ¡Completado!
                                    </span>
                                    <p className="text-white/70 text-sm mb-2">Ya estás conectado con:</p>
                                    <p className="text-white font-mono text-2xl font-bold tracking-widest">{user.referencia}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {!canRefer ? (
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                    <h4 className="text-white font-medium mb-2">Función Bloqueada</h4>
                                    <p className="text-white/50 text-sm mb-4 leading-relaxed">
                                        Para evitar el spam y asegurar recompensas reales, necesitas comprar al menos <strong>1 Ticket</strong> para desbloquear los referidos.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handlePreSubmit} className="flex flex-col gap-4 max-w-md">
                                    <div className="bg-[#f8b134]/5 border border-[#f8b134]/20 rounded-xl p-4 mb-2">
                                        <p className="text-[#f8b134] text-xs flex items-start gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span><strong>Nota Importante:</strong> Solo puedes registrar un referido una única vez</span>
                                        </p>
                                    </div>

                                    <div className="relative group">
                                        <input
                                            type="tel"
                                            value={referralPhone}
                                            onChange={(e) => setReferralPhone(e.target.value)}
                                            placeholder="Teléfono del amigo (Ej. 312...)"
                                            disabled={loading}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white text-lg placeholder-white/30 focus:outline-none focus:border-[#f8b134] focus:ring-1 focus:ring-[#f8b134]/50 transition-all disabled:opacity-50 group-hover:border-white/20"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !referralPhone}
                                        className="bg-gradient-to-r from-[#f8b134] to-[#dca336] hover:from-[#fbd07e] hover:to-[#eec15b] text-black font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-[#f8b134]/20 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                Verificando...
                                            </span>
                                        ) : 'Guardar Referido'}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* FLOATING TOAST PORTAL */}
            {toast.text && (
                <Portal>
                    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[99999] w-full max-w-sm px-4">
                        <div className={`
                            flex items-center gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-top-4 fade-in duration-300
                            ${toast.type === 'error'
                                ? 'bg-red-500/20 border-red-500/30 text-white'
                                : 'bg-green-500/20 border-green-500/30 text-white'
                            }
`}>
                            {toast.type === 'error' ? (
                                <div className="p-2 bg-red-500/20 rounded-full shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                            ) : (
                                <div className="p-2 bg-green-500/20 rounded-full shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            )}
                            <div>
                                <h4 className={`font-bold text-sm ${toast.type === 'error' ? 'text-red-400' : 'text-green-400'} `}>
                                    {toast.type === 'error' ? 'Error' : '¡Excelente!'}
                                </h4>
                                <p className="text-xs text-white/80">{toast.text}</p>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* CONFIRMATION MODAL PORTAL */}
            {showConfirm && (
                <Portal>
                    <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-[#f8b134]/30 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative text-center animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 rounded-full bg-[#f8b134]/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-[#f8b134]/30">
                                <span className="text-3xl">🤔</span>
                            </div>
                            <h4 className="text-xl font-bold text-white mb-2">¿Estás seguro?</h4>
                            <p className="text-white/60 text-sm mb-6">
                                Vas a registrar a <strong>{referralPhone}</strong> como tu referido.
                                <br /><br />
                                <span className="text-[#f8b134]">Esta acción solo se puede realizar una vez y no se puede deshacer.</span>
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    className="flex-1 py-3 bg-[#f8b134] hover:bg-[#dca336] text-black font-bold rounded-xl transition-colors"
                                >
                                    Sí, Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
}
