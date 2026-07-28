import { useState, useEffect } from 'react';

interface FlaggedVisit {
    id: string;
    points_awarded: number;
    visited_at: string;
    flag_reason: string;
    username: string;
    phone: string;
    parroquia_name: string;
}

export default function FlaggedVisitsManager() {
    const [visits, setVisits] = useState<FlaggedVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchVisits = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/flaggedVisits');
            if (!res.ok) {
                throw new Error('Error al cargar las visitas');
            }
            const data = await res.json();
            setVisits(data);
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVisits();
    }, []);

    return (
        <div className="space-y-6">
            <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-red-500">⚠️</span> Visitas Sospechosas
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">
                        Registros que requieren revisión (teletransportación o falla de cámara)
                    </p>
                </div>
                <button
                    onClick={fetchVisits}
                    disabled={loading}
                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition text-sm font-bold disabled:opacity-50 text-white"
                >
                    {loading ? 'Cargando...' : 'Actualizar Lista'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold">
                    {error}
                </div>
            )}

            <div className="bg-[#161616] rounded-3xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-zinc-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Usuario</th>
                                <th className="p-4 font-bold">Teléfono</th>
                                <th className="p-4 font-bold">Parroquia</th>
                                <th className="p-4 font-bold">Fecha/Hora</th>
                                <th className="p-4 font-bold">Razón</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {visits.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-500 italic">
                                        No hay visitas sospechosas reportadas.
                                    </td>
                                </tr>
                            ) : (
                                visits.map((visit) => (
                                    <tr key={visit.id} className="hover:bg-white/5 transition">
                                        <td className="p-4 font-bold text-white">{visit.username}</td>
                                        <td className="p-4 text-zinc-400 font-mono text-xs">{visit.phone}</td>
                                        <td className="p-4 text-brand font-medium">{visit.parroquia_name}</td>
                                        <td className="p-4 text-zinc-400 text-xs">
                                            {new Date(visit.visited_at).toLocaleString('es-CO')}
                                        </td>
                                        <td className="p-4 text-red-400 font-medium text-xs">{visit.flag_reason}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
