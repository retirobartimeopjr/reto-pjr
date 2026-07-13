import { useState, useEffect } from 'react';
import ParroquiasManager from './ParroquiasManager';
import FlaggedVisitsManager from './FlaggedVisitsManager';

export default function AdminPanel() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('Jesus');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(false);

    // Estado del Reto
    const [isActive, setIsActive] = useState(true);
    const [message, setMessage] = useState("¡El Reto ha terminado!");
    const [proximityThreshold, setProximityThreshold] = useState(350);
    const [statusFeedback, setStatusFeedback] = useState('');

    // Fetch initial state
    useEffect(() => {
        const fetchState = async () => {
            try {
                const res = await fetch('/api/appConfig');
                if (res.ok) {
                    const data = await res.json();
                    setIsActive(data.active);
                    setMessage(data.message || "¡El Reto ha terminado!");
                    if (data.proximity_threshold) setProximityThreshold(data.proximity_threshold);
                }
            } catch (e) {
                console.error("Error fetching config:", e);
            }
        };
        fetchState();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setLoginError('');

        // Hacemos un POST "dummy" solo para verificar si las credenciales son válidas, o enviamos un estado neutro
        try {
            const res = await fetch('/api/appConfig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, active: isActive, message })
            });
            const data = await res.json();

            if (res.ok) {
                setIsAuthenticated(true);
                setIsActive(data.state.active);
                setMessage(data.state.message);
                if (data.state.proximity_threshold) setProximityThreshold(data.state.proximity_threshold);
            } else {
                setLoginError(data.error || 'Error de autenticación');
            }
        } catch (error) {
            setLoginError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateState = async (newActiveState: boolean) => {
        setLoading(true);
        setStatusFeedback('');
        try {
            const res = await fetch('/api/appConfig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, active: newActiveState ?? isActive, message, proximity_threshold: proximityThreshold })
            });
            const data = await res.json();

            if (res.ok) {
                setIsActive(data.state.active);
                setMessage(data.state.message);
                if (data.state.proximity_threshold) setProximityThreshold(data.state.proximity_threshold);
                setStatusFeedback('Estado actualizado correctamente ✅');
                setTimeout(() => setStatusFeedback(''), 3000);
            } else {
                setStatusFeedback(`Error: ${data.error}`);
            }
        } catch (error) {
            setStatusFeedback('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center p-4">
                <div className="bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl border border-brand/20 w-full max-w-md">
                    <h2 className="text-3xl font-serif text-brand text-center mb-6">🔐 Acceso Coordi</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="text-zinc-400 text-sm font-bold mb-1 block">Coordinador</label>
                            <select
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand"
                            >
                                <option value="Aleja">Aleja</option>
                                <option value="Nico">Nico</option>
                                <option value="Jesus">Jesus</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-zinc-400 text-sm font-bold mb-1 block">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand"
                                placeholder="******"
                            />
                        </div>
                        {loginError && <p className="text-red-400 text-sm font-bold text-center">{loginError}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand text-black font-bold p-3 rounded-xl hover:bg-brand/80 transition disabled:opacity-50 mt-4"
                        >
                            {loading ? 'Verificando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111] p-4 md:p-8 text-white">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="bg-[#1a1a1a] rounded-3xl p-6 border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 max-w-2xl mx-auto w-full">
                    <div>
                        <h1 className="text-2xl font-bold text-brand">Centro de Control</h1>
                        <p className="text-zinc-400">Hola, {username}. Estás en vivo.</p>
                    </div>
                    <div className="px-4 py-2 bg-black/50 rounded-full border border-white/5 text-sm font-mono flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                        {isActive ? 'RETO ONLINE' : 'RETO BLOQUEADO'}
                    </div>
                </div>

                {/* Main Controls */}
                <div className="bg-[#1a1a1a] rounded-3xl p-8 border border-white/10 space-y-8 max-w-2xl mx-auto w-full">
                    
                    {/* The Big Switch */}
                    <div className="flex flex-col items-center p-8 bg-black/30 rounded-2xl border border-white/5">
                        <h2 className="text-xl font-bold mb-6 text-center">Master Switch</h2>
                        <button
                            onClick={() => handleUpdateState(!isActive)}
                            disabled={loading}
                            className={`w-32 h-16 rounded-full p-1 transition-all duration-300 relative ${
                                isActive ? 'bg-green-500/20 border-green-500/50' : 'bg-red-500/20 border-red-500/50'
                            } border-2`}
                        >
                            <div className={`w-13 h-13 bg-white rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center ${
                                isActive ? 'translate-x-16 bg-green-500 shadow-green-500/50' : 'translate-x-0 bg-red-500 shadow-red-500/50'
                            }`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                        </button>
                        <p className="mt-4 font-bold text-zinc-400">
                            {isActive ? 'El reto está corriendo normalmente' : 'El reto está BLOQUEADO para todos'}
                        </p>
                    </div>

                    {/* Custom Message */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-zinc-400 text-sm font-bold block mb-2">Mensaje de Bloqueo (Se mostrará cuando apagues el reto)</label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-brand h-32 resize-none text-lg text-center"
                                placeholder="Ej: Reto pausado temporalmente..."
                            />
                        </div>
                        <button
                            onClick={() => handleUpdateState(isActive)}
                            disabled={loading}
                            className="w-full border border-white/20 text-white font-bold py-3 rounded-xl hover:bg-white/5 transition"
                        >
                            Guardar solo el mensaje
                        </button>
                    </div>

                    {/* Proximity Threshold */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-zinc-400 text-sm font-bold block mb-2">Radio de Proximidad del GPS (metros)</label>
                            <input
                                type="number"
                                value={proximityThreshold}
                                onChange={e => setProximityThreshold(Number(e.target.value))}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-brand text-lg text-center"
                                placeholder="Ej: 350"
                            />
                        </div>
                        <button
                            onClick={() => handleUpdateState(isActive)}
                            disabled={loading}
                            className="w-full border border-brand/50 text-brand font-bold py-3 rounded-xl hover:bg-brand/10 transition"
                        >
                            Guardar Radio de Proximidad
                        </button>
                    </div>

                    {statusFeedback && (
                        <div className="p-4 bg-brand/10 border border-brand/30 text-brand text-center rounded-xl font-bold animate-in fade-in zoom-in">
                            {statusFeedback}
                        </div>
                    )}
                </div>

                {/* --- SECCIÓN VISITAS SOSPECHOSAS --- */}
                <FlaggedVisitsManager />

                {/* --- NUEVA SECCIÓN DE PARROQUIAS --- */}
                <ParroquiasManager />
            </div>
        </div>
    );
}
