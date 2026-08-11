import { useState, useEffect, useMemo } from 'react';

interface Server {
    id: number;
    server_name: string;
    birthdate: string | null;
    is_v_retiro: boolean;
}

export default function ServersManager() {
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingServer, setEditingServer] = useState<Server | null>(null);
    const [formData, setFormData] = useState({
        server_name: '',
        birthdate: '',
        is_v_retiro: true
    });

    const fetchServers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/coordi/servidores');
            const data = await res.json();
            if (data.success) setServers(data.data);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
    }, []);

    const calculateAge = (birthdate: string | null) => {
        if (!birthdate) return null;
        const dob = new Date(birthdate);
        if (isNaN(dob.getTime())) return null;
        const diff_ms = Date.now() - dob.getTime();
        const age_dt = new Date(diff_ms); 
        return Math.abs(age_dt.getUTCFullYear() - 1970);
    };

    const sortedServers = useMemo(() => {
        let filtered = servers.filter(s => s.server_name.toLowerCase().includes(searchQuery.toLowerCase()));
        
        return filtered.sort((a, b) => {
            const ageA = calculateAge(a.birthdate);
            const ageB = calculateAge(b.birthdate);
            
            if (ageA !== null && ageB !== null) return ageA - ageB; // Jovenes primero
            if (ageA !== null) return -1;
            if (ageB !== null) return 1;
            return a.server_name.localeCompare(b.server_name);
        });
    }, [servers, searchQuery]);

    const openModal = (server: Server | null = null) => {
        if (server) {
            setEditingServer(server);
            setFormData({
                server_name: server.server_name,
                birthdate: server.birthdate ? server.birthdate.split('T')[0] : '', // Format for input type="date"
                is_v_retiro: server.is_v_retiro
            });
        } else {
            setEditingServer(null);
            setFormData({
                server_name: '',
                birthdate: '',
                is_v_retiro: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: editingServer ? 'update' : 'create',
                    server_id: editingServer?.id,
                    server_name: formData.server_name,
                    birthdate: formData.birthdate,
                    is_v_retiro: formData.is_v_retiro
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchServers();
                setIsModalOpen(false);
            } else {
                alert(data.error);
            }
        } catch(e) {
            alert('Error al guardar');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar este servidor de la base de datos? Esto no se puede deshacer.')) return;
        try {
            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', server_id: id })
            });
            const data = await res.json();
            if (data.success) {
                fetchServers();
            } else {
                alert(data.error);
            }
        } catch(e) {
            alert('Error eliminando servidor');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Gestión de Servidores</h2>
                    <p className="text-white/60">Administra la base de datos de servidores de Bartimeo.</p>
                </div>
                <button 
                    onClick={() => openModal()} 
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-blue-500/30 transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Añadir Servidor
                </button>
            </div>

            <div className="bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg">
                <input 
                    type="text" 
                    placeholder="Buscar por nombre..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition mb-6"
                />

                {loading ? (
                    <div className="text-center py-10 text-white/50">Cargando servidores...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider">Nombre</th>
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider">Edad</th>
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider text-center">V Retiro</th>
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedServers.map(server => (
                                    <tr key={server.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                        <td className="p-4 font-medium text-white">{server.server_name}</td>
                                        <td className="p-4 text-white/70">
                                            {calculateAge(server.birthdate) !== null ? `${calculateAge(server.birthdate)} años` : <span className="text-white/30 italic">Sin dato</span>}
                                        </td>
                                        <td className="p-4 text-center">
                                            {server.is_v_retiro ? (
                                                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">ACTIVO</span>
                                            ) : (
                                                <span className="bg-white/10 text-white/40 px-3 py-1 rounded-full text-xs font-bold border border-white/10">INACTIVO</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button onClick={() => openModal(server)} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition text-sm">Editar</button>
                                            <button onClick={() => handleDelete(server.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition text-sm">Borrar</button>
                                        </td>
                                    </tr>
                                ))}
                                {sortedServers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-white/40 italic">No hay servidores registrados.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a0a0d] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        <h3 className="text-xl font-bold text-white mb-6">{editingServer ? 'Editar Servidor' : 'Nuevo Servidor'}</h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase mb-1">Nombre Completo</label>
                                <input type="text" required value={formData.server_name} onChange={e => setFormData({...formData, server_name: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="Ej: Juan Pérez" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase mb-1">Fecha de Nacimiento</label>
                                <input type="date" value={formData.birthdate} onChange={e => setFormData({...formData, birthdate: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <div className="text-blue-400 font-bold text-sm">Participa en V Retiro</div>
                                    <div className="text-white/50 text-xs mt-1">Habilita su meta en /servidores</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={formData.is_v_retiro} onChange={e => setFormData({...formData, is_v_retiro: e.target.checked})} />
                                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition mt-4 disabled:opacity-50">
                                {isSubmitting ? 'Guardando...' : 'Guardar Servidor'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
