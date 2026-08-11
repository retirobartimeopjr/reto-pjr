import { useState, useEffect } from 'react';

interface BartimeoData {
    id: number;
    documento_identidad: string;
    nombre_completo: string;
    edad: number;
    colegio: string;
    talla_camiseta: string;
    telefono_bartimeo: string;
    acudiente1_nombre: string;
    acudiente1_telefono: string;
    acudiente2_nombre: string;
    acudiente2_telefono: string;
    alergias: string;
    restriccion_alimentaria: string;
    condicion_medica: string;
    medicamentos: string;
    autoriza_imagen: boolean;
    coordi_contactado: string;
    acudiente1_contactado: boolean;
    acudiente2_contactado: boolean;
    comentarios: string;
    correo_enviado: boolean;
    valor_pagado: number;
    requiere_beca: boolean;
    es_candidato: boolean;
    first_synced_at: string;
    last_synced_at: string;
}

interface BartimeoDetails extends BartimeoData {
    fecha_nacimiento: string;
    direccion: string;
    retiros_previos: string;
    inscrito_antes: string;
    sacramentos: string[];
    conoce_servidor: string;
    acudiente1_parentesco: string;
    acudiente1_email: string;
    acudiente2_parentesco: string;
    acudiente2_email: string;
    doc_identidad_url: string;
    doc_identidad_file_id: string;
    eps: string;
    eps_certificado_url: string;
    eps_certificado_file_id: string;
    autoriza_datos: boolean;
}

