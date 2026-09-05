import { useState, useMemo, useEffect } from 'react';
import type { Server, ServidoresConfig } from './ServersManager';
import ServerLogisticsModal from './ServerLogisticsModal';

export default function ServerLogisticsManager({ servers, config, refreshServers }: { servers: Server[], config: ServidoresConfig | null, refreshServers: () => void }) {
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [showConfig, setShowConfig] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAntiquity, setFilterAntiquity] = useState('all');
    const [filterRole, setFilterRole] = useState('all');

    // Estado del config global editable
    const [editConfig, setEditConfig] = useState<ServidoresConfig | null>(config);

    useEffect(() => {
        if (config) {
            setEditConfig(config);
        }
    }, [config]);

    useEffect(() => {
        if (selectedServer) {
            const updated = servers.find(s => s.id === selectedServer.id);
            if (updated) setSelectedServer(updated);
        }
    }, [servers]);

    // Filtered servers
    const activeServers = useMemo(() => {
        return servers
            .filter(s => s.retreat_role === 'interno' || s.retreat_role === 'externo')
            .filter(s => {
                if (filterAntiquity !== 'all' && (s.antiquity || 'antiguo') !== filterAntiquity) return false;
                if (filterRole !== 'all') {
                    const role = s.retreat_role || 'none';
                    if (role !== filterRole) return false;
                }
                if (searchTerm && !s.server_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                return true;
            });
    }, [servers, searchTerm, filterAntiquity, filterRole]);

    // Helpers to calculate totals
    const calculateTotal = (server: Server) => {
        if (!config) return 0;
        
        let total = 0;
        if (server.retreat_role !== 'externo') {
            total = (server.antiquity || 'antiguo') === 'nuevo' ? config.base_nuevo : config.base_antiguo;
        }
        
        // If externo, add meals
        if (server.retreat_role === 'externo') {
            if (server.meals?.almuerzo) total += config.almuerzo_price;
            if (server.meals?.cena) total += config.cena_price;
        }
        
        // Add clothing and merch
        if (server.merchandise?.camiseta) total += config.camiseta_price;
        if (server.merchandise?.saco) total += config.saco_price;
        if (server.merchandise?.mono) total += config.mono_price;
        if (server.merchandise?.kanguro) total += config.kanguro_price;
        
        // Custom items
        if (server.merchandise?.custom && Array.isArray(server.merchandise.custom)) {
            server.merchandise.custom.forEach((c: any) => {
                total += Number(c.price || 0);
            });
        }
        
        // Subtract scholarship
        total -= (server.scholarship || 0);
        
        return Math.max(0, total);
    };

    const calculatePaid = (server: Server) => {
        if (!server.payments) return 0;
        return server.payments.reduce((sum, p) => sum + p.amount, 0);
    };

    const financialSummary = useMemo(() => {
        let expected = 0;
        let collected = 0;
        activeServers.forEach(server => {
            expected += calculateTotal(server);
            collected += calculatePaid(server);
        });
        return { expected, collected };
    }, [activeServers, config]);

    const handleSaveConfig = async () => {
        if (!editConfig) return;
        setLoading(true);
        try {
            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_config', configData: editConfig })
            });
            const data = await res.json();
            if (data.success) {
                alert('Configuración guardada exitosamente');
                refreshServers();
                setShowConfig(false);
            } else {
                alert('Error: ' + data.error);
            }
        } catch(e) {
            console.error(e);
            alert('Error guardando configuración');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg mt-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Gestión Financiera
                </h3>
                <button 
                    onClick={() => setShowConfig(!showConfig)}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Precios Globales
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-brand/10 border border-brand/20 p-4 rounded-xl">
                    <p className="text-xs text-brand font-bold uppercase tracking-wider mb-1">Total Esperado</p>
                    <p className="text-2xl font-mono text-white font-bold">${financialSummary.expected.toLocaleString('es-CO')}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                    <p className="text-xs text-green-500 font-bold uppercase tracking-wider mb-1">Total Recaudado</p>
                    <p className="text-2xl font-mono text-white font-bold">${financialSummary.collected.toLocaleString('es-CO')}</p>
                </div>
            </div>

            {showConfig && editConfig && (
                <div className="bg-black/30 border border-white/10 p-6 rounded-xl mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2 md:col-span-4 border-b border-white/10 pb-2 mb-2">
                        <h4 className="text-brand font-bold">Tarifas Base</h4>
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Base Nuevo ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.base_nuevo} onChange={e => setEditConfig({...editConfig, base_nuevo: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Base Antiguo ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.base_antiguo} onChange={e => setEditConfig({...editConfig, base_antiguo: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Almuerzo ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.almuerzo_price} onChange={e => setEditConfig({...editConfig, almuerzo_price: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Cena ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.cena_price} onChange={e => setEditConfig({...editConfig, cena_price: Number(e.target.value)})} />
                    </div>
                    
                    <div className="col-span-2 md:col-span-4 border-b border-white/10 pb-2 mb-2 mt-4">
                        <h4 className="text-brand font-bold">Precios de Ropa</h4>
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Camiseta ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.camiseta_price} onChange={e => setEditConfig({...editConfig, camiseta_price: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Saco ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.saco_price} onChange={e => setEditConfig({...editConfig, saco_price: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Moño ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.mono_price} onChange={e => setEditConfig({...editConfig, mono_price: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="text-white/70 text-xs block mb-1">Kanguro ($)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded p-2 text-white" value={editConfig.kanguro_price} onChange={e => setEditConfig({...editConfig, kanguro_price: Number(e.target.value)})} />
                    </div>

                    <div className="col-span-2 md:col-span-4 mt-4 flex justify-end">
                        <button onClick={handleSaveConfig} disabled={loading} className="bg-brand hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg transition">
                            {loading ? 'Guardando...' : 'Guardar Precios Globales'}
                        </button>
                    </div>
                </div>
            )}

            {/* Listado */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <input 
                    type="text" 
                    placeholder="Buscar servidor..." 
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <select 
                    className="bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                    value={filterAntiquity}
                    onChange={e => setFilterAntiquity(e.target.value)}
                >
                    <option value="all">Todas las antigüedades</option>
                    <option value="nuevo">Nuevos</option>
                    <option value="antiguo">Antiguos</option>
                </select>
                <select 
                    className="bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                >
                    <option value="all">Todos los roles</option>
                    <option value="interno">Internos</option>
                    <option value="externo">Externos</option>
                </select>
                <button 
                    onClick={() => refreshServers()}
                    className="bg-brand text-black font-bold px-4 py-3 rounded-lg hover:bg-white transition flex items-center justify-center gap-2 md:w-auto w-full"
                    title="Recargar datos"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refrescar
                </button>
            </div>
            
            <div className="mb-2 flex justify-end">
                <span className="text-xs bg-white/10 text-white/70 px-3 py-1 rounded-full border border-white/20">
                    Mostrando <strong>{activeServers.length}</strong> servidor{activeServers.length !== 1 ? 'es' : ''}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-white/50 text-sm">
                            <th className="p-3">Servidor</th>
                            <th className="p-3">Rol</th>
                            <th className="p-3">Total Deuda</th>
                            <th className="p-3">Abonado</th>
                            <th className="p-3">Saldo</th>
                            <th className="p-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    {Object.entries(
                        activeServers.reduce((acc, server) => {
                            const family = server.family_group?.trim() || 'Individual';
                            if (!acc[family]) acc[family] = [];
                            acc[family].push(server);
                            return acc;
                        }, {} as Record<string, Server[]>)
                    )
                    .sort(([keyA], [keyB]) => keyA === 'Individual' ? 1 : keyB === 'Individual' ? -1 : keyA.localeCompare(keyB))
                    .map(([family, serversInFamily]) => (
                        <tbody key={family}>
                            {family !== 'Individual' && (
                                <tr className="bg-white/5 border-b border-white/10">
                                    <td colSpan={6} className="p-3 font-bold text-brand uppercase text-xs tracking-widest">{family}</td>
                                </tr>
                            )}
                            {serversInFamily.map(server => {
                                const total = calculateTotal(server);
                                const paid = calculatePaid(server);
                                const balance = total - paid;
                                return (
                                    <tr key={server.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                        <td className="p-3">
                                            <div className="font-bold text-white">{server.server_name}</div>
                                            <div className="text-xs text-white/50 uppercase">{server.antiquity || 'antiguo'}</div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${server.retreat_role === 'interno' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {server.retreat_role || 'No asignado'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-white/90">${total.toLocaleString('es-CO')}</td>
                                        <td className="p-3 font-mono text-green-400">${paid.toLocaleString('es-CO')}</td>
                                        <td className="p-3 font-mono text-brand font-bold">${balance.toLocaleString('es-CO')}</td>
                                        <td className="p-3 text-right">
                                            <button 
                                                onClick={() => setSelectedServer(server)}
                                                className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition text-sm mr-2"
                                            >
                                                Editar Finanzas
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    ))}
                    {activeServers.length === 0 && (
                        <tbody>
                            <tr>
                                <td colSpan={6} className="p-6 text-center text-white/50">
                                    No hay servidores asignados para mostrar.
                                </td>
                            </tr>
                        </tbody>
                    )}
                </table>
            </div>

            {selectedServer && (
                <ServerLogisticsModal 
                    server={selectedServer}
                    config={config}
                    existingFamilies={Array.from(new Set(servers.map(s => s.family_group).filter(Boolean))) as string[]}
                    onClose={() => setSelectedServer(null)}
                    onRefresh={() => refreshServers()}
                    onSave={() => {
                        refreshServers();
                        setSelectedServer(null);
                    }}
                />
            )}
        </div>
    );
}
