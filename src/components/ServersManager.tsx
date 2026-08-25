import { useState, useEffect, useMemo } from 'react';

interface Server {
    id: number;
    server_name: string;
    birthdate: string | null;
    is_v_retiro: boolean;
    gender?: string | null;
    phone?: string | null;
    reminder_sent?: boolean;
}

export default function ServersManager() {
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterActive, setFilterActive] = useState('all');
    const [filterAge, setFilterAge] = useState('all');
    
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
            return `Mi ${greeting} ${formattedName} \uD83E\uDD0D
Como ${role}, tienes *10 boletas del Reto Bartimeo* de *$20.000 cada una*.

Sabemos que cada uno tiene sus tiempos, así que ve moviéndolas con calma desde ya. Y si se te complica, *escríbenos con confianza* que aquí estamos para ayudarte \uD83D\uDE4C

Consulta *tus boletas asignadas y registra tus ventas* en:
*retirobartimeo.org/servidores*
\u26A0\uFE0F *Enlace para servidores, no lo compartas.*

\uD83D\uDCE6 *La próxima semana tenemos ventas.* Si tú, tu familia o algún conocido puede hacer una *donación en especie* para vender, *nos ayudaría muchísimo*. Escríbenos y coordinamos \uD83C\uDF81

Todo suma, por pequeño que parezca. *Gracias por tu sí* , que el Señor bendiga tu esfuerzo y multiplique los frutos \uD83D\uDE4F\uD83C\uDFFD
*Contamos contigo ${formattedName}* \uD83D\uDCAA`;
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                    />
                    <select 
                        value={filterActive}
                        onChange={e => setFilterActive(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition"
                    >
                        <option value="all">Todos los servidores</option>
                        <option value="active">Solo activos (V Retiro)</option>
                        <option value="inactive">Solo inactivos</option>
                    </select>
                    <select 
                        value={filterAge}
                        onChange={e => setFilterAge(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition"
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider">Nombre</th>
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider">Edad</th>
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider text-center">V Retiro</th>
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider text-center">Mensaje</th>
                                    <th className="p-4 text-white/50 font-bold uppercase text-xs tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedServers.map(server => (
                                    <tr key={server.id} className={`border-b border-white/5 hover:bg-white/5 transition ${!server.phone ? 'bg-red-500/10' : ''}`}>
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
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={server.reminder_sent || false}
                                                    onChange={() => handleToggleReminder(server)}
                                                    className="w-5 h-5 cursor-pointer accent-green-500"
                                                    title="Marcar como enviado"
                                                />
                                                <button 
                                                    onClick={() => handleWhatsApp(server)}
                                                    className="bg-green-500 hover:bg-green-400 text-white p-2 rounded-full transition shadow-lg"
                                                    title="Enviar WhatsApp"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.25 4.87L2 22l5.3-1.14A9.97 9.97 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm4.5 14.5c-.24.7-1.3 1.3-1.83 1.35-.45.04-1.02.13-2.9-1.03-2.27-1.4-3.75-3.75-3.87-3.9-.11-.16-.92-1.22-.92-2.33 0-1.1.58-1.65.8-1.89.2-.21.46-.26.61-.26.15 0 .31.01.44.02.15.01.35-.06.55.43.2.5 1 2.45 1.09 2.65.09.2.14.43.02.66-.11.23-.18.36-.36.56-.16.18-.35.39-.5.54-.18.18-.37.38-.17.72.2.35.88 1.45 1.88 2.34 1.28 1.15 2.33 1.51 2.68 1.66.35.15.55.13.76-.11.2-.23.9-1.04 1.14-1.4.24-.36.48-.3.8-.18.32.13 2.05.97 2.4 1.14.35.18.58.26.66.41.09.15.09.87-.15 1.57z"/>
                                                    </svg>
                                                </button>
                                            </div>
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
