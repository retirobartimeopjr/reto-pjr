import { useState, useEffect, useMemo } from 'react';
import RoleAssignmentManager from './RoleAssignmentManager';
import CurrentRetreatAssignment from './CurrentRetreatAssignment';
import ServerLogisticsManager from './ServerLogisticsManager';

export interface Server {
    id: number;
    server_name: string;
    birthdate: string | null;
    is_v_retiro: boolean;
    gender?: string | null;
    phone?: string | null;
    reminder_sent?: boolean;
    retreat_role?: string;
    antiquity?: string;
    shifts?: any;
    meals?: any;
    merchandise?: any;
    payments?: any[];
    scholarship?: number;
    family_group?: string;
}

export interface ServidoresConfig {
    cena_price: number;
    almuerzo_price: number;
    base_nuevo: number;
    base_antiguo: number;
    camiseta_price: number;
    saco_price: number;
    mono_price: number;
    kanguro_price: number;
}

export default function ServersManager() {
    const [servers, setServers] = useState<Server[]>([]);
    const [config, setConfig] = useState<ServidoresConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterActive, setFilterActive] = useState('all');
    const [filterAge, setFilterAge] = useState('all');
    
    // Drag & Drop / Assignment state
    const [filterGenderInternos, setFilterGenderInternos] = useState('all');
    const [filterGenderExternos, setFilterGenderExternos] = useState('all');
    const [isDragging, setIsDragging] = useState(false);
    
    // Tab state
    const [activeTab, setActiveTab] = useState<'base' | 'roles' | 'asignacion' | 'logistica'>('logistica');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingServer, setEditingServer] = useState<Server | null>(null);
    const [formData, setFormData] = useState({
        server_name: '',
        birthdate: '',
        is_v_retiro: true,
        gender: '',
        phone: ''
    });

    // WhatsApp Modal state
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [selectedMessageServer, setSelectedMessageServer] = useState<Server | null>(null);
    const [messageType, setMessageType] = useState('reto');
    const [messageContent, setMessageContent] = useState('');

    const fetchServers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/coordi/servidores?_t=' + Date.now(), {
                headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
            });
            const data = await res.json();
            if (data.success) {
                setServers(data.data);
                if (data.config) setConfig(data.config);
            }
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
        
        // Filtrar por activos
        if (filterActive === 'active') {
            filtered = filtered.filter(s => s.is_v_retiro);
        } else if (filterActive === 'inactive') {
            filtered = filtered.filter(s => !s.is_v_retiro);
        }

        // Filtrar por edad
        if (filterAge !== 'all') {
            filtered = filtered.filter(s => {
                const age = calculateAge(s.birthdate);
                if (age === null) return filterAge === 'unknown'; // Unknown age
                if (filterAge === 'under18') return age < 18;
                if (filterAge === '18to25') return age >= 18 && age <= 25;
                if (filterAge === 'over25') return age > 25;
                return true;
            });
        }

        return filtered.sort((a, b) => {
            const ageA = calculateAge(a.birthdate);
            const ageB = calculateAge(b.birthdate);
            
            if (ageA !== null && ageB !== null) return ageA - ageB; // Jovenes primero
            if (ageA !== null) return -1;
            if (ageB !== null) return 1;
            return a.server_name.localeCompare(b.server_name);
        });
    }, [servers, searchQuery, filterActive, filterAge]);

    const openModal = (server: Server | null = null) => {
        if (server) {
            setEditingServer(server);
            setFormData({
                server_name: server.server_name,
                birthdate: server.birthdate ? server.birthdate.split('T')[0] : '', // Format for input type="date"
                is_v_retiro: server.is_v_retiro,
                gender: server.gender || '',
                phone: server.phone || ''
            });
        } else {
            setEditingServer(null);
            setFormData({
                server_name: '',
                birthdate: '',
                is_v_retiro: true,
                gender: '',
                phone: ''
            });
        }
        setIsModalOpen(true);
    };

    // Drag and Drop Logic
    const handleDragStart = (e: React.DragEvent, server: Server) => {
        e.dataTransfer.setData('serverId', server.id.toString());
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, role: string) => {
        e.preventDefault();
        setIsDragging(false);
        const serverId = e.dataTransfer.getData('serverId');
        if (serverId) {
            await updateRetreatRole(parseInt(serverId), role);
        }
    };

    const updateRetreatRole = async (serverId: number, role: string) => {
        try {
            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_retreat_role', server_id: serverId, retreat_role: role })
            });
            const data = await res.json();
            if (data.success) {
                setServers(servers.map(s => s.id === serverId ? { ...s, retreat_role: role } : s));
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert('Error actualizando rol de retiro');
        }
    };

    const internos = useMemo(() => servers.filter(s => s.retreat_role === 'interno' && (filterGenderInternos === 'all' || s.gender === filterGenderInternos)), [servers, filterGenderInternos]);
    const externos = useMemo(() => servers.filter(s => s.retreat_role === 'externo' && (filterGenderExternos === 'all' || s.gender === filterGenderExternos)), [servers, filterGenderExternos]);

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
                    is_v_retiro: formData.is_v_retiro,
                    gender: formData.gender,
                    phone: formData.phone,
                    reminder_sent: editingServer?.reminder_sent || false
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

    const handleToggleReminder = async (server: Server) => {
        try {
            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_reminder', server_id: server.id, reminder_sent: !server.reminder_sent })
            });
            const data = await res.json();
            if (data.success) {
                setServers(servers.map(s => s.id === server.id ? { ...s, reminder_sent: !s.reminder_sent } : s));
            }
        } catch(e) {
            alert('Error actualizando recordatorio');
        }
    };

    const generateMessageContent = (server: Server, type: string) => {
        const firstName = server.server_name.split(' ')[0];
        const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        
        let greeting = 'queridísimo/a';
        if (server.gender === 'M') {
            greeting = 'queridísimo';
        } else if (server.gender === 'F') {
            greeting = 'queridísima';
        } else {
            // Adivinar por el nombre
            const nameLower = firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const femaleNames = ['maria', 'ana', 'laura', 'sara', 'sarah', 'sofia', 'isabella', 'isabela', 'camila', 'valeria', 'valentina', 'luciana', 'mariana', 'daniela', 'angela', 'adriana', 'amelia', 'carmen', 'diana', 'emilia', 'gabriela', 'juana', 'juliana', 'natalia', 'paula', 'silvana', 'victoria', 'lizeth', 'carolina'];
            const maleNames = ['juan', 'jose', 'carlos', 'luis', 'santiago', 'sebastian', 'nicolas', 'daniel', 'david', 'felipe', 'andres', 'mateo', 'samuel', 'tomas', 'martin', 'simon', 'alejandro', 'camilo', 'cristian', 'diego', 'emilio', 'gabriel', 'jesus', 'manuel'];

            if (femaleNames.includes(nameLower) || nameLower.endsWith('a') || nameLower.endsWith('z')) {
                greeting = 'queridísima';
            } else if (maleNames.includes(nameLower) || nameLower.endsWith('o') || nameLower.endsWith('n') || nameLower.endsWith('s') || nameLower.endsWith('r') || nameLower.endsWith('l') || nameLower.endsWith('d') || nameLower.endsWith('e')) {
                greeting = 'queridísimo';
            }
        }
        let role = 'servidor/a';
        if (greeting === 'queridísima') {
            role = 'servidora';
        } else if (greeting === 'queridísimo') {
            role = 'servidor';
        }

        if (type === 'reto') {
            return `Mi ${greeting} ${formattedName} 🤍
Como ${role}, tienes *10 boletas del Reto Bartimeo* de *$20.000 cada una*.

Sabemos que cada uno tiene sus tiempos, así que ve moviéndolas con calma desde ya. Y si se te complica, *escríbenos con confianza* que aquí estamos para ayudarte 🙌

Consulta *tus boletas asignadas y registra tus ventas* en:
*retirobartimeo.org/servidores*
⚠️ *Enlace para servidores, no lo compartas.*

📦 *La próxima semana tenemos ventas.* Si tú, tu familia o algún conocido puede hacer una *donación en especie* para vender, *nos ayudaría muchísimo*. Escríbenos y coordinamos 🎁

Todo suma, por pequeño que parezca. *Gracias por tu sí* , que el Señor bendiga tu esfuerzo y multiplique los frutos 🙏🏽
*Contamos contigo ${formattedName}* 💪`;
        } else if (type === 'general') {
            return `¡Hola ${formattedName}! ¿Cómo estás?`;
        }
        return '';
    };

    const handleWhatsApp = (server: Server) => {
        if (!server.phone) {
            alert('Este servidor no tiene teléfono registrado. Edita su perfil primero.');
            return;
        }

        setSelectedMessageServer(server);
        setMessageType('reto');
        setMessageContent(generateMessageContent(server, 'reto'));
        setIsMessageModalOpen(true);
    };

    const handleMessageTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        setMessageType(newType);
        if (selectedMessageServer) {
            setMessageContent(generateMessageContent(selectedMessageServer, newType));
        }
    };

    const sendWhatsApp = () => {
        if (!selectedMessageServer || !selectedMessageServer.phone) return;

        const encodedMessage = encodeURIComponent(messageContent);
        let phone = selectedMessageServer.phone.replace(/\\D/g, '');
        if (!phone.startsWith('57') && phone.length === 10) {
            phone = '57' + phone;
        }

        window.open(`https://api.whatsapp.com/send/?phone=${phone}&text=${encodedMessage}&type=phone_number&app_absent=0`, '_blank');
        setIsMessageModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Gestión de Servidores</h2>
                    {/* Tab Navigation (add Logistica tab) */}
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setActiveTab('logistica')}
                            className={`text-sm font-bold pb-1 border-b-2 transition ${activeTab === 'logistica' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white'}`}
                        >
                            Logística y Finanzas
                        </button>
                        <button 
                            onClick={() => setActiveTab('base')}
                            className={`text-sm font-bold pb-1 border-b-2 transition ${activeTab === 'base' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white'}`}
                        >
                            Base de Datos
                        </button>
                        <button 
                            onClick={() => setActiveTab('roles')}
                            className={`text-sm font-bold pb-1 border-b-2 transition ${activeTab === 'roles' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white'}`}
                        >
                            Historial (.md)
                        </button>
                        <button 
                            onClick={() => setActiveTab('asignacion')}
                            className={`text-sm font-bold pb-1 border-b-2 transition ${activeTab === 'asignacion' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white'}`}
                        >
                            Asignación V Retiro
                        </button>
                    </div>
                </div>
                {activeTab === 'base' && (
                    <button 
                        onClick={() => openModal()} 
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-blue-500/30 transition flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Añadir Servidor
                    </button>
                )}
            </div>

            {activeTab === 'roles' ? (
                <RoleAssignmentManager servers={servers} />
            ) : activeTab === 'asignacion' ? (
                <CurrentRetreatAssignment servers={servers} />
            ) : activeTab === 'logistica' ? (
                <ServerLogisticsManager servers={servers} config={config} refreshServers={fetchServers} />
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Columna Izquierda: Base de Datos Original */}
                <div className="bg-[#1a0a0d] border border-white/10 p-6 rounded-2xl shadow-lg flex flex-col xl:h-[800px]">
                    <h3 className="text-xl font-bold text-white mb-4">Base de Datos General</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition text-sm"
                        />
                        <select 
                            value={filterActive}
                            onChange={e => setFilterActive(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition text-sm"
                        >
                            <option value="all">Todos los servidores</option>
                            <option value="active">Solo activos (V Retiro)</option>
                            <option value="inactive">Solo inactivos</option>
                        </select>
                        <select 
                            value={filterAge}
                            onChange={e => setFilterAge(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition text-sm"
                        >
                            <option value="all">Todas las edades</option>
                            <option value="under18">Menores de 18 años</option>
                            <option value="18to25">Entre 18 y 25 años</option>
                            <option value="over25">Mayores de 25 años</option>
                            <option value="unknown">Sin dato de edad</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-white/50">Cargando servidores...</div>
                    ) : (
                        <div className="overflow-y-auto flex-1 border border-white/5 rounded-xl">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="sticky top-0 bg-[#1a0a0d] z-10 shadow-md">
                                    <tr className="border-b border-white/10">
                                        <th className="p-3 text-white/50 font-bold uppercase text-[10px] tracking-wider">Nombre</th>
                                        <th className="p-3 text-white/50 font-bold uppercase text-[10px] tracking-wider text-center">Estado</th>
                                        <th className="p-3 text-white/50 font-bold uppercase text-[10px] tracking-wider text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedServers.map(server => (
                                        <tr 
                                            key={server.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, server)}
                                            onDragEnd={handleDragEnd}
                                            className={`border-b border-white/5 hover:bg-white/5 transition cursor-grab active:cursor-grabbing ${!server.phone ? 'bg-red-500/10' : ''}`}
                                            title="Arrastra para asignar al retiro"
                                        >
                                            <td className="p-3">
                                                <div className="font-medium text-white flex items-center gap-2">
                                                    {server.server_name}
                                                    {server.retreat_role === 'interno' && <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30">Interno</span>}
                                                    {server.retreat_role === 'externo' && <span className="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 rounded-full border border-purple-500/30">Externo</span>}
                                                </div>
                                                <div className="text-white/40 text-xs mt-0.5 flex gap-2">
                                                    <span>{server.gender || '?'}</span>
                                                    <span>{calculateAge(server.birthdate) !== null ? `${calculateAge(server.birthdate)}a` : '-'}</span>
                                                    <span>{server.phone ? '📱' : '❌📱'}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {server.is_v_retiro ? (
                                                    <span className="text-green-400 text-xs font-bold">ACTIVO</span>
                                                ) : (
                                                    <span className="text-white/40 text-xs font-bold">INACTIVO</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right space-x-1">
                                                <button onClick={() => handleWhatsApp(server)} className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition text-[10px] uppercase font-bold" title="WhatsApp">WA</button>
                                                <button onClick={() => openModal(server)} className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition text-[10px] uppercase font-bold">Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedServers.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-white/40 italic">No hay servidores registrados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Columna Derecha: Asignación */}
                <div className="space-y-6 flex flex-col xl:h-[800px]">
                    
                    {/* Servidores Internos */}
                    <div 
                        className={`bg-[#1a0a0d] border ${isDragging ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10'} p-6 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col transition-colors`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'interno')}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                                Servidores Internos
                                <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">{internos.length}</span>
                            </h3>
                            <select 
                                value={filterGenderInternos}
                                onChange={e => setFilterGenderInternos(e.target.value)}
                                className="bg-black border border-white/10 rounded-lg px-2 py-1.5 text-white focus:border-blue-500 outline-none transition text-xs"
                            >
                                <option value="all">Todos</option>
                                <option value="H">Hombres</option>
                                <option value="M">Mujeres</option>
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto border border-white/5 rounded-xl bg-black/30 p-2 space-y-2">
                            {internos.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-white/30 text-sm italic">
                                    Arrastra servidores aquí
                                </div>
                            ) : (
                                internos.map(server => (
                                    <div key={server.id} className="bg-[#1a0a0d] border border-white/5 p-3 rounded-lg flex justify-between items-center hover:border-white/20 transition">
                                        <div>
                                            <div className="font-bold text-white text-sm">{server.server_name}</div>
                                            <div className="text-white/40 text-[10px] uppercase font-bold">{server.gender || '?'} • {calculateAge(server.birthdate) !== null ? `${calculateAge(server.birthdate)}a` : '-'}</div>
                                        </div>
                                        <button 
                                            onClick={() => updateRetreatRole(server.id, 'none')}
                                            className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-full w-6 h-6 flex items-center justify-center transition"
                                            title="Quitar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Servidores Externos */}
                    <div 
                        className={`bg-[#1a0a0d] border ${isDragging ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/10'} p-6 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col transition-colors`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'externo')}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                                Servidores Externos
                                <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">{externos.length}</span>
                            </h3>
                            <select 
                                value={filterGenderExternos}
                                onChange={e => setFilterGenderExternos(e.target.value)}
                                className="bg-black border border-white/10 rounded-lg px-2 py-1.5 text-white focus:border-blue-500 outline-none transition text-xs"
                            >
                                <option value="all">Todos</option>
                                <option value="H">Hombres</option>
                                <option value="M">Mujeres</option>
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto border border-white/5 rounded-xl bg-black/30 p-2 space-y-2">
                            {externos.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-white/30 text-sm italic">
                                    Arrastra servidores aquí
                                </div>
                            ) : (
                                externos.map(server => (
                                    <div key={server.id} className="bg-[#1a0a0d] border border-white/5 p-3 rounded-lg flex justify-between items-center hover:border-white/20 transition">
                                        <div>
                                            <div className="font-bold text-white text-sm">{server.server_name}</div>
                                            <div className="text-white/40 text-[10px] uppercase font-bold">{server.gender || '?'} • {calculateAge(server.birthdate) !== null ? `${calculateAge(server.birthdate)}a` : '-'}</div>
                                        </div>
                                        <button 
                                            onClick={() => updateRetreatRole(server.id, 'none')}
                                            className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-full w-6 h-6 flex items-center justify-center transition"
                                            title="Quitar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            )}

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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/50 uppercase mb-1">Género</label>
                                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none">
                                        <option value="">Seleccione...</option>
                                        <option value="M">Chico (M)</option>
                                        <option value="F">Chica (F)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/50 uppercase mb-1">WhatsApp</label>
                                    <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="3001234567" />
                                </div>
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

            {isMessageModalOpen && selectedMessageServer && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a0a0d] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
                        <button onClick={() => setIsMessageModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        <h3 className="text-xl font-bold text-white mb-2">Enviar Mensaje</h3>
                        <p className="text-white/60 text-sm mb-6">A: <span className="font-bold text-white">{selectedMessageServer.server_name}</span> ({selectedMessageServer.phone})</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase mb-1">Tipo de Mensaje</label>
                                <select value={messageType} onChange={handleMessageTypeChange} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none">
                                    <option value="reto">Boletas Reto Bartimeo (Predeterminado)</option>
                                    <option value="general">Saludo General</option>
                                    <option value="custom">Mensaje Personalizado (Blanco)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/50 uppercase mb-1">Contenido del Mensaje</label>
                                <textarea 
                                    rows={12}
                                    value={messageContent} 
                                    onChange={e => setMessageContent(e.target.value)} 
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-green-500 outline-none resize-none" 
                                    placeholder="Escribe tu mensaje aquí..."
                                />
                            </div>
                            <button onClick={sendWhatsApp} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 mt-4">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.25 4.87L2 22l5.3-1.14A9.97 9.97 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm4.5 14.5c-.24.7-1.3 1.3-1.83 1.35-.45.04-1.02.13-2.9-1.03-2.27-1.4-3.75-3.75-3.87-3.9-.11-.16-.92-1.22-.92-2.33 0-1.1.58-1.65.8-1.89.2-.21.46-.26.61-.26.15 0 .31.01.44.02.15.01.35-.06.55.43.2.5 1 2.45 1.09 2.65.09.2.14.43.02.66-.11.23-.18.36-.36.56-.16.18-.35.39-.5.54-.18.18-.37.38-.17.72.2.35.88 1.45 1.88 2.34 1.28 1.15 2.33 1.51 2.68 1.66.35.15.55.13.76-.11.2-.23.9-1.04 1.14-1.4.24-.36.48-.3.8-.18.32.13 2.05.97 2.4 1.14.35.18.58.26.66.41.09.15.09.87-.15 1.57z"/>
                                </svg>
                                Enviar WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
