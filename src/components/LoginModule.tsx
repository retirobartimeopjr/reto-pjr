
import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState } from 'react';
import { loginUser, logoutUser, userStore } from '../store/userStore';

import { isLoginOpen } from '../store/uiStore';

import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../lib/firebase.client';

export default function LoginModule() {
    const isOpen = useStore(isLoginOpen);
    const user = useStore(userStore);

    // Local form state
    const [phone, setPhone] = useState('');

    // UI Feedback State
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showErrorHighlight, setShowErrorHighlight] = useState(false);
    const uploadSectionRef = useRef<HTMLDivElement>(null);

    // Registration & Upload State
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerPhone, setRegisterPhone] = useState('');
    const [referralPhone, setReferralPhone] = useState(''); // New state for referral
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isFileUploaded, setIsFileUploaded] = useState(false);

    const [showLoginFields, setShowLoginFields] = useState(false);

    // Hydration fix
    const [mounted, setMounted] = useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    // UI Feedback State
    // const uploadSectionRef = useRef<HTMLDivElement>(null); // MOVED UP
    // const [showErrorHighlight, setShowErrorHighlight] = useState(false); // MOVED UP
    // const [error, setError] = useState(''); // REMOVED DUPLICATE
    // const [loading, setLoading] = useState(false); // REMOVED DUPLICATE


    // Iframe Handling
    const getInitialIframeHeight = () => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 8200 : 6900;
        }
        return 8000;
    };
    const [iframeHeight, setIframeHeight] = useState(getInitialIframeHeight);

    // Donation & Modal State
    const [showTransferCheck, setShowTransferCheck] = useState(false);
    const [isDonationMode, setIsDonationMode] = useState(false);

    const iframeLoadCount = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const phoneInputRef = useRef<HTMLInputElement>(null);

    // Initial check is handled by NanoStores automatically.

    React.useEffect(() => {
        // Expose to global scope for non-React components (e.g. Map.astro)
        (window as any).openLoginModule = () => {
            setIsDonationMode(false); // Reset to login mode
            isLoginOpen.set(true);
        };
        (window as any).openDonationModal = () => {
            setIsDonationMode(true); // Set to donation mode
            setShowTransferCheck(true);
        };
        return () => {
            delete (window as any).openLoginModule;
            delete (window as any).openDonationModal;
        };
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await loginUser(phone);

            if (result.success) {
                isLoginOpen.set(false);
                setPhone('');
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
    const [isFormSubmitted, setIsFormSubmitted] = useState(false);
    const iframeSectionRef = useRef<HTMLDivElement>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    const handleRegister = () => {
        setIsFileUploaded(false);
        setIsFormSubmitted(false);
        setShowRegisterModal(true);
        setIframeHeight(getInitialIframeHeight());
        iframeLoadCount.current = 0;
    };

    const handleIframeLoad = () => {
        iframeLoadCount.current += 1;
        // La primera carga es el form, la segunda suele ser la confirmación de envío
        if (iframeLoadCount.current > 1) {
            setIframeHeight(500);
            setIsFormSubmitted(true);
        }
    };

    const handleFinalSubmission = async () => {

        let hasError = false;
        if (!registerPhone) {
            setError('Por favor ingresa tu número de teléfono');
            hasError = true;
        } else if (!selectedFile) {
            setError('Por favor selecciona tu comprobante');
            hasError = true;
        } else if (!isFormSubmitted) {
            setError('⚠️ Por favor completa y ENVÍA el formulario de Google (abajo 👇) para terminar.');
            hasError = true;
        }

        if (hasError) {
            setShowErrorHighlight(true);

            // Scroll logic
            if (!registerPhone || !selectedFile) {
                if (uploadSectionRef.current) {
                    uploadSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else if (!isFormSubmitted) {
                if (errorRef.current) {
                    errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            // Reset highlight after animation
            setTimeout(() => setShowErrorHighlight(false), 2000);
            return;
        }

        setUploading(true);
        setError('');

        // SUBMIT PENDING REFERRAL (If applicable)
        if (referralPhone && referralPhone.trim().length >= 10 && registerPhone !== referralPhone) {
            try {
                // Non-blocking call - we don't want to fail registration if referral fails
                fetch('/api/submitReferral', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: null, // New user
                        newUserPhone: registerPhone.trim(),
                        referralPhone: referralPhone.trim()
                    })
                }).then(res => res.json())
                    .then(data => console.log("[Registration] Referral submitted:", data))
                    .catch(err => console.error("[Registration] Referral submit error:", err));
            } catch (e) {
                console.error("Referral trigger error", e);
            }
        }

        try {
            // Create filename with phone number
            const fileExtension = selectedFile!.name.split('.').pop();
            const filename = `${registerPhone}_${Date.now()}.${fileExtension}`;
            const storageRef = ref(storage, `comprobantes/${filename}`);

            // Función para comprimir imagen en el cliente
            const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = event => {
                        const img = new Image();
                        img.src = event.target?.result as string;
                        img.onload = () => {
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > maxWidth) {
                                height = Math.round((height * maxWidth) / width);
                                width = maxWidth;
                            }
                            
                            const canvas = document.createElement('canvas');
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) ctx.drawImage(img, 0, 0, width, height);
                            
                            canvas.toBlob(blob => {
                                if (!blob) {
                                    reject(new Error('Canvas is empty'));
                                    return;
                                }
                                const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                                const compressedFile = new File([blob], newFileName, {
                                    type: 'image/webp',
                                    lastModified: Date.now(),
                                });
                                resolve(compressedFile);
                            }, 'image/webp', quality);
                        };
                        img.onerror = error => reject(error);
                    };
                    reader.onerror = error => reject(error);
                });
            };

            let fileToUpload = selectedFile!;

            try {
                if (fileToUpload.type.startsWith('image/')) {
                    fileToUpload = await compressImage(fileToUpload);
                }
            } catch(e) {
                console.error("Compression failed", e);
            }

            // Upload task
            const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

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

                    // Cleanup
                    setIsFileUploaded(false);
                    setSelectedFile(null);
                    setRegisterPhone('');
                    setReferralPhone('');
                    setUploadProgress(0);
                    setIframeHeight(getInitialIframeHeight());
                    iframeLoadCount.current = 0;
                    setIsFormSubmitted(false);
                }
            );

        } catch (err) {
            console.error(err);
            setError('Error iniciar la subida');
            setUploading(false);
        }
    };

    const handleStartRegisterFlow = () => {
        isLoginOpen.set(false); // Close login modal
        setIsDonationMode(false); // Reset to contribution mode
        setShowTransferCheck(true);
    };



    return (
        <>

            {!mounted || user.isAuthenticated !== 'true' ? (
                <div className="flex items-center gap-3">
                    <a
                        href="https://forms.gle/mxGXY55yQbdAEx5G9"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2 bg-[#f8b134] hover:bg-[#fbd07e] border border-[#f8b134] rounded-full text-[#3d0000] text-sm font-sans font-bold transition-all duration-300 flex items-center gap-2 group cursor-pointer shadow-[0_0_15px_rgba(248,177,52,0.3)] hover:shadow-[0_0_20px_rgba(248,177,52,0.5)] animate-heartbeat"
                    >
                        <span>¡Ir al Retiro!</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
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
                    </a>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <a
                        href="https://forms.gle/mxGXY55yQbdAEx5G9"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2 bg-[#f8b134] hover:bg-[#fbd07e] border border-[#f8b134] rounded-full text-[#3d0000] text-sm font-sans font-bold transition-all duration-300 flex items-center gap-2 group cursor-pointer shadow-[0_0_15px_rgba(248,177,52,0.3)] hover:shadow-[0_0_20px_rgba(248,177,52,0.5)] animate-heartbeat"
                    >
                        <span>¡Ir al Retiro!</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
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
                    </a>

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
                </div>
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
                                {!showLoginFields ? (
                                    <div className="space-y-4">
                                        <button
                                            type="button"
                                            onClick={handleStartRegisterFlow}
                                            className="w-full px-4 py-3 bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] border border-[#f8b134] rounded-xl text-[#3d0000] text-sm font-sans font-bold transition-all duration-300 flex justify-center items-center gap-2 group cursor-pointer shadow-[0_0_15px_rgba(248,177,52,0.3)] hover:shadow-[0_0_20px_rgba(248,177,52,0.5)] animate-soft-bounce"
                                        >
                                            <span>Registrarme</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginFields(true)}
                                            className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-sans font-bold transition-all duration-300 flex justify-center items-center"
                                        >
                                            <span>Ya me registré</span>
                                        </button>
                                        
                                        {/* Botón secundario para solicitar código */}
                                        <div className="pt-4 flex justify-center w-full">
                                            <a
                                                href="https://wa.me/573123415728?text=Hola%20Jesus%20:)%20Necesito%20ayuda%20con%20mi%20acceso%20a%20retirobartimeo.org%20Muchas%20gracias."
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] rounded-lg text-white text-sm font-bold transition-all duration-300 flex justify-center items-center gap-2 cursor-pointer group shadow-lg hover:shadow-[#25D366]/30 hover:-translate-y-0.5"
                                            >
                                                <img src="/wha.png" className="w-5 h-5 drop-shadow-md transition-transform group-hover:scale-110" alt="WhatsApp" />
                                                Solicitar Ayuda
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <button 
                                                type="button" 
                                                onClick={() => setShowLoginFields(false)}
                                                className="text-white/50 hover:text-white"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <span className="text-white/70 text-sm font-sans">Ingresa tus datos</span>
                                        </div>

                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Teléfono</label>
                                            <input
                                                type="text"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="Ej. 123456789"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans"
                                                autoFocus
                                            />
                                        </div>

                                        {error && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {error}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] text-black font-medium py-3 rounded-lg shadow-lg hover:shadow-[#f8b134]/20 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer mt-4"
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
                                )}
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* CONTRIBUTION INFO MODAL (Full Screen) */}
                {showTransferCheck && (
                    <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-lg text-center"
                        >
                            <div className="space-y-4 animate-in slide-in-from-bottom-8 fade-in duration-500">
                                <div className="mx-auto w-20 h-20 bg-[#f8b134]/10 rounded-full flex items-center justify-center border border-[#f8b134]/30 mb-3 shadow-[0_0_20px_rgba(248,177,52,0.2)]">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#f8b134]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>

                                <h2 className="text-2xl md:text-3xl font-serif text-[#f8b134] leading-tight font-bold">
                                    {isDonationMode ? 'Hacer una Donación' : 'Aporte Solidario'}
                                </h2>

                                <p className="text-white/90 text-base leading-relaxed max-w-md mx-auto">
                                    {isDonationMode
                                        ? <>Tu generosidad nos ayuda a seguir adelante. Puedes donar <span className="text-[#f8b134] font-bold">cualquier monto</span> que desees.</>
                                        : <>Para poder participar de este Reto pedimos un aporte de <span className="text-[#f8b134] font-bold">$20.000</span>.</>
                                    }
                                </p>

                                <div className="bg-[#722F37] p-5 rounded-2xl border border-white/10 max-w-sm mx-auto shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

                                    <p className="text-white/90 mb-4 text-sm relative z-10 font-medium text-center">
                                        {isDonationMode ? 'Puedes hacer tu donación por aquí:' : 'Puedes ayudarnos con tu transferencia por aquí:'}
                                    </p>

                                    <div className="flex justify-center items-center gap-6 mb-5 relative z-10">
                                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                                            <img src="/nequi.png" alt="Nequi" className="h-7 object-contain drop-shadow-md" />
                                        </div>
                                        <div className="w-px h-8 bg-white/20"></div>
                                        <div className="flex items-center gap-3 bg-white/10 p-2 pr-4 rounded-lg backdrop-blur-sm">
                                            <span className="text-white font-bold text-lg drop-shadow-sm">BreB</span>
                                            <img src="/breve.avif" alt="Bre-B" className="h-5 object-contain rounded-full shadow-sm" />
                                        </div>
                                    </div>

                                    <div className="space-y-1 relative z-10 text-center mb-5">
                                        <p className="text-base font-medium text-white/90 drop-shadow-md">Recibe: Nicolas Borrero</p>
                                        <div
                                            className="bg-black/20 rounded-xl py-2 px-4 inline-block cursor-pointer hover:bg-black/30 transition-colors group active:scale-95"
                                            onClick={() => { navigator.clipboard.writeText('3182004659'); alert('Copiado!'); }}
                                        >
                                            <p className="text-2xl font-mono text-[#f8b134] tracking-wider font-bold select-all copy-text group-hover:scale-105 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                                                3182004659
                                            </p>
                                            <p className="text-[9px] text-white/40 mt-0.5 uppercase tracking-widest font-bold">Toca para copiar</p>
                                        </div>
                                    </div>

                                    <a
                                        href="https://checkout.nequi.wompi.co/l/VPOS_LoWyIu"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative z-10 w-full mb-5 bg-white hover:bg-gray-100 text-[#722F37] font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group text-sm"
                                    >
                                        <span>Donar con Tarjeta o PSE (Wompi)</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>

                                    {/* <p className="text-[10px] text-white/50 pt-3 border-t border-white/10 italic relative z-10">
                                        Este número también tiene llave <span className="text-[#f8b134] font-bold">Bre-B</span> y es la misma llave para transferir.
                                    </p> */}
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-3 max-w-sm mx-auto">
                                    <button
                                        onClick={() => setShowTransferCheck(false)}
                                        className="py-2.5 px-6 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 font-medium transition-all text-sm"
                                    >
                                        {isDonationMode ? 'Cerrar' : 'Luego'}
                                    </button>

                                    {!isDonationMode && (
                                        <button
                                            onClick={() => {
                                                setShowTransferCheck(false);
                                                handleRegister();
                                            }}
                                            className="py-2.5 px-6 rounded-xl bg-[#f8b134] text-[#3d0000] font-bold hover:bg-[#fbd07e] shadow-[0_0_20px_rgba(248,177,52,0.3)] transition-all transform hover:scale-105 text-sm"
                                        >
                                            Siguiente
                                        </button>
                                    )}
                                </div>
                            </div>
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
                            onClick={() => {
                                setShowRegisterModal(false);
                                if (isFileUploaded) setShowThankYou(true);
                            }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative w-full max-w-2xl bg-[#1a1a1a] border border-[#f8b134]/30 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col custom-scrollbar"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/10 bg-[#1a1a1a] relative z-20 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-3xl font-serif text-[#f8b134]">Registro y Aporte</h3>
                                    <p className="text-white text-base font-medium mt-2 max-w-lg leading-relaxed">
                                        Para participar en el Reto, sube tu aporte y envía el formulario con las boletas que deseas. Cada boleta tiene un valor de <span className="text-[#f8b134] text-lg font-bold">$20.000</span>. ¡Gracias por tu generosidad! El Señor te bendiga 🙏✨
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowRegisterModal(false);
                                        if (isFileUploaded) setShowThankYou(true);
                                    }}
                                    className="text-white/50 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-6 space-y-8">
                                {/* File Upload Section */}
                                <div
                                    ref={uploadSectionRef}
                                    className={`bg-white/5 border border-dashed rounded-xl p-6 relative transition-all duration-300 ${showErrorHighlight
                                        ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-shake'
                                        : 'border-[#f8b134]/30 hover:border-[#f8b134]/60'
                                        }`}
                                >

                                    {/* Phone Input */}
                                    <div className="mb-6">
                                        <label className={`block text-sm uppercase tracking-wider mb-2 font-bold ${showErrorHighlight ? 'text-red-400' : 'text-[#f8b134]'}`}>Digita tu Teléfono</label>
                                        <input
                                            type="tel"
                                            value={registerPhone}
                                            onChange={(e) => setRegisterPhone(e.target.value)}
                                            placeholder="Ej. 3123415728"
                                            className={`w-full bg-black/20 border rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-all font-sans ${showErrorHighlight
                                                ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                                                : 'border-white/10 focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50'
                                                }`}
                                        />
                                    </div>

                                    {/* Referral Input (Optional) */}
                                    <div className="mb-6">
                                        <label className="block text-sm uppercase tracking-wider mb-2 font-bold text-[#f8b134]">
                                            Si alguien te recomendó el Reto, ingresa su número <span className="text-white/40 text-xs normal-case font-normal">(Opcional)</span>
                                        </label>
                                        <input
                                            type="tel"
                                            value={referralPhone}
                                            onChange={(e) => setReferralPhone(e.target.value)}
                                            placeholder="Ej. 3009876543"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans"
                                        />
                                    </div>

                                    <label className={`block text-sm uppercase tracking-wider mb-2 font-bold ${showErrorHighlight ? 'text-red-400' : 'text-[#f8b134]'}`}>
                                        Sube la foto/captura de tu comprobante de aporte solidario ($20.000)
                                    </label>

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
                                                className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${showErrorHighlight
                                                    ? 'border-red-500/50 bg-red-500/10 animate-pulse'
                                                    : 'border-[#f8b134]/40 bg-[#f8b134]/5 hover:bg-[#f8b134]/10 hover:border-[#f8b134]'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                                    <div className={`mb-3 p-3 rounded-full ${showErrorHighlight ? 'bg-red-500/20 text-red-400' : 'bg-[#f8b134]/20 text-[#f8b134] group-hover:scale-110 transition-transform'}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                        </svg>
                                                    </div>
                                                    <p className={`mb-1 text-lg font-bold transition-colors ${showErrorHighlight ? 'text-red-400' : 'text-white group-hover:text-[#f8b134]'}`}>
                                                        Toca aquí para subir el comprobante
                                                    </p>
                                                    <p className="text-sm text-white/50">Soporta Imágenes o PDF</p>
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

                                    {/* Error Anchor */}
                                    <div ref={errorRef} className="scroll-mt-4" />

                                    {/* Error Message */}
                                    {error && (
                                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {error}
                                        </div>
                                    )}
                                </div>

                                {/* Google Form Embed */}
                                <div
                                    ref={iframeSectionRef}
                                    className="rounded-xl overflow-hidden bg-white border border-white/10"
                                >
                                    <iframe
                                        src="https://docs.google.com/forms/d/e/1FAIpQLSeDOHKFcFTZQGiVIap5NReFMBbQH0WKXaQTNkrCsK9lll9JWw/viewform?embedded=true"
                                        width="100%"
                                        height={iframeHeight}
                                        onLoad={handleIframeLoad}
                                        frameBorder="0"
                                        marginHeight={0}
                                        marginWidth={0}
                                        className="w-full transition-all duration-500"
                                    >
                                        Cargando…
                                    </iframe>
                                </div>

                                {/* Finish Button */}
                                <div className="flex justify-center pb-4 pt-6">
                                    <button
                                        onClick={handleFinalSubmission}
                                        disabled={uploading}
                                        className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(22,163,74,0.3)] hover:shadow-[0_0_30px_rgba(22,163,74,0.5)] transition-all duration-300 transform hover:scale-105 flex items-center gap-3 w-full justify-center text-lg disabled:opacity-70 disabled:filter disabled:grayscale"
                                    >
                                        {uploading ? (
                                            <>
                                                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>Subiendo ({Math.round(uploadProgress)}%)...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>¡Listo! Ya envié todo</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </>
                                        )}
                                    </button>

                                    {uploading && (
                                        <p className="text-white/50 text-sm animate-pulse text-center mt-2">
                                            Por favor espera mientras guardamos tu comprobante...
                                        </p>
                                    )}
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
                                Cada aporte cuenta. Si has completado todos los pasos, podrás ingresar con tu teléfono en 30 segundos. Si no es así, escríbenos por WhatsApp para obtener ayuda.
                            </p>

                            <a
                                href="https://wa.me/573123415728?text=Hola%20Jesus%20%3A)%20Necesito%20ayuda%20con%20mi%20acceso%20a%20retirobartimeo.org%20Muchas%20gracias"
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
