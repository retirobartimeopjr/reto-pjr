
import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { loginUser, logoutUser, userStore } from '../store/userStore';

import { isLoginOpen } from '../store/uiStore';

export default function LoginModule() {
    const isOpen = useStore(isLoginOpen);
    const user = useStore(userStore);

    // Local form state
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Initial check is handled by NanoStores automatically.

    React.useEffect(() => {
        // Expose to global scope for non-React components (e.g. Map.astro)
        (window as any).openLoginModule = () => isLoginOpen.set(true);
        return () => { delete (window as any).openLoginModule; };
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await loginUser(phone, code);

            if (result.success) {
                isLoginOpen.set(false);
                setPhone('');
                setCode('');
                window.location.reload(); // Hard reload to notify Astro islands if needed, or just let React update
            } else {
                setError(result.error || 'Credenciales inválidas');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logoutUser();
        window.location.reload();
    };

    return (
        <>
            {user.isAuthenticated !== 'true' ? (
                <button
                    onClick={() => isLoginOpen.set(true)}
                    className="px-5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-white text-sm font-sans font-medium transition-all duration-300 flex items-center gap-2 group cursor-pointer"
                >
                    <span>Ingresar</span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-[#f8b134] group-hover:text-[#fbd07e] transition-colors"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                        ></path>
                    </svg>
                </button>
            ) : (
                <button
                    onClick={handleLogout}
                    className="px-5 py-2 bg-red-500/10 hover:bg-red-500/30 backdrop-blur-md border border-red-500/30 rounded-full text-red-200 text-sm font-sans font-medium transition-all duration-300 flex items-center gap-2 group cursor-pointer"
                >
                    <span>Salir</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => isLoginOpen.set(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
                        >
                            {/* Decorative background gradient */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#f8b134] to-[#bf8418]" />

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-serif text-[#f8b134]">Iniciar Sesión</h3>
                                <button onClick={() => isLoginOpen.set(false)} className="text-white/50 hover:text-white transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Teléfono</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Ej. 123456789"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Código de Acceso</label>
                                    <input
                                        type="password"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="••••••"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all"
                                    />
                                    <p className="text-[10px] text-white/30 mt-1">Ingresa uno de los códigos de tus tickets (Tickets Fixed).</p>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {error}
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] text-black font-medium py-3 rounded-lg shadow-lg hover:shadow-[#f8b134]/20 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer"
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Validando...
                                            </>
                                        ) : (
                                            "Ingresar"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
