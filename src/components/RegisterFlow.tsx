import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loginUser } from '../store/userStore';

interface RegisterFlowProps {
    onClose: () => void;
}

export default function RegisterFlow({ onClose }: RegisterFlowProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [aiRetryCount, setAiRetryCount] = useState(0);
    const [isValidatingAI, setIsValidatingAI] = useState(false);
    const [aiForceInactive, setAiForceInactive] = useState(false);

    // Form Data
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [referral, setReferral] = useState('');

    // Tickets
    const [availableTickets, setAvailableTickets] = useState<number[]>([]);
    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);

    // Payment
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentValue, setPaymentValue] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [hasTransferred, setHasTransferred] = useState(false);

    // Config
    const [ticketPrice, setTicketPrice] = useState(20000);

    useEffect(() => {
        fetchAvailableTickets();
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/appConfig');
            if (res.ok) {
                const data = await res.json();
                if (data.ticket_price) {
                    setTicketPrice(data.ticket_price);
                }
            }
        } catch (e) {
            console.error("Error fetching config:", e);
        }
    };

    const fetchAvailableTickets = async () => {
        try {
            const res = await fetch('/api/availableTickets');
            const data = await res.json();
            if (data.success) {
                setAvailableTickets(data.available);
            }
        } catch (err) {
            console.error("Error fetching tickets", err);
        }
    };

    const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }
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
                            resolve(file);
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
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    };

    const handleNext = async () => {
        setError('');
        if (step === 1) {
            if (!name.trim() || !phone.trim()) {
                setError('Nombre y Teléfono son obligatorios.');
                return;
            }
            const cleanPhone = phone.replace(/\s+/g, '');
            if (!/^\+?\d{7,15}$/.test(cleanPhone)) {
                setError('Por favor, ingresa un número de teléfono válido (7 a 15 dígitos).');
                return;
            }
            if (referral) {
                const cleanReferral = referral.replace(/\s+/g, '');
                if (cleanReferral === cleanPhone) {
                    setError('Oye, no puedes usarte a ti mismo como referido 😉.');
                    return;
                }
            }
        } else if (step === 2) {
            if (selectedTickets.length === 0) {
                setError('Debes seleccionar al menos una boleta.');
                return;
            }
            
            // VERIFICAR CONCURRENCIA: Evitar que avancen si la boleta acaba de ser tomada
            setLoading(true);
            try {
                const res = await fetch('/api/checkTickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tickets: selectedTickets })
                });
                const data = await res.json();
                
                if (!data.success) {
                    setError(data.error || 'Una boleta seleccionada ya no está disponible.');
                    // Actualizar boletas disponibles inmediatamente
                    const resAvailable = await fetch('/api/tickets');
                    const dataAvailable = await resAvailable.json();
                    if (dataAvailable.success) {
                        setAvailableTickets(dataAvailable.available);
                        // Limpiar las que ya no están
                        setSelectedTickets(prev => prev.filter(t => dataAvailable.available.includes(t)));
                    }
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error("Error verificando boletas", err);
            }
            setLoading(false);
        } else if (step === 3) {
            if (!hasTransferred) {
                setError('Debes confirmar que ya realizaste la transferencia.');
                return;
            }
        } else if (step === 4) {
            if (!paymentMethod || !paymentValue.trim() || !receiptFile) {
                setError('El Valor transferido y comprobante son obligatorios.');
                return;
            }
            const numericValue = parseInt(paymentValue.replace(/\D/g, ''), 10);
            const totalRequired = selectedTickets.length * ticketPrice;
            if (isNaN(numericValue) || numericValue < totalRequired) {
                setError(`El valor transferido debe ser al menos de $${totalRequired.toLocaleString('es-CO')} por las ${selectedTickets.length} boletas.`);
                return;
            }

            // 1.5 Validate with Gemini AI
            if (paymentMethod !== 'Otros' && receiptFile) {
                setIsValidatingAI(true);
                
                // Play audio cue
                const audio = new Audio('/ia.mp3');
                audio.play().catch(e => console.log('Audio autoplay prevented:', e));

                try {
                    // Compress image before converting to base64
                    const compressedFile = await compressImage(receiptFile, 800, 0.6); // smaller dimensions and quality for faster AI

                    // Convert file to base64
                    const base64Data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(compressedFile);
                        reader.onload = () => {
                            if (typeof reader.result === 'string') {
                                resolve(reader.result.split(',')[1]);
                            } else {
                                reject('Failed to read file');
                            }
                        };
                        reader.onerror = error => reject(error);
                    });

                    const expectedAmount = selectedTickets.length * ticketPrice;
                    const aiController = new AbortController();
                    const aiTimeout = setTimeout(() => aiController.abort(), 25000); // 25 seconds timeout

                    const aiRes = await fetch('/api/gemini/validateReceipt', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            base64Image: base64Data, 
                            mimeType: receiptFile.type,
                            expectedAmount 
                        }),
                        signal: aiController.signal
                    });

                    clearTimeout(aiTimeout);
                    const aiData = await aiRes.json();
                    
                    if (aiData.success) {
                        if (!aiData.isValid) {
                            if (aiRetryCount < 2) {
                                setError(`🤖 IA Bartimeo: ${aiData.reason || 'El comprobante no es válido.'}`);
                                setReceiptFile(null);
                                setAiRetryCount(prev => prev + 1);
                                setIsValidatingAI(false);
                                return; // Detener flujo en paso 4
                            } else {
                                // Tercer fallo: dejar pasar pero inactivar
                                setAiForceInactive(true);
                            }
                        }
                    } else {
                        // Error de servidor (límite superado, API caída, etc.): dejar pasar pero inactivar
                        console.error("Fallo del servidor de la IA:", aiData.error);
                        setAiForceInactive(true);
                    }
                } catch (e: any) {
                    console.error("AI Validation Error or Timeout", e);
                    // Si hay error de red o timeout, dejar pasar pero ocultar
                    setAiForceInactive(true);
                } finally {
                    setIsValidatingAI(false);
                }
            }
        }
        setStep(s => s + 1);
    };

    const handlePrev = () => {
        setError('');
        setStep(s => s - 1);
    };

    const toggleTicket = (ticket: number) => {
        if (selectedTickets.includes(ticket)) {
            setSelectedTickets(selectedTickets.filter(t => t !== ticket));
        } else {
            // max 10 tickets per transaction to prevent abuse
            if (selectedTickets.length >= 10) {
                setError('Máximo 10 boletas por transacción.');
                return;
            }
            setSelectedTickets([...selectedTickets, ticket].sort((a, b) => a - b));
        }
    };

    const uploadReceiptToS3 = async (file: File) => {
        const payload = {
            fileName: file.name,
            fileType: file.type,
            folder: 'tickets',
            username: name
        };

        const res = await fetch('/api/s3/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const { uploadUrl, publicUrl, success } = await res.json();
        if (!success || !uploadUrl) throw new Error("Error obteniendo URL de subida");

        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        });
        
        if (!uploadRes.ok) throw new Error("Error subiendo el archivo al servidor");

        return publicUrl;
    };

    const handleSubmit = async () => {
        if (!acceptedTerms) {
            setError('Debes aceptar la política de tratamiento de datos.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Upload file
            let finalReceiptUrl = '';
            if (receiptFile) {
                const compressedFile = await compressImage(receiptFile);
                finalReceiptUrl = await uploadReceiptToS3(compressedFile);
                setReceiptUrl(finalReceiptUrl);
            }

            // 2. Register
            const res = await fetch('/api/registerUserTickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, phone, email, paymentMethod, paymentValue,
                    selectedTickets, receiptUrl: finalReceiptUrl, referral, forceInactive: aiForceInactive
                })
            });

            const data = await res.json();
            if (data.success) {
                // Auto-login after successful registration!
                await loginUser(phone);
                setStep(6); // Success step
            } else {
                setError(data.error || 'Error al registrar.');
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado.');
        } finally {
            setLoading(false);
            setIsValidatingAI(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 relative flex flex-col max-h-[90vh]"
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="flex-1 overflow-y-auto no-scrollbar relative">
                    {/* AI Validating Overlay */}
                    <AnimatePresence>
                        {isValidatingAI && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center rounded-xl border border-[#f8b134]/30"
                            >
                                <div className="relative flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 rounded-full border-4 border-[#f8b134]/20 border-t-[#f8b134] animate-spin mb-4" />
                                    <h3 className="text-xl font-bold text-[#f8b134] text-center px-4 font-mono animate-pulse">
                                        Bartimeo AI<br/>Analizando...
                                    </h3>
                                    <p className="text-white/50 text-xs mt-2">Revisando tu comprobante</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Header */}
                    {step < 5 && (
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2 font-['Outfit']">Registro al Reto ✨</h2>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className={`h-1.5 rounded-full flex-1 ${step >= i ? 'bg-[#f8b134]' : 'bg-white/20'}`} />
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {/* STEP 1: Datos Personales */}
                        {step === 1 && (
                            <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                                <p className="text-white/70 text-sm mb-4">Ingresa tus datos principales para agrupar tus boletas.</p>

                                <div>
                                    <label className="block text-sm uppercase tracking-wider text-white/80 font-bold mb-1.5">Nombre y Apellido *</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans" placeholder="Tu nombre completo" />
                                </div>

                                <div>
                                    <label className="block text-sm uppercase tracking-wider text-white/80 font-bold mb-1.5">Teléfono - WhatsApp *</label>
                                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans" placeholder="Ej. 3101234567" />
                                </div>

                                <div>
                                    <label className="block text-sm uppercase tracking-wider text-white/80 font-bold mb-1.5">Correo Electrónico (Opcional)</label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans" placeholder="Para recibir tu confirmación" />
                                </div>

                                <div>
                                    <label className="block text-sm uppercase tracking-wider text-[#f8b134] font-bold mb-1.5">Teléfono de la persona que te invitó (Opcional):</label>
                                    <input type="text" value={referral} onChange={e => setReferral(e.target.value)} className="w-full bg-[#f8b134]/5 border border-[#f8b134]/30 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans" placeholder="Número de quien te invitó" />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: Boletas */}
                        {step === 2 && (
                            <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                                <p className="text-white/70 text-sm mb-4">Elige tus boletas 🎟️. Toca para seleccionar. Puedes comprar las que quieras.</p>

                                <div className="bg-white/5 rounded-xl p-4 border border-white/10 h-64 overflow-y-auto no-scrollbar">
                                    <div className="grid grid-cols-5 gap-2">
                                        {availableTickets.length === 0 ? (
                                            <p className="col-span-5 text-center text-white/50 py-10">Cargando boletas...</p>
                                        ) : (
                                            availableTickets.map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => toggleTicket(num)}
                                                    className={`aspect-square rounded-lg flex items-center justify-center font-bold text-sm transition-all duration-300 ${selectedTickets.includes(num)
                                                            ? 'bg-gradient-to-br from-[#ffda8c] via-[#f8b134] to-[#dca336] text-black shadow-[0_0_20px_rgba(248,177,52,0.9)] scale-110 ring-2 ring-[#ffda8c] z-10'
                                                            : 'bg-white/10 text-white/80 hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                                                        }`}
                                                >
                                                    {num}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div className="bg-[#f8b134]/10 border border-[#f8b134]/30 rounded-xl p-3 flex justify-between items-center mt-2 shadow-[0_0_10px_rgba(248,177,52,0.1)]">
                                    <div>
                                        <p className="text-white/70 text-sm">Boletas: <strong className="text-white">{selectedTickets.length}</strong></p>
                                        <p className="text-white/70 text-xs mt-0.5">Aporte solidario:</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[#f8b134] font-bold text-2xl">${(selectedTickets.length * ticketPrice).toLocaleString('es-CO')}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: Pago */}
                        {step === 3 && (
                            <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                                <div className="bg-[#f8b134]/10 border border-[#f8b134]/30 rounded-xl p-4 mb-4 text-center">
                                    <p className="text-white/90 text-sm mb-2">
                                        Te agradecemos un aporte solidario de <strong className="text-[#f8b134] text-lg">${ticketPrice.toLocaleString('es-CO')}</strong> por boleta.
                                    </p>
                                    <p className="text-[#fbd07e] text-sm font-bold bg-[#722F37]/50 inline-block px-3 py-1 rounded-full mt-2 border border-[#f8b134]/20">
                                        Valor a transferir: ${(selectedTickets.length * ticketPrice).toLocaleString('es-CO')}
                                    </p>
                                </div>

                                <div className="bg-[#722F37] border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

                                    <p className="text-white/90 mb-4 text-xs font-medium text-center relative z-10">
                                        Transfiere por Nequi o Llave Bre-B al mismo número:
                                    </p>

                                    <div className="flex justify-center items-center gap-4 mb-4 relative z-10">
                                        <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                                            <img src="/nequi.png" alt="Nequi" className="h-6 object-contain drop-shadow-md" />
                                        </div>
                                        <div className="w-px h-6 bg-white/20"></div>
                                        <div className="flex items-center gap-2 bg-white/10 p-1.5 pr-3 rounded-lg backdrop-blur-sm">
                                            <span className="text-white font-bold text-sm drop-shadow-sm">BreB</span>
                                            <img src="/breve.avif" alt="Bre-B" className="h-4 object-contain rounded-full shadow-sm" />
                                        </div>
                                    </div>

                                    <div className="space-y-1 relative z-10 text-center mb-6">
                                        <p className="text-xs font-medium text-white/90 drop-shadow-md">Por favor transferir a Nicolas Borrero<br /><span className="text-[10px] text-white/70">(Líder Joven de Bartimeo)</span></p>
                                        <div
                                            className="bg-black/20 rounded-xl py-3 px-5 inline-block cursor-pointer hover:bg-black/30 transition-colors group active:scale-95 mt-2"
                                            onClick={() => { navigator.clipboard.writeText('3182004659'); alert('Copiado!'); }}
                                        >
                                            <p className="text-2xl font-mono text-[#f8b134] tracking-wider font-bold select-all copy-text group-hover:scale-105 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                                                3182004659
                                            </p>
                                            <div className="flex items-center justify-center gap-1 mt-1 text-white/60">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                <p className="text-[10px] uppercase tracking-widest font-bold">Toca para copiar</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative flex items-center justify-center mb-5 mt-2 z-10">
                                        <div className="w-full border-t border-white/20"></div>
                                        <div className="absolute px-3 bg-[#722F37] text-white/50 text-[10px] font-bold uppercase tracking-wider">O si prefieres</div>
                                    </div>

                                    <a
                                        href="https://checkout.nequi.wompi.co/l/VPOS_LoWyIu"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative z-10 w-full bg-white hover:bg-gray-100 text-[#722F37] font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group text-sm"
                                    >
                                        <span>Donar con Tarjeta o PSE (Wompi)</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                </div>

                                <div 
                                    className={`mt-6 p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 relative overflow-hidden ${hasTransferred ? 'bg-gradient-to-r from-[#ffda8c] via-[#f8b134] to-[#dca336] border-[#ffda8c] shadow-[0_0_30px_rgba(248,177,52,0.6)] scale-[1.02] ring-2 ring-[#ffda8c]/80' : 'bg-[#f8b134]/5 border-[#f8b134]/30 hover:bg-[#f8b134]/10 hover:border-[#f8b134]/50 shadow-lg'}`}
                                    onClick={() => setHasTransferred(!hasTransferred)}
                                    role="checkbox"
                                    aria-checked={hasTransferred}
                                    tabIndex={0}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${hasTransferred ? 'bg-black border-black' : 'bg-black/30 border-[#f8b134]/50'}`}>
                                        {hasTransferred && (
                                            <svg className="w-5 h-5 text-[#f8b134]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        )}
                                    </div>
                                    <span className={`text-base font-bold leading-tight ${hasTransferred ? 'text-black' : 'text-white'}`}>
                                        Sí, confirmo que ya realicé la transferencia del aporte
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 4: Detalles del Pago */}
                        {step === 4 && (
                            <motion.div key="step4" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                                <h3 className="text-xl font-bold text-white text-center mb-4">Detalles de tu aporte</h3>
                                
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Medio de Pago Usado *</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans appearance-none">
                                        <option value="" className="text-black">Selecciona uno...</option>
                                        <option value="Nequi" className="text-black">Nequi</option>
                                        <option value="Daviplata" className="text-black">Daviplata</option>
                                        <option value="Wompi" className="text-black">Wompi (Tarjeta/PSE)</option>
                                        <option value="Transferencia" className="text-black">Transferencia</option>
                                        <option value="Otros" className="text-black">Otros</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Valor Transferido *</label>
                                    <input type="text" value={paymentValue} onChange={e => setPaymentValue(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-[#f8b134]/50 focus:ring-1 focus:ring-[#f8b134]/50 transition-all font-sans" placeholder={`Ej. ${ticketPrice}`} />
                                </div>

                                <div>
                                    <label className="block text-sm uppercase tracking-wider text-white/80 font-bold mb-1.5 mt-4">Comprobante de Pago *</label>

                                    {receiptFile && (
                                        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-3 flex items-center gap-4">
                                            {receiptFile.type.startsWith('image/') ? (
                                                <img src={URL.createObjectURL(receiptFile)} alt="Preview" className="w-14 h-14 object-cover rounded-lg border border-white/20 shadow-sm" />
                                            ) : (
                                                <div className="w-14 h-14 bg-white/5 rounded-lg flex items-center justify-center border border-white/20 shadow-sm">
                                                    <svg className="w-7 h-7 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-green-400 text-base font-bold truncate">✅ {receiptFile.name}</p>
                                                <p className="text-white/60 text-xs mt-0.5">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setReceiptFile(null); }} 
                                                className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/30 hover:text-red-200 hover:scale-105 active:scale-95 rounded-lg transition-all border border-red-500/20 shadow-sm flex flex-col items-center justify-center gap-1" 
                                                title="Eliminar archivo"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                    )}

                                    {!receiptFile && (
                                        <label className="flex flex-col items-center justify-center w-full h-32 bg-[#f8b134]/5 border-2 border-[#f8b134]/40 border-dashed rounded-xl cursor-pointer hover:bg-[#f8b134]/10 hover:border-[#f8b134] transition-all group shadow-[0_0_15px_rgba(248,177,52,0.05)]">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <svg className="w-10 h-10 mb-3 text-[#f8b134] group-hover:scale-110 transition-transform drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                                <p className="mb-2 text-base text-white/90 font-medium"><span className="font-bold text-[#f8b134] underline decoration-[#f8b134]/50 underline-offset-4">Toca aquí para subir</span> imagen o PDF</p>
                                            </div>
                                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                                        </label>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 5: Confirmación */}
                        {step === 5 && (
                            <motion.div key="step4" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                                <h3 className="text-xl font-bold text-white text-center">Casi listo, {name.split(' ')[0]}</h3>
                                <p className="text-white/70 text-center text-sm mb-4">Revisa que tu información sea correcta.</p>

                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-white/50">Teléfono:</span> <span className="text-white">{phone}</span></div>
                                    <div className="flex justify-between"><span className="text-white/50">Boletas:</span> <span className="text-[#f8b134] font-bold">{selectedTickets.join(', ')}</span></div>
                                    <div className="flex justify-between"><span className="text-white/50">Medio:</span> <span className="text-white">{paymentMethod}</span></div>
                                    <div className="flex justify-between"><span className="text-white/50">Valor:</span> <span className="text-white">${paymentValue}</span></div>
                                </div>

                                <div 
                                    className={`mt-6 p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 relative overflow-hidden ${acceptedTerms ? 'bg-gradient-to-r from-[#ffda8c] via-[#f8b134] to-[#dca336] border-[#ffda8c] shadow-[0_0_30px_rgba(248,177,52,0.6)] scale-[1.02] ring-2 ring-[#ffda8c]/80' : 'bg-[#f8b134]/5 border-[#f8b134]/30 hover:bg-[#f8b134]/10 hover:border-[#f8b134]/50 shadow-lg'}`}
                                    onClick={() => setAcceptedTerms(!acceptedTerms)}
                                    role="checkbox"
                                    aria-checked={acceptedTerms}
                                    tabIndex={0}
                                >
                                    <div className={`w-6 h-6 mt-0.5 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${acceptedTerms ? 'bg-black border-black' : 'bg-black/30 border-[#f8b134]/50'}`}>
                                        {acceptedTerms && (
                                            <svg className="w-4 h-4 text-[#f8b134]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        )}
                                    </div>
                                    <span className={`text-xs leading-relaxed ${acceptedTerms ? 'text-black font-medium' : 'text-white/70'}`}>
                                        Autorizo de manera libre, expresa y voluntaria a los jóvenes del Retiro Bartimeo para recolectar, almacenar y usar mis datos personales con la finalidad exclusiva de gestionar mi proceso de inscripción y contactarme para temas relacionados con el Reto Bartimeo, de conformidad con la Ley 1581 de 2012. He leído y acepto la política de tratamiento de datos.
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 6: Éxito */}
                        {step === 6 && (
                            <motion.div key="step5" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 py-6">
                                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-2">¡Inscripción Exitosa! 🎉</h3>
                                    <p className="text-white/70">Tus boletas han sido reservadas. {email && 'Hemos enviado un correo de confirmación con tus códigos.'}</p>
                                </div>
                                <button onClick={onClose} className="w-full px-4 py-3 bg-[#f8b134] hover:bg-[#fbd07e] rounded-xl text-black font-bold transition-all shadow-lg hover:shadow-[#f8b134]/30">
                                    Ir al Tablero
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                {step < 6 && (
                    <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-3">
                        {error && (
                            <div className="p-5 bg-red-600/30 border-2 border-red-500 rounded-xl text-white font-bold text-lg flex flex-col items-center justify-center text-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse">
                                <span className="text-3xl">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}
                        <div className="flex gap-3">
                            {step > 1 && (
                                <button type="button" onClick={handlePrev} disabled={loading} className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium transition-all disabled:opacity-50">
                                    Volver
                                </button>
                            )}

                            {step < 5 ? (
                                <button type="button" onClick={handleNext} disabled={loading} className="flex-1 bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] text-black font-bold py-3 rounded-xl shadow-lg hover:shadow-[#f8b134]/20 transition-all flex justify-center items-center gap-2">
                                    Siguiente
                                </button>
                            ) : (
                                <button type="button" onClick={handleSubmit} disabled={loading || isValidatingAI} className="flex-1 bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] text-black font-bold py-3 rounded-xl shadow-lg hover:shadow-[#f8b134]/20 transition-all flex justify-center items-center gap-2 disabled:opacity-70">
                                    {isValidatingAI ? 'La IA está validando...' : loading ? 'Procesando...' : 'Finalizar Registro'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>

            {isValidatingAI && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center p-4">
                    <div className="relative w-64 h-64 mb-4 border-4 border-dashed border-[#f8b134] rounded-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-scanner-laser"></div>
                        {receiptFile ? (
                            <div className="w-full h-full flex items-center justify-center text-white">
                                <img src={URL.createObjectURL(receiptFile)} alt="Comprobante" className="w-full h-full object-cover opacity-50" />
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white">Escaneando...</div>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 text-center">Barti-IA Analizando...</h2>
                    <p className="text-gray-300 text-center text-sm max-w-xs mb-6">Verificando tu comprobante en tiempo real con Inteligencia Artificial.</p>
                    
                    {/* Barra de progreso visual */}
                    <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#f8b134] rounded-full" style={{ animation: 'aiProgress 25s linear forwards' }}></div>
                    </div>
                    <style dangerouslySetInnerHTML={{__html: `
                        @keyframes aiProgress {
                            0% { width: 0%; }
                            100% { width: 100%; }
                        }
                    `}} />
                </div>
            )}
        </div>
    );
}
