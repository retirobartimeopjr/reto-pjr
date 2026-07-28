import { useState, useEffect } from 'react';
import ParroquiasManager from './ParroquiasManager';
import FlaggedVisitsManager from './FlaggedVisitsManager';
import UsersManager from './UsersManager';
import MessagingPanel from './MessagingPanel';

export default function AdminPanel() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('Jesus');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(false);

    // Estado del Reto
    const [isActive, setIsActive] = useState(true);
    const [message, setMessage] = useState("¡El Reto ha terminado!");
    const [proximityThreshold, setProximityThreshold] = useState<number>(350);
    const [challengeStartTime, setChallengeStartTime] = useState<string>('');
    const [challengeEndTime, setChallengeEndTime] = useState<string>('');
    const [statusFeedback, setStatusFeedback] = useState('');

    // UI State
    const [activeTab, setActiveTab] = useState<'general' | 'visitas' | 'parroquias' | 'participantes' | 'mensajeria'>('general');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
                    if (data.challenge_start_time) {
                        // Format the ISO string to YYYY-MM-DDThh:mm for datetime-local input
                        const dateObj = new Date(data.challenge_start_time);
                        if (!isNaN(dateObj.getTime())) {
                            const tzOffset = dateObj.getTimezoneOffset() * 60000; // offset in milliseconds
                            const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                            setChallengeStartTime(localISOTime);
                        }
                    }
                    if (data.challenge_end_time) {
                        const dateObj = new Date(data.challenge_end_time);
                        if (!isNaN(dateObj.getTime())) {
                            const tzOffset = dateObj.getTimezoneOffset() * 60000;
                            const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                            setChallengeEndTime(localISOTime);
                        }
                    }
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
            const payload: any = { username, password, active: isActive, message };
            const res = await fetch('/api/appConfig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                setIsAuthenticated(true);
                setIsActive(data.state.active);
                setMessage(data.state.message);
                if (data.state.proximity_threshold) setProximityThreshold(data.state.proximity_threshold);
                if (data.state.challenge_start_time) {
                    const dateObj = new Date(data.state.challenge_start_time);
                    if (!isNaN(dateObj.getTime())) {
                        const tzOffset = dateObj.getTimezoneOffset() * 60000;
                        const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                        setChallengeStartTime(localISOTime);
                    }
                }
                if (data.state.challenge_end_time) {
                    const dateObj = new Date(data.state.challenge_end_time);
                    if (!isNaN(dateObj.getTime())) {
                        const tzOffset = dateObj.getTimezoneOffset() * 60000;
                        const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                        setChallengeEndTime(localISOTime);
                    }
                }
            } else {
                setLoginError(data.error || 'Login fallido');
            }
        } catch (e) {
            setLoginError('Error de red al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateState = async (newActiveState: boolean) => {
        setLoading(true);
        setStatusFeedback('');
        try {
            const isoStartTime = challengeStartTime ? new Date(challengeStartTime).toISOString() : null;
            const isoEndTime = challengeEndTime ? new Date(challengeEndTime).toISOString() : null;
            
            const payload: any = {
                username,
                password,
                active: newActiveState,
                message,
                proximityThreshold,
                challenge_start_time: isoStartTime,
                challenge_end_time: isoEndTime
            };

            const res = await fetch('/api/appConfig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                setIsActive(data.state.active);
                setMessage(data.state.message);
                setStatusFeedback('Configuración actualizada correctamente');
                setTimeout(() => setStatusFeedback(''), 3000);
            } else {
                setStatusFeedback('Error: ' + (data.error || 'No se pudo actualizar'));
            }
        } catch (e) {
            setStatusFeedback('Error de red al actualizar estado');
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

    const renderContent = () => {
        if (!isAuthenticated) return null;

        if (activeTab === 'visitas') {
            return <FlaggedVisitsManager username={username} password={password} />;
        }
        if (activeTab === 'parroquias') {
            return <ParroquiasManager username={username} password={password} />;
        }
        if (activeTab === 'participantes') {
            return <UsersManager username={username} password={password} />;
        }
        if (activeTab === 'mensajeria') {
            return <MessagingPanel username={username} password={password} />;
        }
        
        // General Tab (Bento Dashboard)
        return (
            <div className="space-y-6">
                {/* Header Profile / Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-[#161616] rounded-3xl p-6 border border-white/5 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-brand/5 blur-[100px] rounded-full pointer-events-none"></div>
                        <div>
                            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-1">Visión General</h2>
                            <h1 className="text-3xl font-serif text-white mb-2">Centro de Control</h1>
                            <p className="text-zinc-400">Hola, <span className="text-brand font-medium">{username}</span>. Estás administrando el evento en vivo.</p>
                        </div>
                        <div className="mt-8 flex items-center gap-3">
                            <div className={`px-4 py-2 rounded-full border text-sm font-mono flex items-center gap-2 ${isActive ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                {isActive ? 'RETO ONLINE - Sistema Activo' : 'RETO BLOQUEADO - Acceso Restringido'}
                            </div>
                        </div>
                    </div>

                    {/* Master Switch */}
                    <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center text-center">
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Master Switch</h2>
                        <button
                            onClick={() => handleUpdateState(!isActive)}
                            disabled={loading}
                            className={`w-32 h-16 rounded-full p-1 transition-all duration-300 relative ${
                                isActive ? 'bg-green-500/20 border-green-500/50' : 'bg-red-500/20 border-red-500/50'
                            } border-2`}
                        >
                            <div className={`w-13 h-13 bg-white rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center ${
                                isActive ? 'translate-x-16 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'translate-x-0 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                            }`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Configuration Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Inicio del Reto */}
                    <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 flex flex-col h-full">
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Inicio Oficial del Reto</h2>
                        <p className="text-xs text-zinc-400 mb-3">Fecha y hora en la que se habilitarán las trivias, el mapa y se revelarán los puntajes ocultos en el ranking.</p>
                        <div className="flex-1 flex flex-col justify-center">
                            <input
                                type="datetime-local"
                                value={challengeStartTime}
                                onChange={e => setChallengeStartTime(e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-brand/50 text-sm md:text-base font-bold text-center"
                            />
                        </div>
                        <button
                            onClick={() => handleUpdateState(isActive)}
                            disabled={loading}
                            className="w-full mt-4 bg-brand/10 border border-brand/30 text-brand font-bold py-3 rounded-xl hover:bg-brand/20 transition text-sm"
                        >
                            Guardar Fecha/Hora
                        </button>
                    </div>

                    {/* Fin del Reto */}
                    <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 flex flex-col h-full">
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Fin Oficial del Reto</h2>
                        <p className="text-xs text-zinc-400 mb-3">Fecha y hora en la que se bloquearán las interacciones y el reto finalizará oficialmente.</p>
                        <div className="flex-1 flex flex-col justify-center">
                            <input
                                type="datetime-local"
                                value={challengeEndTime}
                                onChange={e => setChallengeEndTime(e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-red-500/50 text-sm md:text-base font-bold text-center"
                            />
                        </div>
                        <button
                            onClick={() => handleUpdateState(isActive)}
                            disabled={loading}
                            className="w-full mt-4 bg-red-500/10 border border-red-500/30 text-red-500 font-bold py-3 rounded-xl hover:bg-red-500/20 transition text-sm"
                        >
                            Guardar Fecha/Hora de Fin
                        </button>
                    </div>

                    {/* Mensaje de Bloqueo */}
                    <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 flex flex-col h-full">
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Mensaje de Bloqueo</h2>
                        <p className="text-xs text-zinc-400 mb-3">Texto que verán los usuarios si el sistema está apagado.</p>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="flex-1 w-full bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-brand/50 resize-none text-sm min-h-[100px]"
                            placeholder="Ej: Reto pausado temporalmente..."
                        />
                        <button
                            onClick={() => handleUpdateState(isActive)}
                            disabled={loading}
                            className="w-full mt-4 bg-white/5 border border-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/10 transition text-sm"
                        >
                            Guardar Mensaje
                        </button>
                    </div>

                    {/* Radio GPS */}
                    <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 flex flex-col h-full">
                        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Configuración GPS</h2>
                        <p className="text-xs text-zinc-400 mb-3">Radio de proximidad para Check-In válido (en metros).</p>
                        <div className="flex-1 flex flex-col justify-center">
                            <input
                                type="number"
                                value={proximityThreshold}
                                onChange={e => setProximityThreshold(Number(e.target.value))}
                                className="w-full bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 text-white focus:outline-none focus:border-brand/50 text-4xl text-center font-bold"
                                placeholder="350"
                            />
                        </div>
                        <button
                            onClick={() => handleUpdateState(isActive)}
                            disabled={loading}
                            className="w-full mt-4 bg-brand/10 border border-brand/30 text-brand font-bold py-3 rounded-xl hover:bg-brand/20 transition text-sm"
                        >
                            Guardar Distancia
                        </button>
                    </div>
                </div>

                {statusFeedback && (
                    <div className="p-4 bg-brand/10 border border-brand/30 text-brand text-center rounded-xl font-bold text-sm">
                        {statusFeedback}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row font-sans">
            
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-[#111] border-b border-white/5 z-20">
                <div className="font-serif text-xl text-brand font-bold">Coordi.</div>
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 bg-white/5 rounded-lg border border-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                    </svg>
                </button>
            </div>

            {/* Sidebar Navigation */}
            <aside className={`
                fixed inset-y-0 left-0 z-10 w-64 bg-[#111] border-r border-white/5 transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0 flex flex-col
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 hidden md:block">
                    <div className="font-serif text-2xl text-brand font-bold tracking-tight">Bartimeo</div>
                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Coordi Journal</div>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto mt-16 md:mt-0">
                    <button 
                        onClick={() => { setActiveTab('general'); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
                            activeTab === 'general' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        Vista General
                    </button>
                    
                    <button 
                        onClick={() => { setActiveTab('visitas'); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
                            activeTab === 'visitas' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Alertas Sospechosas
                    </button>

                    <button 
                        onClick={() => { setActiveTab('participantes'); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
                            activeTab === 'participantes' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        Participantes
                    </button>

                    <button 
                        onClick={() => { setActiveTab('parroquias'); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
                            activeTab === 'parroquias' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Mapa Parroquias
                    </button>

                    <button 
                        onClick={() => { setActiveTab('mensajeria'); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
                            activeTab === 'mensajeria' ? 'bg-brand/10 text-brand' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Mensajería
                    </button>
                </div>

                <div className="p-4 border-t border-white/5">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-500 hover:text-white transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 h-screen overflow-y-auto p-4 md:p-8 bg-[#0a0a0a]">
                <div className="max-w-5xl mx-auto">
                    {renderContent()}
                </div>
            </main>
            
            {/* Overlay for mobile menu */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-0 md:hidden" 
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}
        </div>
    );
}
