import { useState, useEffect } from 'react';
import { Users, CheckCircle2, MessageCircle } from 'lucide-react';

interface PastParticipant {
    id: string;
    phone: string;
    username: string;
    email: string;
    parroquias_visitadas: string;
    respuestas_correctas: number;
    referidos: number;
    score: number;
    contacted: boolean;
}

export default function PastParticipantsManager() {
    const [participants, setParticipants] = useState<PastParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [messageType, setMessageType] = useState<'neutral' | 'personalizado'>('neutral');

    const fetchParticipants = async () => {
        try {
            const res = await fetch('/api/coordi/pastParticipants');
            if (!res.ok) throw new Error('Error al cargar datos');
            const data = await res.json();
            if (data.success) {
                setParticipants(data.data);
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchParticipants();
    }, []);

    const toggleContacted = async (id: string, currentStatus: boolean) => {
        // Optimistic update
        setParticipants(prev => prev.map(p => p.id === id ? { ...p, contacted: !currentStatus } : p));
        
        try {
            const res = await fetch('/api/coordi/pastParticipants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_contacted', id, contacted: !currentStatus })
            });
            if (!res.ok) {
                // Revert on error
                setParticipants(prev => prev.map(p => p.id === id ? { ...p, contacted: currentStatus } : p));
            }
        } catch (e) {
            setParticipants(prev => prev.map(p => p.id === id ? { ...p, contacted: currentStatus } : p));
        }
    };

    const getWhatsAppMessage = (name: string) => {
        const firstName = name.split(' ')[0] || 'amigo/a';
        
        if (messageType === 'neutral') {
            return `¡Hola ${firstName}! \uD83D\uDD4A\uFE0F\n\nQue el Señor te bendiga. Te escribimos desde la Familia Bartimeo. Antes de cualquier cosa, queremos darte las gracias. Nos ayudaste mucho para el retiro pasado y no lo olvidamos.\n\nEstamos abriendo la segunda edición del Reto Bartimeo y queríamos avisarte antes de que empiece.\n\nArranca el 24 de agosto y hay un mes, hasta el 24 de septiembre, para sumar puntos con invitados, visitas a parroquias y las Bartipreguntas del día. \uD83C\uDFC6 $2.000.000 al primero, $1.000.000 al segundo y $500.000 en el sorteo final.\n\nTodo es para el V Retiro de los jóvenes. \uD83D\uDE4F\n\n\uD83C\uDFAB Boleta: $20.000 COP\n\uD83D\uDCF2 Nequi / llave: 318 2004659\n\uD83D\uDD17 retirobartimeo.org\n\nNos encantaría volver a caminar contigo participando en el reto o apoyándonos con alguna boleta. De cualquier manera, te damos gracias y te pedimos oración por los jóvenes del retiro. "¡Ánimo, levántate! Te llama." (Mc 10,49)`;
        } else {
            return `Mi queridísimo/a ${firstName} \uD83E\uDD0D\n\nQué alegría saludarte. Te escribimos para invitarte a ser parte del Reto Bartimeo de este año. Sabemos lo valioso que fue tu proceso antes y nos encantaría contar contigo de nuevo. \uD83D\uDE4F\uD83C\uDFFD\n\nPuedes inscribirte en: retirobartimeo.org`;
        }
    };

    const handleWhatsApp = (phone: string, name: string) => {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '57' + cleanPhone; // Asumimos Colombia si tiene 10 dígitos

        const message = encodeURIComponent(getWhatsAppMessage(name));
        window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    };

    const filteredParticipants = participants.filter(p => 
        (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.phone || '').includes(searchTerm)
    );

    const contactedCount = participants.filter(p => p.contacted).length;

    if (loading) return <div className="text-white p-8">Cargando...</div>;
    if (error) return <div className="text-red-400 p-8">Error: {error}</div>;

    return (
        <div className="text-white p-4 max-w-6xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold font-outfit flex items-center gap-2">
                        <Users className="w-6 h-6 text-brand" />
                        Participantes Pasados
                    </h2>
                    <p className="text-zinc-400 mt-1">Contactados: {contactedCount} / {participants.length}</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="bg-zinc-800/50 p-1 rounded-lg flex text-sm w-full sm:w-auto">
                        <button
                            onClick={() => setMessageType('neutral')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-colors ${messageType === 'neutral' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            Neutral
                        </button>
                        <button
                            onClick={() => setMessageType('personalizado')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-colors ${messageType === 'personalizado' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            Personalizado
                        </button>
                    </div>
                    
                    <input 
                        type="text" 
                        placeholder="Buscar nombre o teléfono..." 
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:border-brand"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/5 text-zinc-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">Estado</th>
                                <th className="px-6 py-4 font-medium">Nombre</th>
                                <th className="px-6 py-4 font-medium">Teléfono</th>
                                <th className="px-6 py-4 font-medium">Puntaje Pasado</th>
                                <th className="px-6 py-4 font-medium text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredParticipants.map(p => (
                                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => toggleContacted(p.id, p.contacted)}
                                            className={`flex items-center gap-2 transition-colors ${p.contacted ? 'text-green-400' : 'text-zinc-500 hover:text-white'}`}
                                        >
                                            <CheckCircle2 className="w-5 h-5" />
                                            {p.contacted ? 'Contactado' : 'Pendiente'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 font-medium">
                                        {p.username || 'Sin Nombre'}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-300">
                                        {p.phone}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-brand font-bold">{p.score} pts</span>
                                            <span className="text-xs text-zinc-500">{p.respuestas_correctas} correctas | {p.referidos} referidos</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleWhatsApp(p.phone, p.username)}
                                            disabled={!p.phone}
                                            className="inline-flex items-center justify-center p-2 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Enviar WhatsApp"
                                        >
                                            <MessageCircle className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredParticipants.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                        No se encontraron participantes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
