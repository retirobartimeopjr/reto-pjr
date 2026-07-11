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

    if (!mounted || user.isAuthenticated !== 'true') return null;

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


    const handleShare = async () => {
        const shareData = {
            title: 'Reto Bartimeo',
            //text: `¡Hola! Te invito a unirte al Reto Bartimeo (retirobartimeo.org), puedes apoyarme registrando mi número: ${user.phone} cuando te inscribas. ¡A ganar puntos!`,
            text: `¡Hola! ¿Como estas?

Estoy participando en el Reto Bartimeo, una iniciativa parroquial que busca recaudar fondos para apoyar a nuestros jóvenes en mision.

Puedes participar y ayudarme de una manera muy sencilla:
1. Ingresa a retirobartimeo.org
2. Regístrate
3. Coloca mi número ${user.phone} al inscribirte
¡Gracias por el apoyo!
`,
        };

        try {
            // 2. Fallback: Abrir WhatsApp en una pestaña nueva
            const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');

        } catch (err) {
            console.error('Error al compartir:', err);
        }
    };



    const Portal = ({ children }: { children: React.ReactNode }) => {
        if (!mounted || typeof document === 'undefined') return null;
        return createPortal(children, document.body);
    };

    return (
        <>

            {/* Main Container - More transparent, with stronger gradient and solid inner boxes */}
            <div className="bg-gradient-to-br from-[#722F37]/90 to-[#722F37]/60 border border-white/10 rounded-2xl p-4 md:p-8 mt-8 relative overflow-hidden shadow-2xl backdrop-blur-sm">
                {/* Decorative Background Glow - subtle for depth */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-black/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="relative z-10">
                    <h3 className="text-2xl md:text-3xl font-serif text-white mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
                        <div className="p-2 bg-black/20 rounded-full border border-white/10 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#f8b134]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <span className="text-[#f8b134] font-bold">Invita y Gana 100 Puntos!</span>
                    </h3>

                    <div className={`grid ${!!user.referencia ? 'md:grid-cols-1 max-w-lg mx-auto' : 'md:grid-cols-2'} gap-8 md:gap-12`}>
                        {/* SECTION 1: ENTER REFERRER - ONLY SHOW IF NO REFERRER */}
                        {!user.referencia && (
                            <div className="flex flex-col gap-4">
                                {/* Inner Box - Solid for contrast */}
                                <div className="bg-[#1a1a1a] p-5 rounded-xl border border-white/5 shadow-lg h-full">
                                    <h4 className="text-xl font-bold text-white mb-2">¿Alguien te recomendó el reto?</h4>
                                    <p className="text-white/80 text-base leading-relaxed mb-4">
                                        Escribe aquí el número de quien te invitó para agradecerle.
                                    </p>

                                    {!canRefer ? (
                                        <div className="p-4 bg-black/40 rounded-xl border border-white/10 text-center">
                                            <p className="text-white/50 text-base mb-1">🔒 Bloqueado</p>
                                            <p className="text-white/80 text-sm">Compra tu ticket primero.</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handlePreSubmit} className="flex flex-col gap-4">
                                            <div className="relative">
                                                <label className="text-white/70 text-xs mb-1 block uppercase tracking-wider font-bold">Número de Celular</label>
                                                <input
                                                    type="tel"
                                                    value={referralPhone}
                                                    onChange={(e) => setReferralPhone(e.target.value)}
                                                    placeholder="Ej: 3101234567"
                                                    disabled={loading}
                                                    className="w-full bg-white text-black border-2 border-transparent rounded-lg px-4 py-3 text-xl placeholder-gray-400 focus:outline-none focus:border-[#f8b134] focus:ring-4 focus:ring-[#f8b134]/30 transition-all font-mono tracking-wider text-center"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={loading || !referralPhone}
                                                className="w-full bg-[#f8b134] hover:bg-[#ffc863] text-black font-extrabold text-base md:text-lg py-3 rounded-lg transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide cursor-pointer"
                                            >
                                                {loading ? 'Verificando...' : 'Confirmar'}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SECTION 2: INVITE OTHERS */}
                        <div className={`flex flex-col gap-4 ${!user.referencia ? 'md:border-l border-white/10 md:pl-10 pt-6 md:pt-0 border-t md:border-t-0' : ''}`}>
                            {/* Inner Box - Solid for contrast */}
                            <div className="bg-[#1a1a1a] p-5 rounded-xl border border-white/5 h-full flex flex-col justify-between shadow-lg">
                                <div>
                                    <h4 className="text-xl font-bold text-white mb-2">Invita a tus amigos</h4>
                                    <p className="text-white/80 text-base leading-relaxed mb-4">
                                        Comparte tu número. ¡Ganas puntos por cada amigo!
                                    </p>
                                </div>

                                <div className="text-center flex flex-col items-center gap-4 mt-2">
                                    <div className="w-full bg-white/10 p-4 rounded-xl border border-white/10 shadow-inner">
                                        <p className="text-[#f8b134] text-xs uppercase tracking-widest font-bold mb-1">Tu Número</p>
                                        <span className="text-3xl md:text-4xl font-mono font-bold text-white tracking-widest drop-shadow-md block break-all">{user.phone}</span>
                                    </div>

                                    <button
                                        onClick={handleShare}
                                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebc57] text-white font-extrabold text-base md:text-lg py-3 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95 mt-1 uppercase tracking-wide group cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm group-hover:scale-110 transition-transform">
                                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                                        </svg>
                                        Invitar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
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
