import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useRef, useState } from 'react';
import { loginUser, logoutUser, userStore } from '../store/userStore';

import { isLoginOpen } from '../store/uiStore';
import RegisterFlow from './RegisterFlow';

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
    const errorRef = useRef<HTMLDivElement>(null);
    const iframeSectionRef = useRef<HTMLDivElement>(null);

    // Registration & Upload State
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerPhone, setRegisterPhone] = useState('');
    const [referralPhone, setReferralPhone] = useState(''); // New state for referral
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isFileUploaded, setIsFileUploaded] = useState(false);
    const [isFormSubmitted, setIsFormSubmitted] = useState(false);

    const [showLoginFields, setShowLoginFields] = useState(false);

    // Hydration fix
    const [mounted, setMounted] = useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Iframe Handling
    const getInitialIframeHeight = () => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768 ? 8200 : 6900;
        }
        return 8000;
    };
    const [iframeHeight, setIframeHeight] = useState(getInitialIframeHeight);

    // Donation & Modal State
    const [isDonationMode, setIsDonationMode] = useState(false);

    const iframeLoadCount = useRef(0);
    
    const handleIframeLoad = () => {
        iframeLoadCount.current++;
        if (iframeLoadCount.current >= 2) {
            setIsFormSubmitted(true);
        }
    };

    React.useEffect(() => {
        // Expose to global scope for non-React components (e.g. Map.astro)
        (window as any).openLoginModule = () => {
            setIsDonationMode(false); // Reset to login mode
            isLoginOpen.set(true);
        };
        (window as any).openDonationModal = () => {
            setIsDonationMode(true); // Set to donation mode
            setShowRegisterFlow(true);
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
    const [showRegisterFlow, setShowRegisterFlow] = useState(false);
    const [showThankYou, setShowThankYou] = useState(false);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedData = localStorage.getItem('registerData');
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (parsed.step > 1 && parsed.step < 6) {
                        setShowRegisterFlow(true);
                    }
                } catch (e) {}
            }
        }
    }, []);

    
    const handleRegister = () => {
        setShowRegisterFlow(true);
    };

    const handleFinalSubmission = async () => {
        let hasError = false;
        setError('');

        if (!registerPhone || registerPhone.trim().length < 9) {
            setError('Por favor ingresa un teléfono válido');
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
        setShowRegisterFlow(true);
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

                {/* Register Flow Modal */}
                {showRegisterFlow && <RegisterFlow onClose={() => setShowRegisterFlow(false)} />}

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
