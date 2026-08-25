import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';

interface Ticket {
    id: string;
    numeros_boleta: string;
    nombre_comprador: string;
    telefono_comprador: string;
    cantidad: number;
    medio_pago: string;
    fecha: string;
    receipt_url?: string;
}

interface ServerGoal {
    id: number;
    server_name: string;
    tickets_sold: Ticket[];
    avatar_url?: string;
    assigned_tickets?: number[];
}

interface ServerModalProps {
    serverData: ServerGoal;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ServerModal({ serverData, onClose, onSuccess }: ServerModalProps) {
    const [step, setStep] = useState<'question' | 'yes_flow' | 'no_flow' | 'history'>('question');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Avatar Upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // YES FLOW
    const [phoneToLink, setPhoneToLink] = useState('');

    // NO FLOW (No-Competidor)
    const [ncForm, setNcForm] = useState({ nombre_comprador: '', telefono_comprador: '', medio_pago: 'Efectivo' });
    const [ncSelectedTickets, setNcSelectedTickets] = useState<number[]>([]);
    const [ncReceiptFile, setNcReceiptFile] = useState<File | null>(null);
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
    
    const [availableTickets, setAvailableTickets] = useState<number[]>([]);
    const [globalSelectedTickets, setGlobalSelectedTickets] = useState<number[]>([]);

    // HISTORY FLOW
    const [viewReceiptId, setViewReceiptId] = useState<string | null>(null);

    useEffect(() => {
        if (serverData) {
            setStep('question');
            setPhoneToLink('');
            setNcSelectedTickets([]);
            setNcForm({ nombre_comprador: '', telefono_comprador: '', medio_pago: 'Efectivo' });
            setNcReceiptFile(null);
            setViewReceiptId(null);
            setGlobalSelectedTickets([]);
        }
    }, [serverData]);

    useEffect(() => {
        if (step === 'no_flow') {
            fetch('/api/availableTickets')
                .then(r => r.json())
                .then(data => {
                    if (data.available) setAvailableTickets(data.available);
                })
                .catch(e => console.error("Error fetching available tickets:", e));
        }
    }, [step]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_WIDTH = 300, MAX_HEIGHT = 300;
                    let width = img.width, height = img.height;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    canvas.width = width; canvas.height = height;
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/webp', 0.8));
                };
                img.onerror = () => reject(new Error("Error loading image"));
                const reader = new FileReader();
                reader.onload = (e) => img.src = e.target?.result as string;
                reader.readAsDataURL(file);
            });

            const res = await fetch('/api/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_avatar', server_name: serverData.server_name, avatar_url: dataUrl })
            });

            if (res.ok) onSuccess();
        } catch (error) {
            console.error("Error processing avatar:", error);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsUploadingAvatar(false);
        }
    };

    const handleLinkPhone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneToLink) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'link_phone', server_name: serverData.server_name, phone: phoneToLink })
            });
            const data = await res.json();
            if (res.ok) {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f8b134', '#ffffff'] });
                alert(`¡Venta reclamada con éxito! Comprador: ${data.user_name}`);
                setPhoneToLink('');
                setStep('history');
                onSuccess();
            } else {
                alert(data.error || 'Error al vincular la venta');
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddNoCompetitor = async (e: React.FormEvent) => {
        e.preventDefault();

        const ticketsToSubmit = [...ncSelectedTickets, ...globalSelectedTickets];

        if (ticketsToSubmit.length === 0 || !ncForm.nombre_comprador || !ncForm.telefono_comprador || !ncReceiptFile) {
            alert('Por favor completa el nombre, teléfono, selecciona al menos UNA boleta (fija o disponible) y sube el comprobante de pago.');
            return;
        }

        setIsSubmitting(true);
        setIsUploadingReceipt(true);
        try {
            const payload = {
                fileName: ncReceiptFile.name,
                fileType: ncReceiptFile.type,
                folder: 'tickets',
                username: 'admin_upload'
            };
            
            const presignRes = await fetch('/api/s3/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const { uploadUrl, publicUrl, success } = await presignRes.json();
            if (!success || !uploadUrl) throw new Error('Error obteniendo URL de subida');

            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': ncReceiptFile.type },
                body: ncReceiptFile
            });

            if (!uploadRes.ok) throw new Error('Error subiendo comprobante a S3');
            
            setIsUploadingReceipt(false);

            const costoTotal = ticketsToSubmit.length * 20000;

            const res = await fetch('/api/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register_no_competitor',
                    server_name: serverData.server_name,
                    ticket: {
                        numeros_boleta: ticketsToSubmit.join(', '),
                        nombre_comprador: ncForm.nombre_comprador,
                        telefono_comprador: ncForm.telefono_comprador,
                        cantidad: ticketsToSubmit.length,
                        medio_pago: ncForm.medio_pago,
                        costo_pagado: costoTotal, 
                        receipt_url: publicUrl
                    }
                })
            });

            if (res.ok) {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f8b134', '#ffffff'] });
                setNcSelectedTickets([]);
                setGlobalSelectedTickets([]);
                setNcForm({ nombre_comprador: '', telefono_comprador: '', medio_pago: 'Efectivo' });
                setNcReceiptFile(null);
                setStep('history');
                onSuccess();
            } else {
                const errData = await res.json();
                alert(errData.error || 'Error registrando venta');
            }
        } catch(e) {
             alert("Error registrando la venta.");
             setIsUploadingReceipt(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTicket = async (ticketId: string) => {
        if (!confirm('¿Seguro que quieres eliminar esta venta?')) return;
        try {
            const res = await fetch('/api/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_ticket', server_name: serverData.server_name, ticket_id: ticketId })
            });
            if (res.ok) onSuccess();
        } catch (e) {
            console.error("Error deleting ticket", e);
        }
    };

    // Calculate taken tickets among the assigned block
    const allSoldTicketNumbers = new Set(
        serverData.tickets_sold?.flatMap(t => t.numeros_boleta.split(',').map(n => parseInt(n.trim()))) || []
    );

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-[#1a0a0d] border border-[#f8b134]/40 w-full max-w-lg rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col max-h-[90vh]">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#f8b134] to-[#ffcc66]"></div>
                
                <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition bg-black/50 rounded-full p-1 z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {/* HEADER */}
                <div className="p-8 pb-4 shrink-0">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                            {serverData.avatar_url ? (
                                <img src={serverData.avatar_url} alt={serverData.server_name} className="w-16 h-16 rounded-full object-cover border-2 border-[#f8b134]" />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xl font-bold border-2 border-white/10 group-hover:border-[#f8b134]/50 transition">
                                    {serverData.server_name.substring(0,2).toUpperCase()}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            {isUploadingAvatar && (
                                <div className="absolute inset-0 bg-black/80 rounded-full flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-[#f8b134] border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-white/60 text-sm">Panel del Servidor</p>
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider">{serverData.server_name}</h3>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </div>
                    
                    {step !== 'question' && (
                        <button onClick={() => setStep('question')} className="text-[#f8b134] text-sm hover:underline flex items-center gap-1 mt-2">
                            ← Volver al inicio
                        </button>
                    )}
                </div>

                {/* CONTENT AREA */}
                <div className="p-8 pt-2 overflow-y-auto custom-scrollbar">
                    
                    {/* STEP: QUESTION */}
                    {step === 'question' && (
                        <div className="flex flex-col gap-6 pt-4">
                            <h4 className="text-center text-white text-xl font-bold mb-2">¿El comprador ya se registró en la página web del Reto?</h4>
                            <button 
                                onClick={() => setStep('yes_flow')}
                                className="bg-[#f8b134] text-black font-bold text-xl py-5 rounded-2xl shadow-[0_4px_15px_rgba(248,177,52,0.3)] hover:scale-105 transition transform flex flex-col items-center justify-center"
                            >
                                <span>SÍ</span>
                                <span className="text-xs text-black/70 font-normal mt-1">Ya es un competidor en la web</span>
                            </button>
                            <button 
                                onClick={() => setStep('no_flow')}
                                className="bg-white/10 text-white font-bold text-xl py-5 rounded-2xl border border-white/20 hover:bg-white/20 hover:scale-105 transition transform flex flex-col items-center justify-center"
                            >
                                <span>NO</span>
                                <span className="text-xs text-white/50 font-normal mt-1">Es nuevo o solo quiere comprar la boleta</span>
                            </button>

                            <div className="mt-6 pt-6 border-t border-white/10 flex justify-center">
                                <button 
                                    onClick={() => setStep('history')}
                                    className="text-white/60 flex items-center gap-2 hover:text-white transition uppercase text-sm font-bold tracking-widest"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Ver Boletas Vendidas ({serverData.tickets_sold?.length || 0})
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: YES (ALREADY REGISTERED) */}
                    {step === 'yes_flow' && (
                        <form onSubmit={handleLinkPhone} className="space-y-6">
                            <div className="bg-[#f8b134]/10 border border-[#f8b134]/30 rounded-2xl p-5 text-center">
                                <p className="text-[#f8b134] text-sm">
                                    Si el competidor ya se registró y eligió boleta, solo necesitas su <b>número de teléfono</b> para vincular la venta a tu nombre.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-white/70 uppercase tracking-widest mb-2">Teléfono del Competidor</label>
                                <input 
                                    type="tel" 
                                    required
                                    placeholder="Ej: 3001234567"
                                    value={phoneToLink}
                                    onChange={e => setPhoneToLink(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-white text-lg text-center outline-none focus:border-[#f8b134] focus:ring-1 focus:ring-[#f8b134] transition"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full bg-[#f8b134] hover:bg-[#ffcc66] text-black font-bold uppercase tracking-widest py-4 rounded-xl transition shadow-[0_0_15px_rgba(248,177,52,0.4)] flex justify-center items-center disabled:opacity-50"
                            >
                                {isSubmitting ? 'Buscando y Vinculando...' : 'Reclamar Venta'}
                            </button>
                        </form>
                    )}

                    {/* STEP: NO (NO-COMPETITOR) */}
                    {step === 'no_flow' && (
                        <form onSubmit={handleAddNoCompetitor} className="space-y-5">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-[#f8b134] uppercase tracking-widest mb-1">Nombre Completo</label>
                                    <input 
                                        type="text" required placeholder="¿Quién compra?"
                                        value={ncForm.nombre_comprador} onChange={e => setNcForm({...ncForm, nombre_comprador: e.target.value})}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#f8b134] transition"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-[#f8b134] uppercase tracking-widest mb-1">Teléfono</label>
                                        <input 
                                            type="tel" required placeholder="Requerido"
                                            value={ncForm.telefono_comprador} onChange={e => setNcForm({...ncForm, telefono_comprador: e.target.value})}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#f8b134] transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Pago Vía</label>
                                        <select 
                                            value={ncForm.medio_pago} onChange={e => setNcForm({...ncForm, medio_pago: e.target.value})}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#f8b134] transition"
                                        >
                                            <option value="Nequi">Nequi</option><option value="Efectivo">Efectivo</option>
                                            <option value="Daviplata">Daviplata</option><option value="Transferencia">Transferencia</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#f8b134] uppercase tracking-widest mb-2 text-center">Tus Boletas Fijas para Vender</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {serverData.assigned_tickets?.map(ticket => {
                                        const isSold = allSoldTicketNumbers.has(ticket);
                                        const isSelected = ncSelectedTickets.includes(ticket);
                                        return (
                                            <button
                                                key={ticket}
                                                type="button"
                                                disabled={isSold}
                                                onClick={() => {
                                                    setNcSelectedTickets(prev => 
                                                        prev.includes(ticket) ? prev.filter(t => t !== ticket) : [...prev, ticket].sort((a,b)=>a-b)
                                                    )
                                                }}
                                                className={`py-3 rounded-xl font-bold text-lg border transition ${
                                                    isSold ? 'bg-red-900/40 text-white/30 border-red-900/50 line-through cursor-not-allowed' :
                                                    isSelected ? 'bg-[#f8b134] text-black border-[#f8b134] shadow-[0_0_10px_#f8b134]' :
                                                    'bg-green-900/30 text-green-400 border-green-500/40 hover:bg-green-800/50'
                                                }`}
                                            >
                                                {ticket}
                                            </button>
                                        );
                                    })}
                                </div>
                                {!serverData.assigned_tickets || serverData.assigned_tickets.length === 0 && (
                                    <p className="text-white/50 text-center text-sm">No tienes boletas fijas asignadas aún.</p>
                                )}

                                <div className="flex flex-col items-center justify-center my-6 relative">
                                    <div className="absolute w-full h-px bg-white/10"></div>
                                    <span className="px-4 bg-[#1a0a0d] text-white/40 text-xs font-bold uppercase tracking-widest z-10">Boletas Globales</span>
                                </div>
                                
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[11px] font-bold text-[#f8b134] uppercase tracking-widest">Seleccionar boleta disponible</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (availableTickets.length === 0) return;
                                            const sample = availableTickets.slice(0, 30).join(", ");
                                            const text = `¡Hola! Aquí tienes algunas de las boletas que están disponibles en el sistema para participar del V Retiro Bartimeo (y la rifa):\n\n🎟️ ${sample} ...\n\nDime cuál te gusta para separártela. ¡Gracias por tu apoyo!`;
                                            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                                            window.open(url, '_blank');
                                        }}
                                        className="text-[10px] bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white transition px-2 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                        Compartir Libres
                                    </button>
                                </div>
                                <select 
                                    value=""
                                    onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : '';
                                        if (typeof val === 'number' && !globalSelectedTickets.includes(val)) {
                                            setGlobalSelectedTickets(prev => [...prev, val].sort((a,b)=>a-b));
                                        }
                                    }}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-white font-bold outline-none focus:border-[#f8b134] transition text-center"
                                >
                                    <option value="">-- Agregar Boleta Libre --</option>
                                    {availableTickets.map(t => (
                                        <option key={t} value={t} disabled={globalSelectedTickets.includes(t)}>Boleta #{t}</option>
                                    ))}
                                </select>
                                
                                {globalSelectedTickets.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {globalSelectedTickets.map(ticket => (
                                            <div key={ticket} className="flex items-center gap-1 bg-[#f8b134]/20 border border-[#f8b134]/40 text-[#f8b134] px-3 py-1.5 rounded-lg text-sm font-bold">
                                                #{ticket}
                                                <button 
                                                    type="button" 
                                                    onClick={() => setGlobalSelectedTickets(prev => prev.filter(t => t !== ticket))}
                                                    className="ml-1 text-[#f8b134]/50 hover:text-red-400 hover:scale-110 transition p-0.5"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-[#f8b134]/10 border border-[#f8b134]/30 rounded-xl p-3 flex justify-between items-center">
                                <span className="text-white/80 font-bold uppercase text-xs">Total a Pagar</span>
                                <span className="text-[#f8b134] font-[Titan_One] text-2xl">
                                    ${((ncSelectedTickets.length + globalSelectedTickets.length) * 20000).toLocaleString('es-CO')}
                                </span>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-white/70 uppercase tracking-widest mb-1 text-center">Comprobante de Pago</label>
                                <div className="relative border-2 border-dashed border-white/20 rounded-xl p-4 text-center hover:border-[#f8b134]/50 transition cursor-pointer overflow-hidden group">
                                    <input 
                                        type="file" required accept="image/*"
                                        onChange={(e) => setNcReceiptFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    {ncReceiptFile ? (
                                        <div className="text-green-400 text-sm font-bold flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                            {ncReceiptFile.name}
                                        </div>
                                    ) : (
                                        <div className="text-white/40 text-sm group-hover:text-white/60">
                                            <span className="block text-2xl mb-1">📸</span>
                                            Toca para subir la foto del pago
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting || isUploadingReceipt}
                                className="w-full bg-[#f8b134] hover:bg-[#ffcc66] text-black font-bold uppercase tracking-widest py-4 rounded-xl transition shadow-[0_0_15px_rgba(248,177,52,0.4)] flex justify-center items-center disabled:opacity-50"
                            >
                                {isSubmitting || isUploadingReceipt ? 'Registrando y Subiendo...' : 'Registrar Venta'}
                            </button>
                        </form>
                    )}

                    {/* STEP: HISTORY */}
                    {step === 'history' && (
                        <div className="space-y-4">
                            <h4 className="text-center text-white/80 text-sm font-bold uppercase tracking-widest border-b border-white/10 pb-2 mb-4">Boletas Vendidas ({serverData.tickets_sold?.length || 0})</h4>
                            
                            {(!serverData.tickets_sold || serverData.tickets_sold.length === 0) ? (
                                <div className="text-center py-10 text-white/30 text-sm">Aún no has registrado ninguna boleta.</div>
                            ) : (
                                <div className="space-y-3">
                                    {serverData.tickets_sold.map((ticket, index) => (
                                        <div key={ticket.id || index} className="bg-black/40 border border-white/10 rounded-xl p-4 group hover:border-white/20 transition flex flex-col">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[#f8b134] font-bold text-lg">#{ticket.numeros_boleta}</span>
                                                        <span className="bg-white/10 text-white/60 text-[10px] uppercase px-2 py-0.5 rounded-full">{ticket.medio_pago}</span>
                                                    </div>
                                                    <p className="text-white/90 font-bold text-sm uppercase tracking-wider">{ticket.nombre_comprador}</p>
                                                    {ticket.telefono_comprador && <p className="text-white/40 text-xs mt-0.5">{ticket.telefono_comprador}</p>}
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-2">
                                                    <button 
                                                        onClick={() => handleDeleteTicket(ticket.id)}
                                                        className="w-8 h-8 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-500 hover:text-white"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>

                                                    {ticket.receipt_url && (
                                                        <button 
                                                            onClick={() => setViewReceiptId(viewReceiptId === ticket.id ? null : ticket.id)}
                                                            className="text-[10px] text-[#f8b134] underline hover:text-white transition"
                                                        >
                                                            {viewReceiptId === ticket.id ? 'Ocultar Pago' : 'Ver Pago'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {viewReceiptId === ticket.id && ticket.receipt_url && (
                                                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center animate-fade-in">
                                                    <p className="text-xs text-white/40 mb-2">Comprobante de Pago</p>
                                                    <a href={ticket.receipt_url} target="_blank" rel="noopener noreferrer" className="block hover:scale-105 transition transform">
                                                        <img 
                                                            src={ticket.receipt_url} 
                                                            alt="Comprobante" 
                                                            className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-full border-2 border-[#f8b134] shadow-[0_0_10px_rgba(248,177,52,0.3)]"
                                                            loading="lazy" 
                                                        />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
