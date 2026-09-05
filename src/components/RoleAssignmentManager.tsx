import { useState, useEffect, useMemo } from 'react';

interface Server {
    id: number;
    server_name: string;
    gender?: string | null;
    retreat_role?: string;
}

interface Participation {
    role: string;
    retreat: number;
}

interface SuggestedServer {
    id: number;
    name: string;
    score: number;
    isConfirmed?: boolean;
}

interface ReconciliationItem {
    original_name: string;
    status: 'confirmado' | 'segura' | 'dudosa' | 'sin_coincidencia';
    participations: Participation[];
    suggested_servers: SuggestedServer[];
}

export default function RoleAssignmentManager({ servers }: { servers: Server[] }) {
    const [items, setItems] = useState<ReconciliationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'confirmado' | 'segura' | 'dudosa' | 'sin_coincidencia'>('dudosa');
    const [searchTerm, setSearchTerm] = useState('');
    
    // State to hold user's selection for each unconfirmed item
    const [selectedMatches, setSelectedMatches] = useState<Record<string, number | ''>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/coordi/historical_roles?action=get_reconciliation_status');
            const data = await res.json();
            if (data.success) {
                setItems(data.data || []);
                
                // Initialize default selections
                const newSelections: Record<string, number | ''> = {};
                data.data.forEach((item: ReconciliationItem) => {
                    if (item.status !== 'confirmado' && item.suggested_servers.length > 0) {
                        newSelections[item.original_name] = item.suggested_servers[0].id;
                    }
                });
                setSelectedMatches(newSelections);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleParseMd = async () => {
        if (!confirm('¡ATENCIÓN! Esto borrará todas las asignaciones no confirmadas y reseteará el historial. ¿Estás seguro de sincronizar la base de datos con el archivo roles_retiro_consolidado.md?')) return;
        setLoading(true);
        try {
            const res = await fetch('/api/coordi/historical_roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'parse_md' })
            });
            const data = await res.json();
            alert(data.message || data.error);
            fetchData();
        } catch(e) {
            alert('Error sincronizando .md');
            setLoading(false);
        }
    };

    const confirmMatch = async (original_name: string, server_id: number) => {
        try {
            await fetch('/api/coordi/historical_roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'map_server', original_name, server_id })
            });
            // Update local state optimistically
            setItems(items.map(item => {
                if (item.original_name === original_name) {
                    const confirmedServer = servers.find(s => s.id === server_id);
                    return {
                        ...item,
                        status: 'confirmado',
                        suggested_servers: confirmedServer ? [{ id: confirmedServer.id, name: confirmedServer.server_name, score: 100, isConfirmed: true }] : []
                    };
                }
                return item;
            }));
        } catch(e) {
            alert('Error confirmando relación');
        }
    };

    const unassignMatch = async (original_name: string) => {
        if (!confirm('¿Seguro que deseas desvincular este registro?')) return;
        try {
            await fetch('/api/coordi/historical_roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'map_server', original_name, server_id: null })
            });
            // Refetch to recalculate suggestions properly
            fetchData();
        } catch(e) {
            alert('Error desvinculando');
        }
    };

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (filterStatus !== 'all' && item.status !== filterStatus) return false;
            if (searchTerm && !item.original_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });
    }, [items, filterStatus, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: items.length,
            confirmados: items.filter(i => i.status === 'confirmado').length,
            seguras: items.filter(i => i.status === 'segura').length,
            dudosas: items.filter(i => i.status === 'dudosa').length,
            sin_coincidencia: items.filter(i => i.status === 'sin_coincidencia').length
        };
    }, [items]);

    return (
        <div className="bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg flex flex-col min-h-[800px]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                        </svg>
                        Relacionamiento de Historial
                    </h2>
                    <p className="text-white/50 text-sm mt-1">Sincroniza el historial del archivo .md con la base de datos real.</p>
                </div>
                <button 
                    onClick={handleParseMd}
                    disabled={loading}
                    className="bg-red-600/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold py-2 px-4 rounded-xl transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    Procesar Archivo .md
                </button>
            </div>

            {/* Stats Panel */}
            <div className="grid grid-cols-5 gap-4 mb-6">
                <div onClick={() => setFilterStatus('all')} className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === 'all' ? 'bg-white/10 border-white/30' : 'bg-black/20 border-white/10 hover:bg-white/5'}`}>
                    <div className="text-white/50 text-xs mb-1">Total Encontrados</div>
                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                </div>
                <div onClick={() => setFilterStatus('confirmado')} className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === 'confirmado' ? 'bg-blue-500/20 border-blue-500/50' : 'bg-black/20 border-white/10 hover:bg-blue-500/10'}`}>
                    <div className="text-blue-400/70 text-xs mb-1">✅ Confirmados</div>
                    <div className="text-2xl font-bold text-blue-400">{stats.confirmados}</div>
                </div>
                <div onClick={() => setFilterStatus('segura')} className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === 'segura' ? 'bg-green-500/20 border-green-500/50' : 'bg-black/20 border-white/10 hover:bg-green-500/10'}`}>
                    <div className="text-green-400/70 text-xs mb-1">🟢 Coincidencia Segura</div>
                    <div className="text-2xl font-bold text-green-400">{stats.seguras}</div>
                </div>
                <div onClick={() => setFilterStatus('dudosa')} className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === 'dudosa' ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-black/20 border-white/10 hover:bg-yellow-500/10'}`}>
                    <div className="text-yellow-400/70 text-xs mb-1">🟡 Dudosas / Pendientes</div>
                    <div className="text-2xl font-bold text-yellow-400">{stats.dudosas}</div>
                </div>
                <div onClick={() => setFilterStatus('sin_coincidencia')} className={`cursor-pointer p-4 rounded-xl border transition ${filterStatus === 'sin_coincidencia' ? 'bg-red-500/20 border-red-500/50' : 'bg-black/20 border-white/10 hover:bg-red-500/10'}`}>
                    <div className="text-red-400/70 text-xs mb-1">🔴 Sin Coincidencia</div>
                    <div className="text-2xl font-bold text-red-400">{stats.sin_coincidencia}</div>
                </div>
            </div>

            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar nombre histórico..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center text-white/50 py-10">No hay registros para mostrar en este filtro.</div>
                ) : (
                    filteredItems.map((item, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${
                            item.status === 'confirmado' ? 'bg-blue-900/10 border-blue-500/20' :
                            item.status === 'segura' ? 'bg-green-900/10 border-green-500/30' :
                            item.status === 'dudosa' ? 'bg-yellow-900/10 border-yellow-500/30' :
                            'bg-red-900/10 border-red-500/20'
                        }`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    {item.status === 'confirmado' && <span title="Confirmado">✅</span>}
                                    {item.status === 'segura' && <span title="Segura">🟢</span>}
                                    {item.status === 'dudosa' && <span title="Dudosa">🟡</span>}
                                    {item.status === 'sin_coincidencia' && <span title="Sin coincidencia">🔴</span>}
                                    <h3 className="text-lg font-bold text-white">{item.original_name}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {item.participations.map((p, i) => (
                                        <span key={i} className="text-[10px] uppercase tracking-wider bg-white/5 text-white/70 px-2 py-1 rounded">
                                            R{p.retreat} - {p.role}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="w-full md:w-auto flex flex-col gap-2 min-w-[300px]">
                                {item.status === 'confirmado' ? (
                                    <div className="flex items-center justify-between bg-black/30 p-2 rounded-lg border border-white/5">
                                        <span className="text-blue-300 font-medium">{item.suggested_servers[0]?.name}</span>
                                        <button 
                                            onClick={() => unassignMatch(item.original_name)}
                                            className="text-white/50 hover:text-red-400 text-xs px-2 py-1 transition"
                                        >
                                            Desvincular
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <select 
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white"
                                            value={selectedMatches[item.original_name] || ''}
                                            onChange={(e) => setSelectedMatches({...selectedMatches, [item.original_name]: parseInt(e.target.value) || ''})}
                                        >
                                            <option value="">-- Seleccionar servidor real --</option>
                                            {item.suggested_servers.length > 0 && (
                                                <optgroup label="Sugerencias del algoritmo">
                                                    {item.suggested_servers.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} ({s.score}% match)</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="Todos los servidores">
                                                {servers.map(s => (
                                                    <option key={s.id} value={s.id}>{s.server_name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => {
                                                    const sId = selectedMatches[item.original_name];
                                                    if (sId) confirmMatch(item.original_name, sId);
                                                    else alert('Por favor, selecciona un servidor de la lista primero.');
                                                }}
                                                className="flex-1 bg-green-600/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 font-bold py-2 rounded-lg text-sm transition"
                                            >
                                                Confirmar Relación
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    alert('Puedes mantener este registro aquí o buscar a la persona y crearla primero en la pestaña General.');
                                                }}
                                                className="bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 px-3 py-2 rounded-lg text-sm transition"
                                            >
                                                No encuentro
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
