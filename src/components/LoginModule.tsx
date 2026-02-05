
import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { loginUser, logoutUser, userStore } from '../store/userStore';

import { isLoginOpen } from '../store/uiStore';

import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../lib/firebase.client';

export default function LoginModule() {
    const isOpen = useStore(isLoginOpen);
    const user = useStore(userStore);

    // Local form state
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Registration & Upload State
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerPhone, setRegisterPhone] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

    // Register flow state
    const [showThankYou, setShowThankYou] = useState(false);

    const handleRegister = () => {
        setShowRegisterModal(true);
    };

    const handleFileUpload = async () => {
        if (!selectedFile) return;
        if (!registerPhone) {
            setError('Por favor ingresa tu número de teléfono');
            return;
        }
        setUploading(true);
        setError('');

        try {
            // Create filename with phone number
            const fileExtension = selectedFile.name.split('.').pop();
            const filename = `${registerPhone}_${Date.now()}.${fileExtension}`;
            const storageRef = ref(storage, `comprobantes/${filename}`);

            // Upload task
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload error:", error);
                    let msg = 'Error al subir el archivo';
                    if (error.code === 'storage/unauthorized') {
                        msg = 'Permiso denegado. Revisa las reglas de Storage en Firebase Console.';
                    } else if (error.message) {
                        msg = `Error: ${error.message}`;
                    }
                    setError(msg);
                    setUploading(false);
                },
                async () => {
                    // Upload completed successfully
                    setUploading(false);
                    setShowRegisterModal(false);
                    setShowThankYou(true);
                    setSelectedFile(null);
                    setRegisterPhone('');
                    setUploadProgress(0);
                }
            );

        } catch (err) {
            console.error(err);
            setError('Error iniciar la subida');
            setUploading(false);
        }
    };

    return (
        <>
            {user.isAuthenticated !== 'true' ? (
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRegister}
                        className="px-4 py-1.5 bg-[#f8b134] hover:bg-[#fbd07e] border border-[#f8b134] rounded-full text-[#3d0000] text-xs font-sans font-bold transition-all duration-300 flex items-center gap-2 group cursor-pointer shadow-[0_0_15px_rgba(248,177,52,0.3)] hover:shadow-[0_0_20px_rgba(248,177,52,0.5)] animate-stretch-jump"
                    >
                        <span>Registrarme Quiero Apoyar!</span>
                    </button>

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
                </div>
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
                {/* Login Modal */}
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
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Código de Acceso</label>
                                    <input
                                        type="password"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="••••••"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans"
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

                                    {/* Botón secundario para solicitar código */}
                                    <div className="pt-4 flex justify-center w-full">
                                        <a
                                            href={`https://wa.me/573123415728?text=${encodeURIComponent(
                                                `Hola Jesus :) Quiero solicitar mi Código de Acceso Único. Muchas gracias. Este es mi numero de telefono para que puedas consultar ${phone}`
                                            )}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => {
                                                if (!phone) {
                                                    e.preventDefault();
                                                    setError("Por favor ingresa tu teléfono para solicitar el código");
                                                }
                                            }}
                                            className="w-full py-3 border border-[#f8b134]/30 bg-[#f8b134]/5 hover:bg-[#f8b134]/10 rounded-lg text-[#f8b134] text-sm font-medium transition-all duration-300 flex justify-center items-center gap-2 cursor-pointer group"
                                        >
                                            <img src="/wha.png" className="w-5 h-5 drop-shadow-md transition-transform group-hover:scale-110" alt="WhatsApp" />
                                            Solicitar código por WhatsApp
                                        </a>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Registration Modal */}
                {showRegisterModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowRegisterModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative w-full max-w-2xl bg-[#1a1a1a] border border-[#f8b134]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/10 bg-[#1a1a1a] relative z-20 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-xl font-serif text-[#f8b134]">Registro y Aporte</h3>
                                    <p className="text-white/50 text-xs mt-1">Completa el formulario y adjunta tu comprobante.</p>
                                </div>
                                <button
                                    onClick={() => setShowRegisterModal(false)}
                                    className="text-white/50 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="overflow-y-auto overflow-x-hidden p-6 space-y-8 custom-scrollbar">
                                {/* File Upload Section */}
                                <div className="bg-white/5 border border-dashed border-[#f8b134]/30 rounded-xl p-6 relative">

                                    {/* Phone Input */}
                                    <div className="mb-6">
                                        <label className="block text-xs uppercase tracking-wider text-[#f8b134] mb-2 font-bold">1. Tu Teléfono (Para identificar tu pago)</label>
                                        <input
                                            type="tel"
                                            value={registerPhone}
                                            onChange={(e) => setRegisterPhone(e.target.value)}
                                            placeholder="Ej. 3123415728"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans"
                                        />
                                    </div>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="p-3 bg-[#f8b134]/10 rounded-lg text-[#f8b134]">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-medium text-white mb-1">2. Foto/Captura - Comprobante de Aporte 🙏🏼</h4>
                                            <p className="text-white/50 text-sm">
                                                Sube aquí la captura o PDF de tu aporte. <br />
                                                <span className="text-[#f8b134]/70 text-xs">Máximo 10MB (Imagen o PDF)</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* File Input */}
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="file-upload"
                                            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setSelectedFile(e.target.files[0]);
                                                }
                                            }}
                                            className="hidden"
                                        />

                                        {!selectedFile ? (
                                            <label
                                                htmlFor="file-upload"
                                                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 hover:border-[#f8b134]/50 rounded-lg cursor-pointer bg-black/20 hover:bg-black/40 transition-all group"
                                            >
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <p className="mb-2 text-sm text-white/70 group-hover:text-white transition-colors">
                                                        <span className="font-semibold">Clic para subir archivo</span>
                                                    </p>
                                                    <p className="text-xs text-white/40">SVG, PNG, JPG o PDF</p>
                                                </div>
                                            </label>
                                        ) : (
                                            <div className="flex items-center justify-between p-4 bg-[#f8b134]/10 border border-[#f8b134]/30 rounded-lg">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="p-2 bg-[#f8b134]/20 rounded text-[#f8b134]">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                                                        <p className="text-xs text-white/50">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedFile(null)}
                                                    className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload Progress */}
                                    {uploading && (
                                        <div className="mt-4">
                                            <div className="flex justify-between text-xs text-white/70 mb-1">
                                                <span>Subiendo...</span>
                                                <span>{Math.round(uploadProgress)}%</span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-[#f8b134] h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {error && (
                                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {error}
                                        </div>
                                    )}

                                    {/* Submit Button */}
                                    <div className="mt-6 flex justify-end">
                                        <button
                                            onClick={handleFileUpload}
                                            disabled={!selectedFile || uploading}
                                            className="bg-[#f8b134] hover:bg-[#fbd07e] text-[#3d0000] font-bold py-2.5 px-6 rounded-lg shadow-lg hover:shadow-[#f8b134]/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {uploading ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Procesando...
                                                </>
                                            ) : (
                                                <>
                                                    <span>Confirmar y Enviar</span>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                    </svg>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Google Form Embed */}
                                <div className="rounded-xl overflow-hidden bg-white border border-white/10">
                                    <iframe
                                        src="https://docs.google.com/forms/d/e/1FAIpQLSeDOHKFcFTZQGiVIap5NReFMBbQH0WKXaQTNkrCsK9lll9JWw/viewform?embedded=true"
                                        width="100%"
                                        height="600"
                                        frameBorder="0"
                                        marginHeight={0}
                                        marginWidth={0}
                                        className="w-full"
                                    >
                                        Cargando…
                                    </iframe>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Thank You Modal */}
                {showThankYou && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowThankYou(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-[#1a1a1a] border border-[#f8b134]/30 rounded-2xl p-8 shadow-[0_0_50px_rgba(248,177,52,0.15)] text-center overflow-hidden"
                        >
                            {/* Decorative elements */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#f8b134] via-[#fbd07e] to-[#bf8418]" />
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f8b134]/10 rounded-full blur-2xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#f8b134]/5 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Bouncing Logo */}
                            <div className="relative mb-6 flex justify-center">
                                <div className="absolute inset-0 bg-[#f8b134]/20 blur-xl rounded-full scale-75 animate-pulse"></div>
                                <img
                                    src="/bartimeo-logo.png"
                                    className="w-24 h-auto relative z-10 animate-bounce drop-shadow-[0_0_15px_rgba(248,177,52,0.5)]"
                                    alt="Bartimeo"
                                />
                            </div>

                            <h3 className="text-2xl font-serif text-[#f8b134] mb-3 leading-tight">
                                ¡Muchas gracias por todo tu apoyo!
                            </h3>

                            <p className="text-white/80 text-sm mb-6 leading-relaxed">
                                Cada aporte cuenta. Revisa el correo que digitaste para obtener tu código de acceso o escríbenos directamente para obtenerlo.
                            </p>

                            <a
                                href="https://wa.me/573123415728?text=Hola%20Jesus%20%3A)%20Quiero%20solicitar%20mi%20C%C3%B3digo%20de%20Acceso%20%C3%9Anico.%20Muchas%20gracias"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium px-6 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-[#25D366]/30 hover:-translate-y-1 group"
                            >
                                <img src="/wha.png" className="w-5 h-5 drop-shadow-md" alt="WhatsApp" />
                                <span>Escribir por WhatsApp</span>
                            </a>

                            <button
                                onClick={() => setShowThankYou(false)}
                                className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence >
        </>
    );
}
