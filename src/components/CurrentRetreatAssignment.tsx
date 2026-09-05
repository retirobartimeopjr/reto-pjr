import { useState, useEffect, useMemo } from 'react';

interface Server {
    id: number;
    server_name: string;
    gender?: string | null;
    retreat_role?: string; // 'interno' | 'externo'
}

interface Activity {
    id: number;
    name: string;
    jornadas: string[];
}

interface Assignment {
    id: number;
    server_id: number;
    activity_id: number;
}

interface HistoricalRole {
    server_id: number;
    role_name: string;
    retreat_num: number;
}

export default function CurrentRetreatAssignment({ servers }: { servers: Server[] }) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [historicalSummary, setHistoricalSummary] = useState<HistoricalRole[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [filterSource, setFilterSource] = useState('all'); // 'all', 'interno', 'externo'
    const [isDraggingServer, setIsDraggingServer] = useState<number | null>(null);
    const [newActivityName, setNewActivityName] = useState('');
    const [isCreatingActivity, setIsCreatingActivity] = useState(false);
    
    // Search State
    const [serverSearchQuery, setServerSearchQuery] = useState('');
    const [activitySearchQueries, setActivitySearchQueries] = useState<{[key: number]: string}>({});
    
    // Modal State
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [actRes, assRes, histRes] = await Promise.all([
                fetch('/api/coordi/historical_roles?action=get_activities').then(r => r.json()),
                fetch('/api/coordi/historical_roles?action=get_assignments').then(r => r.json()),
                fetch('/api/coordi/historical_roles?action=get_historical_summary').then(r => r.json()),
            ]);
            
            if (actRes.success) setActivities(actRes.data);
            if (assRes.success) setAssignments(assRes.data);
            if (histRes.success) setHistoricalSummary(histRes.data);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Derived Data
    const internosCount = servers.filter(s => s.retreat_role === 'interno').length;
    const externosCount = servers.filter(s => s.retreat_role === 'externo').length;

    const availableServers = useMemo(() => {
        return servers.filter(s => {
            if (s.retreat_role !== 'interno' && s.retreat_role !== 'externo') return false;
            
            // Text search
            if (serverSearchQuery && !s.server_name.toLowerCase().includes(serverSearchQuery.toLowerCase())) {
                return false;
            }
            
            if (filterSource === 'all') return true;
            return s.retreat_role === filterSource;
        });
    }, [servers, filterSource, serverSearchQuery]);

    // Handlers
    const handleDragStart = (e: React.DragEvent, serverId: number) => {
        e.dataTransfer.setData('serverId', serverId.toString());
        setIsDraggingServer(serverId);
    };
    
    const handleDragEnd = () => {
        setIsDraggingServer(null);
    };

    const handleDropOnActivity = async (e: React.DragEvent, activityId: number) => {
        e.preventDefault();
        const serverIdStr = e.dataTransfer.getData('serverId');
        if (!serverIdStr) return;
        const serverId = parseInt(serverIdStr);
        await assignServerToActivity(serverId, activityId);
    };

    const assignServerToActivity = async (serverId: number, activityId: number) => {
        // Optimistic UI
        const tempId = Date.now();
        const newAssignment = { id: tempId, server_id: serverId, activity_id: activityId };
        setAssignments([...assignments, newAssignment]);
        
        try {
            const res = await fetch('/api/coordi/historical_roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'assign_server', server_id: serverId, activity_id: activityId })
            });
            const data = await res.json();
            if (!data.success) {
                // Silently revert if it was already assigned (unique violation usually handled by UI but just in case)
                if (data.error !== 'Ya está asignado') {
                    alert(data.error);
                }
                setAssignments(prev => prev.filter(a => a.id !== tempId)); // revert
            } else {
                setAssignments(prev => prev.map(a => a.id === tempId ? data.data : a)); // update with real ID
            }
        } catch(err) {
            alert('Error asignando servicio');
            setAssignments(prev => prev.filter(a => a.id !== tempId)); // revert
        }
    };

    const removeAssignment = async (serverId: number, activityId: number) => {
        const originalAssignments = [...assignments];
        setAssignments(assignments.filter(a => !(a.server_id === serverId && a.activity_id === activityId)));
        
        try {
            await fetch('/api/coordi/historical_roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unassign_server', server_id: serverId, activity_id: activityId })
            });
        } catch(e) {
            alert('Error quitando asignación');
            setAssignments(originalAssignments); // revert
        }
    };

    const handleCreateActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newActivityName.trim()) return;
        
        setIsCreatingActivity(true);
        try {
            const res = await fetch('/api/coordi/historical_roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_activity', name: newActivityName.trim(), jornadas: [] })
            });
            const data = await res.json();
            if (data.success) {
                setActivities([...activities, data.data]);
                setNewActivityName('');
            } else {
                alert(data.error || 'Error creando servicio');
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setIsCreatingActivity(false);
        }
    };

    const handleDeleteActivity = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar este servicio? Se perderán todas las asignaciones actuales a él.')) return;
        
        try {
            const res = await fetch('/api/coordi/historical_roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_activity', id })
            });
            const data = await res.json();
            if (data.success) {
                setActivities(activities.filter(a => a.id !== id));
                // Remove assignments that belonged to this activity
                setAssignments(assignments.filter(a => a.activity_id !== id));
            } else {
                alert(data.error || 'Error eliminando');
            }
        } catch (e) {
            alert('Error de conexión');
        }
    };

    const getServerCurrentServices = (serverId: number) => {
        const serverAssignments = assignments.filter(a => a.server_id === serverId);
        return serverAssignments.map(a => {
            const act = activities.find(ac => ac.id === a.activity_id);
            return act ? act.name : 'Desconocido';
        });
    };

    const getServerHistoricalRoles = (serverId: number) => {
        return historicalSummary.filter(h => h.server_id === serverId);
    };

    const unassignedServers = availableServers.filter(s => !assignments.some(a => a.server_id === s.id));

    return (
        <div className="flex flex-col xl:flex-row gap-6">
            {/* Left Column: Server Pool */}
            <div className="bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg w-full xl:w-1/3 flex flex-col min-h-[800px]">
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand to-orange-500 flex items-center gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    Servidores Disponibles
                </h3>

                {/* Counters */}
                <div className="flex gap-2 mb-4">
                    <div className="flex-1 bg-black/30 border border-brand/20 p-3 rounded-xl text-center">
                        <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-1">Internos</div>
                        <div className="text-2xl font-bold text-white">{internosCount}</div>
                    </div>
                    <div className="flex-1 bg-black/30 border border-green-500/20 p-3 rounded-xl text-center">
                        <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-1">Externos</div>
                        <div className="text-2xl font-bold text-white">{externosCount}</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-2 mb-4">
                    <input 
                        type="text"
                        placeholder="Buscar servidor por nombre..."
                        value={serverSearchQuery}
                        onChange={(e) => setServerSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-brand/50 transition"
                    />
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setFilterSource('all')}
                            className={`flex-1 py-2 rounded-lg text-sm transition font-bold ${filterSource === 'all' ? 'bg-white/10 text-white' : 'bg-black/20 text-white/50 hover:bg-white/5'}`}
                        >
                            Todos
                        </button>
                        <button 
                            onClick={() => setFilterSource('interno')}
                            className={`flex-1 py-2 rounded-lg text-sm transition font-bold ${filterSource === 'interno' ? 'bg-brand/20 text-brand border border-brand/50' : 'bg-black/20 text-white/50 hover:bg-brand/10 hover:text-brand'}`}
                        >
                            Internos
                        </button>
                        <button 
                            onClick={() => setFilterSource('externo')}
                            className={`flex-1 py-2 rounded-lg text-sm transition font-bold ${filterSource === 'externo' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-black/20 text-white/50 hover:bg-green-500/10 hover:text-green-400'}`}
                        >
                            Externos
                        </button>
                    </div>
                </div>

                <div className="text-xs text-white/50 mb-2 px-1 text-center">Arrastra a los servidores hacia los servicios</div>

                {loading ? (
                    <div className="text-center py-10 text-white/50">Cargando...</div>
                ) : (
                    <div className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                        {availableServers.map(s => {
                            const serverAssignments = assignments.filter(a => a.server_id === s.id);
                            const isAssigned = serverAssignments.length > 0;
                            return (
                                <div 
                                    key={s.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, s.id)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => setSelectedServer(s)}
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${isAssigned ? 'bg-green-900/10 border-green-500/20 hover:bg-green-900/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${s.retreat_role === 'interno' ? 'bg-brand' : 'bg-green-500'}`}></div>
                                        <span className={`text-sm font-bold ${isAssigned ? 'text-green-400' : 'text-white'}`}>{s.server_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isAssigned && (
                                            <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                {serverAssignments.length} asignados
                                            </span>
                                        )}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/30" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Right Column: Activities Dashboard */}
            <div className="bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg w-full xl:w-2/3 flex flex-col min-h-[800px]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/70" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Servicios V Retiro
                    </h3>
                    
                    <form onSubmit={handleCreateActivity} className="flex gap-2 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Nombre del servicio (ej. Logística)"
                            value={newActivityName}
                            onChange={(e) => setNewActivityName(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-brand/50 w-full md:w-64"
                        />
                        <button
                            type="submit"
                            disabled={isCreatingActivity || !newActivityName.trim()}
                            className="bg-brand hover:bg-brand/80 text-white font-bold py-2 px-4 rounded-xl text-sm transition disabled:opacity-50 whitespace-nowrap"
                        >
                            + Añadir
                        </button>
                    </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                    {activities.map(activity => {
                        const assignedServersIds = assignments.filter(a => a.activity_id === activity.id).map(a => a.server_id);
                        const assignedServers = servers.filter(s => assignedServersIds.includes(s.id));
                        
                        return (
                            <div 
                                key={activity.id} 
                                className={`bg-black/40 border-2 rounded-xl p-4 min-h-[150px] flex flex-col transition group ${isDraggingServer ? 'border-brand/50 border-dashed bg-brand/5' : 'border-white/10'}`}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                onDrop={(e) => handleDropOnActivity(e, activity.id)}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-lg font-bold text-white/90">{activity.name}</h4>
                                        <button 
                                            onClick={() => handleDeleteActivity(activity.id)}
                                            className="text-red-500/0 group-hover:text-red-500/50 hover:!text-red-500 transition-all text-xs"
                                            title="Eliminar servicio"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <span className="bg-white/10 text-white/70 text-xs px-2 py-1 rounded-full font-bold">
                                        {assignedServers.length} asignados
                                    </span>
                                </div>
                                
                                <div className="mb-3 relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar para asignar..." 
                                        value={activitySearchQueries[activity.id] || ''}
                                        onChange={(e) => setActivitySearchQueries({...activitySearchQueries, [activity.id]: e.target.value})}
                                        className="w-full bg-black/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand/50 transition"
                                    />
                                    {activitySearchQueries[activity.id] && (
                                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1a0a0d] border border-white/10 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                            {servers.filter(s => 
                                                (s.retreat_role === 'interno' || s.retreat_role === 'externo') &&
                                                s.server_name.toLowerCase().includes(activitySearchQueries[activity.id].toLowerCase()) &&
                                                !assignedServersIds.includes(s.id)
                                            ).slice(0, 10).map(s => (
                                                <div 
                                                    key={s.id} 
                                                    onClick={() => {
                                                        assignServerToActivity(s.id, activity.id);
                                                        setActivitySearchQueries({...activitySearchQueries, [activity.id]: ''});
                                                    }}
                                                    className="p-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer flex items-center gap-2"
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${s.retreat_role === 'interno' ? 'bg-brand' : 'bg-green-500'}`}></div>
                                                    {s.server_name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 space-y-2">
                                    {assignedServers.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-white/20 text-sm border-2 border-dashed border-white/5 rounded-lg py-4">
                                            Arrastra servidores aquí
                                        </div>
                                    ) : (
                                        assignedServers.map(s => (
                                            <div key={s.id} className="bg-white/5 border border-white/10 rounded-lg p-2 flex items-center justify-between group">
                                                <div 
                                                    className="flex items-center gap-2 cursor-pointer"
                                                    onClick={() => setSelectedServer(s)}
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${s.retreat_role === 'interno' ? 'bg-brand' : 'bg-green-500'}`}></div>
                                                    <span className="text-sm text-white/80 group-hover:text-white transition">{s.server_name}</span>
                                                </div>
                                                <button 
                                                    onClick={() => removeAssignment(s.id, activity.id)}
                                                    className="text-white/20 hover:text-red-500 transition px-2"
                                                    title="Quitar"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Server Profile Modal */}
            {selectedServer && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a0a0d] border border-white/20 rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{selectedServer.server_name}</h2>
                                <div className={`inline-block mt-1 px-2 py-1 rounded-md text-xs font-bold uppercase ${selectedServer.retreat_role === 'interno' ? 'bg-brand/20 text-brand' : 'bg-green-500/20 text-green-400'}`}>
                                    {selectedServer.retreat_role}
                                </div>
                            </div>
                            <button onClick={() => setSelectedServer(null)} className="text-white/50 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Current Services */}
                            <div>
                                <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">Servicios V Retiro (Actual)</h3>
                                {getServerCurrentServices(selectedServer.id).length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {getServerCurrentServices(selectedServer.id).map((srv, idx) => (
                                            <span key={idx} className="bg-brand/20 text-brand border border-brand/30 px-3 py-1 rounded-lg text-sm font-bold">
                                                {srv}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-white/30 text-sm italic">No tiene servicios asignados para este retiro aún.</p>
                                )}
                            </div>

                            {/* Historical Roles */}
                            <div>
                                <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    Historial de Servicios
                                </h3>
                                
                                {getServerHistoricalRoles(selectedServer.id).length > 0 ? (
                                    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
                                        {getServerHistoricalRoles(selectedServer.id)
                                            .sort((a, b) => a.retreat_num - b.retreat_num)
                                            .map((hist, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0">
                                                    <span className="text-white/80 font-medium">{hist.role_name}</span>
                                                    <span className="text-white/40 text-xs font-bold uppercase tracking-wider">Retiro {hist.retreat_num}</span>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <p className="text-white/30 text-sm italic">No se encontró historial en la base de datos para esta persona.</p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
