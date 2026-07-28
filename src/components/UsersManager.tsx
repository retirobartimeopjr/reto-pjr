import { useState, useEffect } from 'react';

interface UserData {
    user_id: string;
    username: string;
    is_active: boolean;
    calculated_score: number;
    phone?: string;
    cedula?: string;
    email?: string;
}

interface UserDetails {
    user_id: string;
    username: string;
    calculated_score: number;
    parroquias_visitadas: number;
    respuestas_enviadas: number;
    respuestas_correctas: number;
    referidos: number;
    phone: string;
    cedula: string;
    email?: string;
    visited_parroquias: {
        name: string;
        code: string;
        visited_at: string;
        points_awarded: number;
        photo_url?: string;
    }[];
}

export default function UsersManager({ username, password }: { username: string, password: string }) {
    const [users, setUsers] = useState<UserData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');

    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailTarget, setEmailTarget] = useState<{username: string, email: string} | null>(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailFeedback, setEmailFeedback] = useState<{type: 'success'|'error', msg: string} | null>(null);

    // Photo Modal State
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [loadingPhoto, setLoadingPhoto] = useState(false);

    const fetchUsers = async (query = '') => {
        setLoading(true);
        setFeedback('');
        try {
            const res = await fetch('/api/manageUsers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'fetch', searchQuery: query })
            });
            const data = await res.json();
            if (res.ok) {
                setUsers(data);
            } else {
                setFeedback(`Error: ${data.error}`);
            }
        } catch (e) {
            setFeedback('Error de conexión al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    // Load initial users
    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchUsers(searchQuery);
    };

    const handleToggleStatus = async (targetUserId: string, currentStatus: boolean) => {
        setActionLoading(targetUserId);
        setFeedback('');
        const newStatus = !currentStatus;
        try {
            const res = await fetch('/api/manageUsers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    action: 'toggle', 
                    targetUserId, 
                    newActiveState: newStatus 
                })
            });
            const data = await res.json();
            if (res.ok) {
                // Update local state
                setUsers(users.map(u => u.user_id === targetUserId ? { ...u, is_active: newStatus } : u));
            } else {
                setFeedback(`Error: ${data.error}`);
            }
        } catch (e) {
            setFeedback('Error de conexión al actualizar usuario');
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewDetails = async (targetUserId: string) => {
        setLoadingDetails(true);
        try {
            const res = await fetch('/api/userDetails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, targetUserId })
            });
            const data = await res.json();
            if (res.ok) {
                setSelectedUser(data);
            } else {
                setFeedback(`Error: ${data.error}`);
            }
        } catch (e) {
            setFeedback('Error al cargar detalles del usuario');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleOpenPhoto = async (url: string) => {
        setLoadingPhoto(true);
        // Show placeholder or spinner immediately
        setSelectedPhoto('loading');
        
        try {
            const res = await fetch('/api/s3/presignGet', {
                method: 'POST',
                body: JSON.stringify({ fileUrl: url }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.url) {
                setSelectedPhoto(data.url);
            } else {
                setSelectedPhoto(url); // Fallback
            }
        } catch (e) {
            setSelectedPhoto(url); // Fallback
        } finally {
            setLoadingPhoto(false);
        }
    };

    const handleSendIndividualEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailTarget?.email) return;
        
        if (!emailSubject.trim() || !emailBody.trim()) {
            setEmailFeedback({ type: 'error', msg: 'Asunto y mensaje son requeridos.' });
            return;
        }

        setSendingEmail(true);
        setEmailFeedback(null);
        
        try {
            const res = await fetch('/api/sendEmail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    action: 'individual',
                    to: emailTarget.email,
                    subject: emailSubject,
                    htmlMessage: emailBody.replace(/\n/g, '<br/>')
                })
            });
            const data = await res.json();
            if (res.ok) {
                setEmailFeedback({ type: 'success', msg: 'Correo enviado correctamente.' });
                setEmailSubject('');
                setEmailBody('');
                setTimeout(() => { setShowEmailModal(false); setEmailTarget(null); }, 2000);
            } else {
                setEmailFeedback({ type: 'error', msg: data.error || 'Error al enviar.' });
            }
        } catch (error) {
            setEmailFeedback({ type: 'error', msg: 'Error de conexión.' });
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <div className="space-y-6 relative">
            <div className="bg-[#161616] rounded-3xl p-6 md:p-8 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Gestión de Participantes</h2>
                    <p className="text-zinc-400 text-sm mt-1">Busca usuarios por nombre, cédula o teléfono y audita sus puntos.</p>
                </div>
            </div>

            <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 space-y-6">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, cédula o teléfono..."
                        className="flex-grow bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand/50"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-brand/10 border border-brand/30 text-brand px-6 py-3 md:py-2 rounded-xl font-bold hover:bg-brand/20 transition disabled:opacity-50 text-sm"
                    >
                        {loading ? '...' : 'Buscar'}
                    </button>
                </form>

                {feedback && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold text-center">
                        {feedback}
                    </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0a0a0a]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-zinc-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Participante</th>
                                <th className="p-4 font-bold text-center">Puntaje</th>
                                <th className="p-4 font-bold text-center">Estado Ranking</th>
                                <th className="p-4 font-bold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {users.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-zinc-500 italic">
                                        No se encontraron participantes.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.user_id} className="hover:bg-white/5 transition">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{user.username || 'Anónimo'}</div>
                                            <div className="text-xs text-zinc-500 mt-1">
                                                {user.phone ? `📱 ${user.phone}` : ''} {user.cedula ? ` | 🪪 ${user.cedula}` : ''}
                                            </div>
                                        </td>
                                        <td className="p-4 text-brand font-mono font-bold text-center">
                                            {user.calculated_score} pts
                                        </td>
                                        <td className="p-4 text-center">
                                            {user.is_active ? (
                                                <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-bold">
                                                    Público
                                                </span>
                                            ) : (
                                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold">
                                                    Oculto
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {user.email && (
                                                <button
                                                    onClick={() => {
                                                        setEmailTarget({ username: user.username || 'Anónimo', email: user.email! });
                                                        setShowEmailModal(true);
                                                    }}
                                                    className="px-4 py-1.5 rounded-lg text-xs font-bold transition border bg-brand/10 border-brand/30 text-brand hover:bg-brand/20"
                                                >
                                                    Enviar Correo
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleViewDetails(user.user_id)}
                                                disabled={loadingDetails}
                                                className="px-4 py-1.5 rounded-lg text-xs font-bold transition border bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                                            >
                                                Ver Detalles
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(user.user_id, user.is_active)}
                                                disabled={actionLoading === user.user_id}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition border ${
                                                    user.is_active 
                                                        ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                                                        : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                                                } disabled:opacity-50`}
                                            >
                                                {actionLoading === user.user_id 
                                                    ? '...' 
                                                    : user.is_active ? 'Desactivar' : 'Activar'
                                                }
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#161616] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedUser.username || 'Anónimo'}</h3>
                                <p className="text-sm text-zinc-400 mt-1">
                                    {selectedUser.phone ? `📱 ${selectedUser.phone}  •  ` : ''} 
                                    {selectedUser.cedula ? `🪪 ${selectedUser.cedula}  •  ` : ''}
                                    {selectedUser.email ? `✉️ ${selectedUser.email}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedUser.email && (
                                    <button 
                                        onClick={() => {
                                            setEmailTarget({ username: selectedUser.username || 'Anónimo', email: selectedUser.email! });
                                            setShowEmailModal(true);
                                        }}
                                        className="bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        Enviar Correo
                                    </button>
                                )}
                                <button 
                                    onClick={() => setSelectedUser(null)}
                                    className="text-zinc-500 hover:text-white transition"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Score Breakdown Bento */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-[#0a0a0a] border border-brand/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-2xl font-black text-brand">{selectedUser.calculated_score}</span>
                                    <span className="text-xs text-zinc-500 font-bold uppercase mt-1">Total Pts</span>
                                </div>
                                <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xl font-bold text-white">{selectedUser.parroquias_visitadas}</span>
                                    <span className="text-xs text-zinc-500 font-bold uppercase mt-1">Visitas</span>
                                </div>
                                <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xl font-bold text-white">{selectedUser.respuestas_correctas}/{selectedUser.respuestas_enviadas}</span>
                                    <span className="text-xs text-zinc-500 font-bold uppercase mt-1">Trivia OK</span>
                                </div>
                                <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <span className="text-xl font-bold text-white">{selectedUser.referidos || 0}</span>
                                    <span className="text-xs text-zinc-500 font-bold uppercase mt-1">Referidos</span>
                                </div>
                            </div>

                            {/* Visited Parroquias */}
                            <div>
                                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                    Historial de Visitas
                                </h4>
                                <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
                                    {selectedUser.visited_parroquias?.length === 0 ? (
                                        <p className="p-6 text-center text-sm text-zinc-500">No ha visitado ninguna parroquia aún.</p>
                                    ) : (
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-white/5 text-zinc-500 text-xs">
                                                    <th className="p-3 font-medium">Parroquia</th>
                                                    <th className="p-3 font-medium text-center">Puntos</th>
                                                    <th className="p-3 font-medium text-right">Fecha y Hora</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {selectedUser.visited_parroquias?.map((visit, i) => (
                                                    <tr 
                                                        key={i} 
                                                        className={`transition ${visit.photo_url ? 'hover:bg-white/10 cursor-pointer' : 'hover:bg-white/5'}`}
                                                        onClick={() => visit.photo_url && handleOpenPhoto(visit.photo_url)}
                                                    >
                                                        <td className="p-3">
                                                            <div className="text-white font-medium flex items-center gap-2">
                                                                {visit.name}
                                                                {visit.photo_url && (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-zinc-500 font-mono mt-0.5">{visit.code || 'S/C'}</div>
                                                        </td>
                                                        <td className="p-3 text-brand font-mono text-center">+{visit.points_awarded}</td>
                                                        <td className="p-3 text-right text-zinc-400 text-xs">
                                                            {new Date(visit.visited_at).toLocaleString('es-CO')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Email Modal */}
            {showEmailModal && emailTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#111] border border-brand/20 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                Mensaje para {emailTarget.username}
                            </h3>
                            <button 
                                onClick={() => { setShowEmailModal(false); setEmailTarget(null); }}
                                className="text-zinc-500 hover:text-white transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSendIndividualEmail} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 mb-1">Destinatario</label>
                                <input type="text" value={emailTarget.email} disabled className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl p-3 text-white text-sm opacity-70" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 mb-1">Asunto</label>
                                <input 
                                    type="text" 
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Asunto del correo..."
                                    required
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white text-sm focus:border-brand/50 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 mb-1">Mensaje</label>
                                <textarea 
                                    rows={5}
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="Escribe el mensaje..."
                                    required
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white text-sm focus:border-brand/50 outline-none resize-none" 
                                />
                            </div>
                            
                            {emailFeedback && (
                                <div className={`p-3 rounded-xl text-xs font-bold border ${
                                    emailFeedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
                                }`}>
                                    {emailFeedback.msg}
                                </div>
                            )}

                            <div className="flex justify-end pt-2 gap-3">
                                <button type="button" onClick={() => { setShowEmailModal(false); setEmailTarget(null); }} className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white transition">Cancelar</button>
                                <button 
                                    type="submit"
                                    disabled={sendingEmail}
                                    className="bg-brand text-black px-6 py-2 rounded-xl text-sm font-bold hover:bg-brand/90 transition disabled:opacity-50"
                                >
                                    {sendingEmail ? 'Enviando...' : 'Enviar Correo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Photo Modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={() => setSelectedPhoto(null)}>
                    <div className="relative max-w-4xl max-h-screen w-full flex justify-center items-center">
                        <button 
                            onClick={() => setSelectedPhoto(null)}
                            className="absolute -top-12 right-0 text-white hover:text-brand bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        
                        {selectedPhoto === 'loading' ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div>
                                <p className="text-brand font-bold">Obteniendo acceso seguro a la imagen...</p>
                            </div>
                        ) : (
                            <img 
                                src={selectedPhoto} 
                                alt="Comprobante de Visita" 
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
                                onClick={(e) => e.stopPropagation()} 
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
