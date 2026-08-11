import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';

interface Ticket {
    id: string;
    numeros_boleta: string;
    nombre_comprador: string;
    telefono_comprador: string;
    cantidad: number;
    medio_pago: string;
    fecha: string;
}

interface ServerGoal {
    id: number;
    server_name: string;
    tickets_sold: Ticket[];
    avatar_url?: string;
}

export default function MetasReto() {
    const [servers, setServers] = useState<ServerGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal state for adding ticket
    const [selectedServer, setSelectedServer] = useState<string | null>(null);
    const [ticketForm, setTicketForm] = useState({
        numeros_boletas: [''],
        nombre_comprador: '',
        telefono_comprador: '',
        medio_pago: 'Nequi'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [modalTab, setModalTab] = useState<'register' | 'history' | 'no_competitor'>('register');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // No-Competitor States
    const [availableTickets, setAvailableTickets] = useState<number[]>([]);
    const [ncSelectedTickets, setNcSelectedTickets] = useState<number[]>([]);
    const [ncForm, setNcForm] = useState({
        nombre_comprador: '',
        medio_pago: 'Efectivo',
        costo_pagado: ''
    });
    const [ncReceiptFile, setNcReceiptFile] = useState<File | null>(null);
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

    const fetchServers = async () => {
        try {
            const res = await fetch('/api/servidores');
            const data = await res.json();
            if (data.success) {
                setServers(data.data);
            }
        } catch (error) {
            console.error("Error fetching servers:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
    }, []);

    useEffect(() => {
        if (selectedServer && modalTab === 'no_competitor') {
            const fetchAv = async () => {
                try {
                    const res = await fetch('/api/availableTickets');
                    const data = await res.json();
                    if (data.success) {
                        setAvailableTickets(data.available || []);
                    }
                } catch(e){}
            };
            fetchAv();
        }
    }, [selectedServer, modalTab]);

    const suggestedTickets = useMemo(() => {
        if (!selectedServer) return [];
        const sIndex = servers.findIndex(s => s.server_name === selectedServer);
        const idx = sIndex === -1 ? 0 : sIndex;
        
        const above300 = availableTickets.filter(t => t >= 300).sort((a,b) => a-b);
        const candidates = above300.length > 0 ? above300 : availableTickets.sort((a,b) => a-b);
        if (candidates.length === 0) return [];
        
        const startIndex = (idx * 10) % candidates.length;
        const suggested = [];
        for (let i = 0; i < 10; i++) {
            suggested.push(candidates[(startIndex + i) % candidates.length]);
        }
        return [...new Set(suggested)].sort((a,b) => a-b);
    }, [availableTickets, servers, selectedServer]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedServer) return;

        setIsUploadingAvatar(true);
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const MAX_WIDTH = 300;
                    const MAX_HEIGHT = 300;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx?.drawImage(img, 0, 0, width, height);
                    
                    resolve(canvas.toDataURL('image/webp', 0.8));
                };
                img.onerror = () => reject(new Error("Error loading image"));
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target?.result as string;
                };
                reader.onerror = () => reject(new Error("Error reading file"));
                reader.readAsDataURL(file);
            });

            const res = await fetch('/api/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_avatar',
                    server_name: selectedServer,
                    avatar_url: dataUrl
                })
            });

            if (!res.ok) {
                console.error("API error", await res.text());
                throw new Error("API failed");
            }

            fetchServers();
        } catch (error) {
            console.error("Error processing avatar:", error);
            // reset value so they can try again
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsUploadingAvatar(false);
        }
    };

    const handleAddTicketNumber = () => {
        setTicketForm({
            ...ticketForm,
            numeros_boletas: [...ticketForm.numeros_boletas, '']
        });
    };

    const handleTicketNumberChange = (index: number, value: string) => {
        const newNumeros = [...ticketForm.numeros_boletas];
        newNumeros[index] = value;
        setTicketForm({ ...ticketForm, numeros_boletas: newNumeros });
    };

    const handleRemoveTicketNumber = (index: number) => {
        const newNumeros = ticketForm.numeros_boletas.filter((_, i) => i !== index);
        setTicketForm({ ...ticketForm, numeros_boletas: newNumeros });
    };

    const handleAddTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        const validBoletas = ticketForm.numeros_boletas.filter(n => n.trim() !== '');
        
        if (!selectedServer || !ticketForm.nombre_comprador || validBoletas.length === 0) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'add_ticket', 
                    server_name: selectedServer,
                    ticket: {
                        numeros_boleta: validBoletas.join(', '),
                        nombre_comprador: ticketForm.nombre_comprador,
                        telefono_comprador: ticketForm.telefono_comprador,
                        cantidad: validBoletas.length,
                        medio_pago: ticketForm.medio_pago
                    }
                })
            });
            
            if (res.ok) {
                // Check if they reached the goal (10 tickets)
                const serverData = servers.find(s => s.server_name === selectedServer);
                const currentTickets = serverData?.tickets_sold.reduce((acc, t) => acc + t.cantidad, 0) || 0;
                
                if (currentTickets + validBoletas.length >= 10) {
                    // Celebrate!
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#f8b134', '#ffffff', '#640010']
                    });
                }

                setTicketForm({ numeros_boletas: [''], nombre_comprador: '', telefono_comprador: '', medio_pago: 'Nequi' });
                setModalTab('history');
                fetchServers(); // refresh list
            }
        } catch (e) {
            console.error("Error adding ticket", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTicketSelection = (ticketNumber: number) => {
        setNcSelectedTickets(prev => 
            prev.includes(ticketNumber) ? prev.filter(t => t !== ticketNumber) : [...prev, ticketNumber].sort((a,b)=>a-b)
        );
    };

    const handleAddNoCompetitor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedServer || ncSelectedTickets.length === 0 || !ncForm.nombre_comprador || !ncReceiptFile || !ncForm.costo_pagado) {
            alert('Por favor completa todos los campos, selecciona al menos una boleta y sube el comprobante.');
            return;
        }

        setIsSubmitting(true);
        setIsUploadingReceipt(true);
        try {
            // Subir comprobante
            const formData = new FormData();
            formData.append('file', ncReceiptFile);
            
            const uploadRes = await fetch('/api/s3/upload', { method: 'POST', body: formData });
            if (!uploadRes.ok) throw new Error('Error subiendo comprobante');
            
            const uploadData = await uploadRes.json();
            if (!uploadData.url) throw new Error('URL no devuelta por el servidor');
            
            setIsUploadingReceipt(false);

            const res = await fetch('/api/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register_no_competitor',
                    server_name: selectedServer,
                    ticket: {
                        numeros_boleta: ncSelectedTickets.join(', '),
                        nombre_comprador: ncForm.nombre_comprador,
                        cantidad: ncSelectedTickets.length,
                        medio_pago: ncForm.medio_pago,
                        costo_pagado: parseFloat(ncForm.costo_pagado),
                        receipt_url: uploadData.url
                    }
                })
            });

            if (res.ok) {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f8b134', '#ffffff', '#640010'] });
                setNcSelectedTickets([]);
                setNcForm({ nombre_comprador: '', medio_pago: 'Efectivo', costo_pagado: '' });
                setNcReceiptFile(null);
                setModalTab('history');
                fetchServers();
            } else {
                const errData = await res.json();
                alert(errData.error || 'Error registrando venta');
            }
        } catch(e) {
             console.error("Error", e);
             alert("Error registrando la venta. Revisa la consola.");
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
                body: JSON.stringify({ action: 'delete_ticket', server_name: selectedServer, ticket_id: ticketId })
            });
            if (res.ok) {
                fetchServers();
            }
        } catch (e) {
            console.error("Error deleting ticket", e);
        }
    };

    const serversWithRank = useMemo(() => {
        const sorted = servers.slice().sort((a, b) => {
            const aTotal = a.tickets_sold?.reduce((sum, t) => sum + t.cantidad, 0) || 0;
            const bTotal = b.tickets_sold?.reduce((sum, t) => sum + t.cantidad, 0) || 0;
            if (bTotal !== aTotal) return bTotal - aTotal;
            return a.server_name.localeCompare(b.server_name);
        });
        
        return sorted.map((s, index) => {
            const totalTickets = s.tickets_sold?.reduce((acc, t) => acc + t.cantidad, 0) || 0;
            return {
                ...s,
                totalTickets,
                rank: totalTickets > 0 ? index + 1 : null
            };
        });
    }, [servers]);

    const filteredServers = useMemo(() => {
        return serversWithRank.filter(s => s.server_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [serversWithRank, searchQuery]);

    const totalTicketsSold = useMemo(() => {
        return servers.reduce((acc, s) => {
            return acc + (s.tickets_sold?.reduce((sum, t) => sum + t.cantidad, 0) || 0);
        }, 0);
    }, [servers]);

    const GLOBAL_GOAL = 300;
    const globalProgress = Math.min((totalTicketsSold / GLOBAL_GOAL) * 100, 100);

    if (loading) {
        return <div className="text-center py-20 text-white/50 text-xl animate-pulse">Cargando servidores y metas...</div>;
    }

    const selectedServerData = servers.find(s => s.server_name === selectedServer);

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {/* Cabecera y Contador Global */}
            <div className="bg-black/50 backdrop-blur-md border border-[#f8b134]/30 rounded-3xl p-8 mb-10 shadow-[0_0_40px_rgba(248,177,52,0.15)] text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#f8b134]/10 to-transparent pointer-events-none"></div>
                <h2 className="text-4xl md:text-5xl font-[Titan_One] text-white mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Meta Global Reto</h2>
                <p className="text-[#f8b134] text-lg font-medium mb-6 font-mono tracking-widest uppercase">¡Juntos somos Bartimeo!</p>
                
                <div className="max-w-2xl mx-auto px-4">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <span className="text-white/80 font-bold">Progreso Total</span>
                        <span className="text-3xl font-bold text-[#f8b134]">{totalTicketsSold} <span className="text-lg text-white/50">/ {GLOBAL_GOAL}</span></span>
                    </div>
                    <div className="relative pt-6">
                        <div className="h-6 bg-black/60 rounded-full overflow-hidden border border-white/10 p-1 relative z-0">
                            <div 
                                className="h-full rounded-full bg-gradient-to-r from-[#e09e2b] to-[#f8b134] relative shadow-[0_0_15px_#f8b134]"
                                style={{ width: `${globalProgress}%`, transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                            >
                                <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }}></div>
                            </div>
                        </div>
                        <div 
                            className="absolute top-0 -ml-5 z-10 transition-all duration-1000 ease-out"
                            style={{ left: `${globalProgress}%` }}
                        >
                            <img src="/bartimeo-logo.png" alt="Bartimeo" className="w-12 h-12 drop-shadow-[0_0_12px_rgba(248,177,52,0.9)] object-contain" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Buscador */}
            <div className="mb-8 relative max-w-xl mx-auto">
                <input 
                    type="text" 
                    placeholder="🔍 Buscar servidor por nombre..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/60 backdrop-blur-sm border border-white/20 rounded-full px-6 py-4 text-white text-lg outline-none focus:border-[#f8b134] focus:ring-2 focus:ring-[#f8b134]/50 transition shadow-lg placeholder:text-white/40"
                />
            </div>

            {/* Cuadrícula Densa de Servidores */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredServers.map(server => {
                    const totalTickets = server.totalTickets;
                    const percentage = Math.min((totalTickets / 10) * 100, 100);
                    const isGoalMet = totalTickets >= 10;
                    
                    let podiumClass = "bg-[#300006]/80 border-white/10 hover:bg-[#4a000a] hover:border-[#f8b134]/50";
                    let rankBadge = null;

                    if (server.rank === 1) {
                        podiumClass = "bg-gradient-to-b from-[#4a3600]/90 to-[#221800]/90 border-[#f8b134] shadow-[0_0_15px_rgba(248,177,52,0.3)] hover:shadow-[0_0_25px_rgba(248,177,52,0.5)] transform hover:-translate-y-1";
                        rankBadge = <div className="absolute -top-3 -right-3 text-4xl drop-shadow-lg z-10" title="1er Puesto">🥇</div>;
                    } else if (server.rank === 2) {
                        podiumClass = "bg-gradient-to-b from-[#2a2a2a]/90 to-[#111111]/90 border-[#c0c0c0] shadow-[0_0_15px_rgba(192,192,192,0.2)] hover:shadow-[0_0_25px_rgba(192,192,192,0.4)] transform hover:-translate-y-1";
                        rankBadge = <div className="absolute -top-3 -right-3 text-4xl drop-shadow-lg z-10" title="2do Puesto">🥈</div>;
                    } else if (server.rank === 3) {
                        podiumClass = "bg-gradient-to-b from-[#3a2010]/90 to-[#1a0e05]/90 border-[#cd7f32] shadow-[0_0_15px_rgba(205,127,50,0.2)] hover:shadow-[0_0_25px_rgba(205,127,50,0.4)] transform hover:-translate-y-1";
                        rankBadge = <div className="absolute -top-3 -right-3 text-4xl drop-shadow-lg z-10" title="3er Puesto">🥉</div>;
                    }

                    return (
                        <div 
                            key={server.id} 
                            onClick={() => { setSelectedServer(server.server_name); setModalTab('register'); }}
                            className={`${podiumClass} backdrop-blur-sm border rounded-xl p-5 cursor-pointer transition-all duration-300 group flex flex-col justify-between h-full relative overflow-visible`}
                        >
                            {rankBadge}
                            
                            {/* Barra de progreso de fondo */}
                            <div 
                                className="absolute bottom-0 left-0 h-1.5 bg-[#f8b134]/90 transition-all duration-1000 ease-out shadow-[0_0_8px_#f8b134]" 
                                style={{ width: `${percentage}%` }}
                            ></div>

                            <div className="flex-1 flex flex-col items-center">
                                {server.avatar_url ? (
                                    <img src={server.avatar_url} alt={server.server_name} className="w-16 h-16 rounded-full object-cover border-2 border-white/20 mb-3 shadow-lg" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xl font-bold mb-3 border-2 border-white/5 shadow-inner">
                                        {server.server_name.substring(0,2).toUpperCase()}
                                    </div>
                                )}
                                <h3 className="text-[13px] leading-tight font-bold text-white/90 group-hover:text-white mb-3 line-clamp-2 uppercase tracking-wide text-center">
                                    {server.server_name}
                                </h3>
                            </div>
                            
                            <div className="flex items-center justify-between mt-auto">
                                <span className={`text-2xl font-[Titan_One] drop-shadow-md ${isGoalMet ? 'text-green-400' : 'text-[#f8b134]'}`}>
                                    {totalTickets}
                                </span>
                                <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">
                                    / 10
                                </span>
                            </div>
                            
                            {/* Hover overlay indicando accion */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl pointer-events-none">
                                <span className="text-[#f8b134] text-xs font-bold uppercase tracking-widest border border-[#f8b134] rounded-full px-3 py-1">Registrar</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredServers.length === 0 && (
                <div className="text-center py-20 text-white/50 text-lg">
                    No se encontró ningún servidor con ese nombre.
                </div>
            )}

            {/* Modal for adding a ticket */}
            {selectedServer && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a0a0d] border border-[#f8b134]/40 w-full max-w-lg rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#f8b134] to-[#ffcc66]"></div>
                        
                        <button 
                            onClick={() => setSelectedServer(null)}
                            className="absolute top-6 right-6 text-white/50 hover:text-white transition bg-black/50 rounded-full p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                {selectedServerData?.avatar_url ? (
                                    <img src={selectedServerData.avatar_url} alt={selectedServer} className="w-16 h-16 rounded-full object-cover border-2 border-[#f8b134]" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-xl font-bold border-2 border-white/10 group-hover:border-[#f8b134]/50 transition">
                                        {selectedServer.substring(0,2).toUpperCase()}
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
                                <p className="text-white/60 text-sm">Servidor</p>
                                <h3 className="text-xl font-bold text-white uppercase tracking-wider">{selectedServer}</h3>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                        </div>
                        
                        <div className="flex gap-4 mb-6 border-b border-white/10 pb-4 overflow-x-auto whitespace-nowrap custom-scrollbar">
                            <button 
                                onClick={() => setModalTab('register')}
                                className={`text-[11px] md:text-sm font-bold uppercase tracking-widest pb-2 -mb-[17px] border-b-2 transition ${modalTab === 'register' ? 'text-[#f8b134] border-[#f8b134]' : 'text-white/40 border-transparent hover:text-white/70'}`}
                            >
                                Registrar Manual
                            </button>
                            <button 
                                onClick={() => setModalTab('no_competitor')}
                                className={`text-[11px] md:text-sm font-bold uppercase tracking-widest pb-2 -mb-[17px] border-b-2 transition flex items-center gap-1 ${modalTab === 'no_competitor' ? 'text-green-400 border-green-400' : 'text-white/40 border-transparent hover:text-white/70'}`}
                            >
                                No-Competidor
                                <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[9px] border border-green-500/30">NUEVO</span>
                            </button>
                            <button 
                                onClick={() => setModalTab('history')}
                                className={`text-[11px] md:text-sm font-bold uppercase tracking-widest pb-2 -mb-[17px] border-b-2 transition flex items-center gap-2 ${modalTab === 'history' ? 'text-[#f8b134] border-[#f8b134]' : 'text-white/40 border-transparent hover:text-white/70'}`}
                            >
                                Boletas Guardadas
                                <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded-full text-[10px]">
                                    {selectedServerData?.tickets_sold?.length || 0}
                                </span>
                            </button>
                        </div>

                        {modalTab === 'register' && (
                        <form onSubmit={handleAddTicket} className="space-y-5">
                            {/* Bloque de Comprador */}
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-[#f8b134] uppercase tracking-widest mb-1">Nombre del Comprador</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="¿Quién compró?"
                                        value={ticketForm.nombre_comprador}
                                        onChange={e => setTicketForm({...ticketForm, nombre_comprador: e.target.value})}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#f8b134] focus:ring-1 focus:ring-[#f8b134] transition placeholder:text-white/20"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Teléfono (Opcional)</label>
                                        <input 
                                            type="tel" 
                                            placeholder="Opcional"
                                            value={ticketForm.telefono_comprador}
                                            onChange={e => setTicketForm({...ticketForm, telefono_comprador: e.target.value})}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#f8b134] focus:ring-1 focus:ring-[#f8b134] transition placeholder:text-white/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Medio de Pago</label>
                                        <select 
                                            value={ticketForm.medio_pago}
                                            onChange={e => setTicketForm({...ticketForm, medio_pago: e.target.value})}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#f8b134] focus:ring-1 focus:ring-[#f8b134] transition"
                                        >
                                            <option value="Nequi">Nequi</option>
                                            <option value="Efectivo">Efectivo</option>
                                            <option value="Daviplata">Daviplata</option>
                                            <option value="Transferencia">Transferencia</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque de Boletas */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-[11px] font-bold text-[#f8b134] uppercase tracking-widest">Números de Boleta</label>
                                    <span className="bg-[#f8b134]/20 text-[#f8b134] px-3 py-1 rounded-full text-xs font-bold border border-[#f8b134]/30">
                                        Total: {ticketForm.numeros_boletas.filter(n => n.trim() !== '').length}
                                    </span>
                                </div>
                                
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {ticketForm.numeros_boletas.map((numero, index) => (
                                        <div key={index} className="flex gap-2">
                                            <div className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white/50 font-bold flex items-center justify-center min-w-[3rem]">
                                                #{index + 1}
                                            </div>
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="Ej: 0145"
                                                value={numero}
                                                onChange={e => handleTicketNumberChange(index, e.target.value)}
                                                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#f8b134] focus:ring-1 focus:ring-[#f8b134] transition placeholder:text-white/20"
                                            />
                                            {ticketForm.numeros_boletas.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveTicketNumber(index)}
                                                    className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                
                                <button 
                                    type="button"
                                    onClick={handleAddTicketNumber}
                                    className="w-full mt-3 py-3 border border-dashed border-white/20 hover:border-[#f8b134]/50 text-white/60 hover:text-[#f8b134] rounded-xl text-sm font-bold uppercase tracking-wider transition flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                    Añadir otra boleta a esta venta
                                </button>
                            </div>
                            
                            <button type="submit" disabled={isSubmitting} className="w-full bg-[#f8b134] hover:bg-[#fbd07e] text-black font-bold py-4 rounded-xl shadow-lg hover:shadow-[#f8b134]/30 transition-all uppercase tracking-widest flex items-center justify-center disabled:opacity-50">
                                {isSubmitting ? 'Guardando...' : 'Registrar Venta'}
                            </button>
                        </form>
                        )}

                        {modalTab === 'no_competitor' && (
                        <form onSubmit={handleAddNoCompetitor} className="space-y-5">
                            <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/10 p-4 rounded-2xl border border-green-500/20 space-y-4">
                                <p className="text-xs text-green-100/80 mb-2 leading-relaxed">Vende boletas a personas que <span className="font-bold text-green-400">no participarán en el reto de la web</span>. Selecciona las boletas, adjunta el comprobante y quedarán separadas a su nombre.</p>
                                
                                <div>
                                    <label className="block text-[11px] font-bold text-green-400 uppercase tracking-widest mb-1">Nombre del Comprador</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Ej: Tía María"
                                        value={ncForm.nombre_comprador}
                                        onChange={e => setNcForm({...ncForm, nombre_comprador: e.target.value})}
                                        className="w-full bg-black/50 border border-green-500/30 rounded-xl px-4 py-3 text-white outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition placeholder:text-green-500/30"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Costo Pagado ($)</label>
                                        <input 
                                            type="number" 
                                            required
                                            min="0"
                                            placeholder="Ej: 20000"
                                            value={ncForm.costo_pagado}
                                            onChange={e => setNcForm({...ncForm, costo_pagado: e.target.value})}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition placeholder:text-white/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1">Medio</label>
                                        <select 
                                            value={ncForm.medio_pago}
                                            onChange={e => setNcForm({...ncForm, medio_pago: e.target.value})}
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition"
                                        >
                                            <option value="Efectivo">Efectivo</option>
                                            <option value="Nequi">Nequi</option>
                                            <option value="Daviplata">Daviplata</option>
                                            <option value="Transferencia">Transferencia</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-green-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                                        <span>Sugeridas para ti</span>
                                        <span className="bg-green-500/20 px-2 py-0.5 rounded border border-green-500/30">De 10 en 10</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {suggestedTickets.map(num => (
                                            <button
                                                type="button"
                                                key={num}
                                                onClick={() => handleTicketSelection(num)}
                                                className={`w-[calc(20%-0.4rem)] h-12 rounded-xl font-bold flex items-center justify-center transition-all ${ncSelectedTickets.includes(num) ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.5)] scale-110 z-10 relative' : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:scale-105'}`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                        {suggestedTickets.length === 0 && <span className="text-xs text-white/40 italic">Cargando sugerencias...</span>}
                                    </div>

                                    <label className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2">Otras Boletas Libres</label>
                                    <div className="h-40 overflow-y-auto custom-scrollbar pr-2 border border-white/5 rounded-xl p-2 bg-black/30">
                                        <div className="flex flex-wrap gap-2">
                                            {availableTickets.filter(t => !suggestedTickets.includes(t)).slice(0, 100).map(num => (
                                                <button
                                                    type="button"
                                                    key={num}
                                                    onClick={() => handleTicketSelection(num)}
                                                    className={`w-10 h-10 text-xs rounded-lg font-bold flex items-center justify-center transition-all ${ncSelectedTickets.includes(num) ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.5)] scale-110 z-10 relative' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'}`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                            {availableTickets.length > 100 + suggestedTickets.length && (
                                                <div className="w-full text-center text-xs text-white/30 pt-2 pb-1">... y {availableTickets.length - 100 - suggestedTickets.length} más libres.</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex justify-between items-center">
                                        <span className="text-xs font-bold text-green-400 uppercase">Seleccionadas:</span>
                                        <span className="text-sm font-bold text-white">
                                            {ncSelectedTickets.length > 0 ? ncSelectedTickets.join(', ') : 'Ninguna'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-green-400 uppercase tracking-widest mb-2">Comprobante de Pago (Obligatorio)</label>
                                    {!ncReceiptFile ? (
                                        <label className="flex flex-col items-center justify-center w-full h-24 bg-green-500/5 border-2 border-green-500/30 border-dashed rounded-xl cursor-pointer hover:bg-green-500/10 transition group">
                                            <span className="text-xs text-green-400/80 group-hover:text-green-400 transition font-medium">Toca para subir imagen/PDF</span>
                                            <input type="file" required className="hidden" accept="image/*,.pdf" onChange={e => setNcReceiptFile(e.target.files?.[0] || null)} />
                                        </label>
                                    ) : (
                                        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 p-3 rounded-xl">
                                            <span className="text-xs text-white truncate max-w-[200px] font-medium">{ncReceiptFile.name}</span>
                                            <button type="button" onClick={() => setNcReceiptFile(null)} className="text-red-400 text-xs font-bold uppercase hover:text-red-300 px-2 py-1 bg-red-400/10 rounded-lg">Quitar</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold py-4 rounded-xl shadow-lg hover:shadow-green-500/30 transition-all uppercase tracking-widest flex items-center justify-center disabled:opacity-50">
                                {isUploadingReceipt ? 'Subiendo Comprobante...' : isSubmitting ? 'Procesando...' : 'Registrar Venta NO-Competidor'}
                            </button>
                        </form>
                        )}

                        {modalTab === 'history' && (
                            <div className="space-y-4">
                                {(!selectedServerData?.tickets_sold || selectedServerData.tickets_sold.length === 0) ? (
                                    <div className="text-center py-10 text-white/50">
                                        No hay boletas registradas para este servidor.
                                    </div>
                                ) : (
                                    selectedServerData.tickets_sold.map(ticket => (
                                        <div key={ticket.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 relative group">
                                            <button 
                                                onClick={() => handleDeleteTicket(ticket.id)}
                                                className="absolute top-4 right-4 text-red-500/50 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition opacity-0 group-hover:opacity-100"
                                                title="Eliminar registro"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-[10px] uppercase text-[#f8b134] tracking-widest font-bold mb-1">Comprador</span>
                                                    <div className="text-white font-bold">{ticket.nombre_comprador}</div>
                                                    {ticket.telefono_comprador && <div className="text-white/60 text-xs">{ticket.telefono_comprador}</div>}
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] uppercase text-[#f8b134] tracking-widest font-bold mb-1">Boletas ({ticket.cantidad})</span>
                                                    <div className="text-white font-mono text-sm">{ticket.numeros_boleta}</div>
                                                    <div className="text-white/50 text-xs mt-1">{ticket.medio_pago}</div>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-white/30 mt-3 pt-3 border-t border-white/10">
                                                Registrado el {new Date(ticket.fecha).toLocaleString()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
