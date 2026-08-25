import React, { useState, useEffect, useMemo, useRef } from 'react';
import ServerModal from './ServerModal';

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
    assigned_tickets?: number[];
}

export default function MetasReto() {
    const [servers, setServers] = useState<ServerGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedServer, setSelectedServer] = useState<string | null>(null);
    
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
                
                <div className="flex justify-center mb-8">
                    <a 
                        href="https://wa.me/?text=Hola!%20Te%20escribo%20para%20invitarte%20a%20que%20nos%20apoyes%20con%20nuestro%20retiro%20Bartimeo.%20Puedes%20sumarte%20comprando%20una%20boleta%20de%2020%20mil%20pesos%20consignando%20a%20Nequi%20(Llave%20o%20Breve)%20de%20Nicolas%20Borrero%20al%203182004659.%20Tengo%20algunas%20boletas%20disponibles%20por%20si%20quieres%20ayudarnos.%20Con%20tu%20compra%20participas%20en%20una%20rifa%20de%20500%20mil%20pesos%20y%20tienes%20la%20oportunidad%20de%20unirte%20a%20un%20reto%20para%20ganar%20premios%20de%202%20millones%20y%201%20millon.%20Mas%20info%20en%20retirobartimeo.org.%20Cuento%20contigo,%20un%20abrazo%20enorme!"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebd5c] text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-[0_4px_15px_rgba(37,211,102,0.4)]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Compartir por WhatsApp
                    </a>
                </div>

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
                            onClick={() => { setSelectedServer(server.server_name);  }}
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

            {selectedServerData && (
                <ServerModal 
                    serverData={selectedServerData} 
                    onClose={() => setSelectedServer(null)}
                    onSuccess={() => fetchServers()}
                />
            )}
        </div>
    );
}
