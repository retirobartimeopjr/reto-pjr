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
        <div className="bg-[#1a1a1a] rounded-3xl p-6 border border-white/10 mt-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-brand flex items-center gap-2">
                        <span>⚠️</span> Visitas Sospechosas
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">
                        Registros que requieren revisión (teletransportación o falla de cámara)
                    </p>
                </div>
                <button
                    onClick={fetchVisits}
                    disabled={loading}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-sm font-bold disabled:opacity-50"
                >
                    {loading ? 'Cargando...' : 'Actualizar'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl mb-4">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-zinc-400 text-sm">
                            <th className="p-3 font-medium">Usuario</th>
                            <th className="p-3 font-medium">Teléfono</th>
                            <th className="p-3 font-medium">Parroquia</th>
                            <th className="p-3 font-medium">Fecha/Hora</th>
                            <th className="p-3 font-medium">Razón</th>
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
                                    <td className="p-3 font-bold text-white">{visit.username}</td>
                                    <td className="p-3 text-zinc-300 font-mono">{visit.phone}</td>
                                    <td className="p-3 text-brand">{visit.parroquia_name}</td>
                                    <td className="p-3 text-zinc-400">
                                        {new Date(visit.visited_at).toLocaleString('es-CO')}
                                    </td>
                                    <td className="p-3 text-red-400">{visit.flag_reason}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