export default function BartimeosManager({ username, password }: { username: string, password: string }) {
    const [bartimeos, setBartimeos] = useState<BartimeoData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('date_asc');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [lastSync, setLastSync] = useState<any>(null);
    const [selectedBartimeo, setSelectedBartimeo] = useState<BartimeoDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    // Email Modal state
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailGender, setEmailGender] = useState<'chico' | 'chica'>('chica');
    const [emailTestMode, setEmailTestMode] = useState(true);
    
    // Edit state
    const [editingTracking, setEditingTracking] = useState(false);
    const [trackingState, setTrackingState] = useState({
        coordi: false,
        acudiente1: false,
        acudiente2: false,
        correo_enviado: false,
        comentarios: '',
        valor_pagado: 0,
        requiere_beca: false,
        es_candidato: false
    });
    const [savingTracking, setSavingTracking] = useState(false);

    const fetchBartimeos = async (query = '') => {
        setLoading(true);
        setFeedback('');
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'list', searchQuery: query, sortBy })
            });
            const result = await res.json();
            if (res.ok) {
                setBartimeos(result.data);
                if (result.lastSync) setLastSync(result.lastSync);
            } else {
                setFeedback(`Error: ${result.error}`);
            }
        } catch (e) {
            setFeedback('Error de conexión al cargar bartimeos');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setFeedback('');
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'sync' })
            });
            const data = await res.json();
            if (res.ok) {
                setFeedback(`✅ Sincronización exitosa: ${data.rows_read} leídos · ${data.inserted} nuevos · ${data.updated} actualizados · ${data.unchanged} sin cambios.`);
                fetchBartimeos(searchQuery);
            } else {
                setFeedback(`❌ Error de Sincronización: ${data.error}`);
            }
        } catch (e: any) {
            setFeedback(`❌ Error de conexión: ${e.message}`);
        } finally {
            setSyncing(false);
        }
    };

    const handleViewDetails = async (id: number) => {
        setLoadingDetails(true);
        setFeedback('');
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'details', id })
            });
            const data = await res.json();
            if (res.ok) {
                setSelectedBartimeo(data);
                setTrackingState({
                    coordi: !!data.coordi_contactado,
                    acudiente1: !!data.acudiente1_contactado,
                    acudiente2: !!data.acudiente2_contactado,
                    correo_enviado: !!data.correo_enviado,
                    comentarios: data.comentarios || '',
                    valor_pagado: data.valor_pagado || 0,
                    requiere_beca: !!data.requiere_beca,
                    es_candidato: !!data.es_candidato
                });
                setEditingTracking(false);
            } else {
                setFeedback(`Error: ${data.error}`);
            }
        } catch (e) {
            setFeedback('Error al cargar detalles del inscrito');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleSaveTracking = async () => {
        if (!selectedBartimeo) return;
        setSavingTracking(true);
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username, password, action: 'update_tracking',
                    id: selectedBartimeo.id,
                    coordi_contactado: trackingState.coordi,
                    acudiente1_contactado: trackingState.acudiente1,
                    acudiente2_contactado: trackingState.acudiente2,
                    correo_enviado: trackingState.correo_enviado,
                    comentarios: trackingState.comentarios,
                    valor_pagado: trackingState.valor_pagado,
                    requiere_beca: trackingState.requiere_beca,
                    es_candidato: trackingState.es_candidato
                })
            });
            if (res.ok) {
                const updated = {
                    ...selectedBartimeo,
                    coordi_contactado: trackingState.coordi ? 'true' : '',
                    acudiente1_contactado: trackingState.acudiente1,
                    acudiente2_contactado: trackingState.acudiente2,
                    correo_enviado: trackingState.correo_enviado,
                    comentarios: trackingState.comentarios,
                    valor_pagado: trackingState.valor_pagado,
                    requiere_beca: trackingState.requiere_beca,
                    es_candidato: trackingState.es_candidato
                };
                setSelectedBartimeo(updated);
                setBartimeos(bartimeos.map(b => b.id === selectedBartimeo.id ? updated : b));
                setEditingTracking(false);
            } else {
                alert('Error al guardar trazabilidad');
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setSavingTracking(false);
        }
    };

    const handleSendEmail = async () => {
        if (!selectedBartimeo) return;
        setSendingEmail(true);
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username, password, action: 'send_acceptance_email',
                    id: selectedBartimeo.id,
                    gender: emailGender,
                    isTestMode: emailTestMode
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Correo enviado exitosamente a: ${data.to.join(', ')}`);
                if (!emailTestMode) {
                    // Update local state to reflect the email was sent
                    const updated = { ...selectedBartimeo, correo_enviado: true };
                    setSelectedBartimeo(updated);
                    setBartimeos(bartimeos.map(b => b.id === selectedBartimeo.id ? updated : b));
                }
                setEmailModalOpen(false);
            } else {
                alert(`Error al enviar correo: ${data.error}`);
            }
        } catch (e) {
            alert('Error de conexión al enviar correo');
        } finally {
            setSendingEmail(false);
        }
    };

    useEffect(() => {
        fetchBartimeos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchBartimeos(searchQuery);
    };

    const requiresAttention = (text: string) => {
        if (!text) return false;
        const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return !["", "no", "ninguna", "ninguno", "n/a", "na", "-"].includes(norm);
    };

    return (
        <div className="space-y-6 relative">
            <div className="bg-[#161616] rounded-3xl p-6 md:p-8 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Coordinación Bartimeos — V Retiro</h2>
                    <p className="text-zinc-400 text-sm mt-1">
                        Total de inscritos: <span className="text-brand font-bold">{bartimeos.length}</span>
                        {lastSync && ` • Última actualización: ${new Date(lastSync.finished_at).toLocaleString()}`}
                    </p>
                </div>
                <button 
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-brand text-black px-6 py-3 rounded-xl font-bold hover:bg-white transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                >
                    {syncing ? (
                        <span className="animate-spin inline-block">⏳</span>
                    ) : '🔄'}
                    Actualizar desde formulario
                </button>
            </div>
            
            {feedback && (
                <div className={`p-4 border rounded-xl text-sm font-bold ${
                    feedback.includes('❌') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
                }`}>
                    {feedback}
                </div>
            )}

            <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 space-y-6">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, cédula o colegio..."
                        className="flex-grow bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand/50"
                    />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand/50"
                    >
                        <option value="date_asc">Orden de Inscripción</option>
                        <option value="date_desc">Más Recientes</option>
                        <option value="name">Alfabético</option>
                    </select>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-white/10 border border-white/20 text-white px-6 py-3 md:py-2 rounded-xl font-bold hover:bg-white/20 transition disabled:opacity-50 text-sm"
                    >
                        {loading ? '...' : 'Buscar'}
                    </button>
                </form>

                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0a0a0a]">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/5 text-zinc-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Participante</th>
                                <th className="p-4 font-bold">Colegio</th>
                                <th className="p-4 font-bold text-center">Talla</th>
                                <th className="p-4 font-bold text-center">Salud</th>
                                <th className="p-4 font-bold text-center">Trazabilidad</th>
                                <th className="p-4 font-bold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {bartimeos.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-zinc-500 italic">
                                        No hay inscritos aún. Presiona "Actualizar desde formulario".
                                    </td>
                                </tr>
                            ) : (
                                bartimeos.map((b) => {
                                    let rowColor = 'hover:bg-white/5';
                                    if (b.correo_enviado) {
                                        if (b.valor_pagado >= 500000) {
                                            rowColor = 'bg-green-900/20 hover:bg-green-900/30';
                                        } else {
                                            rowColor = 'bg-blue-900/20 hover:bg-blue-900/30';
                                        }
                                    }
                                    return (
                                        <tr key={b.id} className={`transition ${rowColor}`}>
                                            <td className="p-4">
                                            <div className="font-bold text-white flex items-center gap-2">
                                                {b.nombre_completo}
                                                {!b.autoriza_imagen && (
                                                    <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30" title="No autoriza uso de imagen">📸 No Foto</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-1">
                                                🪪 {b.documento_identidad} | 📱 {b.telefono_bartimeo} | {b.edad} años
                                            </div>
                                        </td>
                                        <td className="p-4 text-zinc-300">
                                            {b.colegio || '-'}
                                        </td>
                                        <td className="p-4 text-center font-bold text-zinc-300">
                                            {b.talla_camiseta || '-'}
                                        </td>
                                        <td className="p-4 text-center space-x-1">
                                            {requiresAttention(b.alergias) && <span title={`Alergias: ${b.alergias}`}>🔴</span>}
                                            {requiresAttention(b.restriccion_alimentaria) && <span title={`Dieta: ${b.restriccion_alimentaria}`}>🍽️</span>}
                                            {requiresAttention(b.condicion_medica) && <span title={`Médica: ${b.condicion_medica}`}>🏥</span>}
                                            {requiresAttention(b.medicamentos) && <span title={`Medicamentos: ${b.medicamentos}`}>💊</span>}
                                            {!requiresAttention(b.alergias) && !requiresAttention(b.restriccion_alimentaria) && !requiresAttention(b.condicion_medica) && !requiresAttention(b.medicamentos) && <span className="text-zinc-600">Ninguna</span>}
                                        </td>
                                        <td className="p-4 text-center text-xs space-y-1">
                                            <div className="flex items-center justify-center gap-1">
                                                {b.coordi_contactado ? <span className="text-green-400">📞 Coordi</span> : <span className="text-zinc-600">📞 Coordi</span>}
                                            </div>
                                            <div className="flex items-center justify-center gap-1">
                                                {b.correo_enviado ? <span className="text-green-400">✉️ OK</span> : <span className="text-zinc-600">✉️ No env</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleViewDetails(b.id)}
                                                disabled={loadingDetails}
                                                className="px-4 py-2 rounded-lg text-xs font-bold transition border bg-brand/10 border-brand/30 text-brand hover:bg-brand/20 disabled:opacity-50"
                                            >
                                                Ver Ficha
                                            </button>
                                        </td>
                                    </tr>
                                );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* User Details Modal */}
            {selectedBartimeo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#161616] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
                            <div>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    {selectedBartimeo.nombre_completo}
                                    {!selectedBartimeo.autoriza_imagen && (
                                        <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/30 uppercase tracking-wider font-bold">Sin Fotos</span>
                                    )}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1">
                                    🪪 {selectedBartimeo.documento_identidad} • 📱 {selectedBartimeo.telefono_bartimeo} • 🎂 {selectedBartimeo.fecha_nacimiento} ({selectedBartimeo.edad} años)
                                </p>
                            </div>
                            <button 
                                onClick={() => { setSelectedBartimeo(null); setEmailModalOpen(false); }}
                                className="text-zinc-500 hover:text-white transition p-2 bg-white/5 rounded-full"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Datos Bartimeo */}
                                <div className="space-y-4">
                                    <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Datos del Bartimeo</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-zinc-500">Colegio</div>
                                            <div className="text-white font-medium">{selectedBartimeo.colegio || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-zinc-500">Dirección</div>
                                            <div className="text-white font-medium">{selectedBartimeo.direccion || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-zinc-500">Talla de Camiseta</div>
                                            <div className="text-white font-medium font-bold">{selectedBartimeo.talla_camiseta || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-zinc-500">Retiros Previos</div>
                                            <div className="text-white font-medium">{selectedBartimeo.retiros_previos || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-zinc-500">Inscrito Antes</div>
                                            <div className="text-white font-medium">{selectedBartimeo.inscrito_antes || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-zinc-500">Conoce Servidor</div>
                                            <div className="text-white font-medium">{selectedBartimeo.conoce_servidor || '-'}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-zinc-500">Sacramentos</div>
                                            <div className="text-white font-medium">{selectedBartimeo.sacramentos && selectedBartimeo.sacramentos.length > 0 ? selectedBartimeo.sacramentos.join(', ') : '-'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Salud */}
                                <div className="space-y-4">
                                    <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Información de Salud</h4>
                                    <div className="space-y-3 text-sm">
                                        <div className="p-3 rounded-lg border border-white/5 bg-[#0a0a0a]">
                                            <div className="text-zinc-500">EPS o Prepagada</div>
                                            <div className="text-white font-medium">{selectedBartimeo.eps || '-'}</div>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.alergias) ? 'bg-red-500/10 border-red-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                            <div className={`${requiresAttention(selectedBartimeo.alergias) ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>Alergias</div>
                                            <div className="text-white">{selectedBartimeo.alergias || '-'}</div>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.restriccion_alimentaria) ? 'bg-yellow-500/10 border-yellow-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                            <div className={`${requiresAttention(selectedBartimeo.restriccion_alimentaria) ? 'text-yellow-400 font-bold' : 'text-zinc-500'}`}>Restricción Alimentaria</div>
                                            <div className="text-white">{selectedBartimeo.restriccion_alimentaria || '-'}</div>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.condicion_medica) ? 'bg-orange-500/10 border-orange-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                            <div className={`${requiresAttention(selectedBartimeo.condicion_medica) ? 'text-orange-400 font-bold' : 'text-zinc-500'}`}>Condición Médica/Psicológica</div>
                                            <div className="text-white">{selectedBartimeo.condicion_medica || '-'}</div>
                                        </div>
                                        <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.medicamentos) ? 'bg-blue-500/10 border-blue-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                            <div className={`${requiresAttention(selectedBartimeo.medicamentos) ? 'text-blue-400 font-bold' : 'text-zinc-500'}`}>Medicamentos</div>
                                            <div className="text-white">{selectedBartimeo.medicamentos || '-'}</div>
                                        </div>
                                    </div>
                                </div>

                            {/* Generador de Mensaje WA */}
                            {(() => {
                                const firstName = selectedBartimeo.nombre_completo.split(' ')[0] || 'tu hijo/a';
                                const getWpLink = (phone: string, acudienteName: string) => {
                                    if (!phone) return '#';
                                    const acudFirstName = (acudienteName || 'Acudiente').split(' ')[0];
                                    const msg = `🎉 ¡Hola ${acudFirstName}! Nos alegra muchísimo contarte que ${firstName} ha sido aceptado para participar en el *V Retiro Bartimeo* 🤍🙏. Te contamos que *ya hemos enviado a tu correo electrónico toda la información correspondiente al retiro*, incluyendo documentos pendientes, valor de la inversión, medios de pago y fechas importantes. Te agradecemos revisarlo con atención y quedamos muy atentos a cualquier inquietud. ¡Estamos muy felices de poder vivir esta experiencia junto a ${firstName}! 🥰✨`;
                                    const cleanPhone = phone.replace(/\\D/g, '');
                                    const finalPhone = cleanPhone.startsWith('57') ? cleanPhone : (cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone);
                                    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
                                };

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                        {/* Acudientes */}
                                        <div className="space-y-4">
                                            <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Acudientes</h4>
                                            <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/5 space-y-2 text-sm">
                                                <div className="font-bold text-white mb-2">Acudiente 1</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="text-zinc-500">Nombre</div><div className="text-white">{selectedBartimeo.acudiente1_nombre || '-'}</div>
                                                    <div className="text-zinc-500">Parentesco</div><div className="text-white">{selectedBartimeo.acudiente1_parentesco || '-'}</div>
                                                    <div className="text-zinc-500">Teléfono</div>
                                                    <div className="text-white font-bold flex items-center gap-2">
                                                        {selectedBartimeo.acudiente1_telefono || '-'}
                                                        {selectedBartimeo.acudiente1_telefono && (
                                                            <a href={getWpLink(selectedBartimeo.acudiente1_telefono, selectedBartimeo.acudiente1_nombre)} target="_blank" rel="noopener noreferrer" title="Hablar por WhatsApp" className="text-green-400 hover:text-green-300 transition text-lg bg-green-500/10 rounded-full px-2 py-0.5" style={{ textDecoration: 'none' }}>
                                                                <span role="img" aria-label="WhatsApp">💬</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div className="text-zinc-500">Email</div><div className="text-white truncate" title={selectedBartimeo.acudiente1_email}>{selectedBartimeo.acudiente1_email || '-'}</div>
                                                </div>
                                            </div>
                                            <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/5 space-y-2 text-sm">
                                                <div className="font-bold text-white mb-2">Acudiente 2</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="text-zinc-500">Nombre</div><div className="text-white">{selectedBartimeo.acudiente2_nombre || '-'}</div>
                                                    <div className="text-zinc-500">Parentesco</div><div className="text-white">{selectedBartimeo.acudiente2_parentesco || '-'}</div>
                                                    <div className="text-zinc-500">Teléfono</div>
                                                    <div className="text-white font-bold flex items-center gap-2">
                                                        {selectedBartimeo.acudiente2_telefono || '-'}
                                                        {selectedBartimeo.acudiente2_telefono && (
                                                            <a href={getWpLink(selectedBartimeo.acudiente2_telefono, selectedBartimeo.acudiente2_nombre)} target="_blank" rel="noopener noreferrer" title="Hablar por WhatsApp" className="text-green-400 hover:text-green-300 transition text-lg bg-green-500/10 rounded-full px-2 py-0.5" style={{ textDecoration: 'none' }}>
                                                                <span role="img" aria-label="WhatsApp">💬</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div className="text-zinc-500">Email</div><div className="text-white truncate" title={selectedBartimeo.acudiente2_email}>{selectedBartimeo.acudiente2_email || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Archivos y Trazabilidad */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Documentos Adjuntos</h4>
                                    <div className="flex flex-col gap-3">
                                            {selectedBartimeo.doc_identidad_url ? (
                                                <a href={selectedBartimeo.doc_identidad_url} target="_blank" rel="noopener noreferrer" className="bg-[#0a0a0a] border border-white/10 hover:border-brand p-3 rounded-lg flex items-center gap-3 transition">
                                                    <span className="text-2xl">🪪</span>
                                                    <div>
                                                        <div className="text-white font-bold text-sm">Documento de Identidad</div>
                                                        <div className="text-zinc-500 text-xs">Abrir en Google Drive</div>
                                                    </div>
                                                </a>
                                            ) : (
                                                <div className="bg-[#0a0a0a] border border-white/5 p-3 rounded-lg flex items-center gap-3 opacity-50">
                                                    <span className="text-2xl">🪪</span><div className="text-zinc-500 text-sm">Sin documento</div>
                                                </div>
                                            )}
                                            {selectedBartimeo.eps_certificado_url ? (
                                                <a href={selectedBartimeo.eps_certificado_url} target="_blank" rel="noopener noreferrer" className="bg-[#0a0a0a] border border-white/10 hover:border-brand p-3 rounded-lg flex items-center gap-3 transition">
                                                    <span className="text-2xl">🏥</span>
                                                    <div>
                                                        <div className="text-white font-bold text-sm">Certificado EPS</div>
                                                        <div className="text-zinc-500 text-xs">Abrir en Google Drive</div>
                                                    </div>
                                                </a>
                                            ) : (
                                                <div className="bg-[#0a0a0a] border border-white/5 p-3 rounded-lg flex items-center gap-3 opacity-50">
                                                    <span className="text-2xl">🏥</span><div className="text-zinc-500 text-sm">Sin certificado</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Trazabilidad (Editable por Coordi) */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                            <h4 className="text-brand font-bold text-sm uppercase tracking-widest">Trazabilidad Interna</h4>
                                            {!editingTracking ? (
                                                <button onClick={() => setEditingTracking(true)} className="text-xs font-bold text-brand hover:text-white transition">Editar</button>
                                            ) : (
                                                <div className="space-x-2">
                                                    <button onClick={() => setEditingTracking(false)} className="text-xs text-zinc-500 hover:text-white transition">Cancelar</button>
                                                    <button onClick={handleSaveTracking} disabled={savingTracking} className="text-xs font-bold bg-brand text-black px-2 py-1 rounded hover:bg-white transition">{savingTracking ? '...' : 'Guardar'}</button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/5 space-y-4 text-sm">
                                            {!editingTracking ? (
                                                <div className="space-y-3">
                                                    {/* Status Pills */}
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${selectedBartimeo.es_candidato ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                            {selectedBartimeo.es_candidato ? '✅ Es Candidato' : '❌ No Clasifica'}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${selectedBartimeo.correo_enviado ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10'}`}>
                                                            {selectedBartimeo.correo_enviado ? '✉️ Correo Enviado' : '✉️ Sin Enviar'}
                                                        </span>
                                                        {selectedBartimeo.requiere_beca && (
                                                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                                🪙 Requiere Beca
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                                        <span className="text-zinc-500">Coordi a cargo</span>
                                                        <span className="text-white font-bold">{selectedBartimeo.coordi_contactado || '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                                        <span className="text-zinc-500">Llamada Acudiente 1</span>
                                                        <span className={selectedBartimeo.acudiente1_contactado ? 'text-green-400 font-bold' : 'text-zinc-500'}>{selectedBartimeo.acudiente1_contactado ? 'Sí' : 'No'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                                        <span className="text-zinc-500">Llamada Acudiente 2</span>
                                                        <span className={selectedBartimeo.acudiente2_contactado ? 'text-green-400 font-bold' : 'text-zinc-500'}>{selectedBartimeo.acudiente2_contactado ? 'Sí' : 'No'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                                        <span className="text-zinc-500">Valor Pagado</span>
                                                        <span className={`font-mono font-bold text-lg ${selectedBartimeo.valor_pagado >= 500000 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                            ${(selectedBartimeo.valor_pagado || 0).toLocaleString('es-CO')}
                                                        </span>
                                                    </div>
                                                    
                                                    {selectedBartimeo.comentarios && (
                                                        <div className="pt-2">
                                                            <div className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Comentarios Especiales</div>
                                                            <div className="text-white whitespace-pre-wrap bg-white/5 p-3 rounded-lg border border-white/10">{selectedBartimeo.comentarios}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-zinc-400 font-bold text-xs mb-2 uppercase tracking-wider">¿Quién lo contactó?</label>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {['Aleja', 'Nico', 'Jesus'].map(coord => (
                                                                <button 
                                                                    key={coord}
                                                                    onClick={() => setTrackingState({...trackingState, coordi_contactado: trackingState.coordi_contactado === coord ? '' : coord})}
                                                                    className={`py-2 rounded-lg text-sm font-bold border transition ${trackingState.coordi_contactado === coord ? 'bg-brand text-black border-brand' : 'bg-[#111] text-zinc-400 border-white/10 hover:border-white/30'}`}
                                                                >
                                                                    {coord}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-zinc-400 font-bold text-xs mb-2 uppercase tracking-wider">Contactos Telefónicos</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button 
                                                                onClick={() => setTrackingState({...trackingState, acudiente1_contactado: !trackingState.acudiente1_contactado})}
                                                                className={`py-2 rounded-lg text-sm font-bold border transition flex items-center justify-center gap-2 ${trackingState.acudiente1_contactado ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-[#111] text-zinc-400 border-white/10 hover:border-white/30'}`}
                                                            >
                                                                {trackingState.acudiente1_contactado ? '✅ Acu. 1' : '📞 Acu. 1'}
                                                            </button>
                                                            <button 
                                                                onClick={() => setTrackingState({...trackingState, acudiente2_contactado: !trackingState.acudiente2_contactado})}
                                                                className={`py-2 rounded-lg text-sm font-bold border transition flex items-center justify-center gap-2 ${trackingState.acudiente2_contactado ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-[#111] text-zinc-400 border-white/10 hover:border-white/30'}`}
                                                            >
                                                                {trackingState.acudiente2_contactado ? '✅ Acu. 2' : '📞 Acu. 2'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-zinc-400 font-bold text-xs mb-2 uppercase tracking-wider">Estados del Participante</label>
                                                        <div className="flex flex-col gap-2">
                                                            <button 
                                                                onClick={() => setTrackingState({...trackingState, es_candidato: !trackingState.es_candidato})}
                                                                className={`p-3 rounded-lg text-sm font-bold border transition flex items-center justify-between ${trackingState.es_candidato ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-[#111] text-zinc-400 border-white/10 hover:border-white/30'}`}
                                                            >
                                                                <span>Es Candidato (Clasifica)</span>
                                                                <span>{trackingState.es_candidato ? '✅' : '❌'}</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => setTrackingState({...trackingState, correo_enviado: !trackingState.correo_enviado})}
                                                                className={`p-3 rounded-lg text-sm font-bold border transition flex items-center justify-between ${trackingState.correo_enviado ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-[#111] text-zinc-400 border-white/10 hover:border-white/30'}`}
                                                            >
                                                                <span>Correo Aceptación Enviado</span>
                                                                <span>{trackingState.correo_enviado ? '✅' : '❌'}</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => setTrackingState({...trackingState, requiere_beca: !trackingState.requiere_beca})}
                                                                className={`p-3 rounded-lg text-sm font-bold border transition flex items-center justify-between ${trackingState.requiere_beca ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-[#111] text-zinc-400 border-white/10 hover:border-white/30'}`}
                                                            >
                                                                <span>Requiere Beca</span>
                                                                <span>{trackingState.requiere_beca ? '✅' : '❌'}</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-zinc-400 font-bold text-xs mb-2 uppercase tracking-wider">Valor Pagado ($)</label>
                                                        <input 
                                                            type="number"
                                                            value={trackingState.valor_pagado || 0}
                                                            onChange={e => setTrackingState({...trackingState, valor_pagado: parseInt(e.target.value) || 0})}
                                                            className="w-full bg-[#111] border border-brand/50 rounded-lg p-3 text-white text-lg font-mono focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                                                            placeholder="Ej: 500000"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-zinc-400 font-bold text-xs mb-2 uppercase tracking-wider">Comentarios Especiales</label>
                                                        <textarea 
                                                            value={trackingState.comentarios} 
                                                            onChange={e => setTrackingState({...trackingState, comentarios: e.target.value})}
                                                            className="w-full bg-[#111] border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand h-24 resize-none"
                                                            placeholder="Anotaciones logísticas, dudas sobre el pago, etc."
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-6 mt-4 flex justify-between items-center bg-[#0a0a0a] p-4 rounded-xl">
                                <div>
                                    <h4 className="text-white font-bold text-sm">Notificación de Aceptación</h4>
                                    <p className="text-xs text-zinc-500 mt-1">Envía el correo oficial a los acudientes.</p>
                                    {!selectedBartimeo.es_candidato && (
                                        <p className="text-xs text-red-400 mt-1 font-bold">⚠️ Debes marcar "Es Candidato" en el seguimiento antes de enviar el correo.</p>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setEmailModalOpen(true)}
                                    disabled={!selectedBartimeo.es_candidato}
                                    className="bg-brand text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ✉️ ENVIAR CORREO ACEPTACION
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Email Confirmation Modal */}
            {emailModalOpen && selectedBartimeo && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#111] border border-brand/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-2">Enviar Correo de Aceptación</h3>
                        <p className="text-sm text-zinc-400 mb-6">Se enviará el correo a los acudientes de <strong>{selectedBartimeo.nombre_completo}</strong> con la imagen de cobro adjunta.</p>
                        
                        {selectedBartimeo.correo_enviado && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6">
                                <p className="text-red-400 text-sm font-bold flex items-center gap-2">
                                    ⚠️ ¡Atención!
                                </p>
                                <p className="text-red-400/80 text-xs mt-1">Este participante ya tiene marcado el correo de aceptación como enviado. Si continúas, podrías enviar un correo duplicado a los padres.</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
                                <label className="block text-white text-sm font-bold mb-3">¿El participante es chico o chica?</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="gender" checked={emailGender === 'chico'} onChange={() => setEmailGender('chico')} className="accent-brand w-4 h-4" />
                                        <span className="text-zinc-300 text-sm">Chico (hijo, el joven)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="gender" checked={emailGender === 'chica'} onChange={() => setEmailGender('chica')} className="accent-brand w-4 h-4" />
                                        <span className="text-zinc-300 text-sm">Chica (hija, la joven)</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/30">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={emailTestMode} onChange={(e) => setEmailTestMode(e.target.checked)} className="accent-yellow-500 w-5 h-5 mt-0.5" />
                                    <div>
                                        <span className="block text-yellow-400 text-sm font-bold">Modo de Prueba</span>
                                        <span className="block text-yellow-500/70 text-xs mt-1">Si está marcado, el correo NO se enviará a los acudientes reales, sino a <strong>jedatrasfu@gmail.com</strong> para verificar que todo se vea bien.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3 justify-end">
                            <button 
                                onClick={() => setEmailModalOpen(false)}
                                disabled={sendingEmail}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSendEmail}
                                disabled={sendingEmail}
                                className="px-6 py-2 rounded-lg text-sm font-bold bg-brand text-black hover:bg-white transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {sendingEmail ? 'Enviando...' : 'Confirmar y Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
