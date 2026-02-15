
import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { userStore } from '../store/userStore';

export default function Dashboard() {
    const user = useStore(userStore);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || user.isAuthenticated !== 'true') {
        return null;
    }

    const payedCount = Number(user.payedTickets) || 0;
    const visitedCount = user.parroquiasVistitadas ? user.parroquiasVistitadas.split(',').filter(Boolean).length : 0;
    const questionsCount = user.preguntasVistas ? user.preguntasVistas.split(',').filter(Boolean).length : 0;



    return (
        <div className="w-full relative overflow-hidden rounded-3xl bg-black/40 border border-white/10 p-8 shadow-2xl backdrop-blur-sm">
            {/* Background Glows */}
            <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] rounded-full bg-[#f8b134]/10 blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-8">

                <div className="flex flex-col md:flex-row items-center md:justify-between gap-8">
                    {/* User Info */}
                    <div className="text-center md:text-left">
                        <p className="text-white/50 text-sm uppercase tracking-widest mb-1">Bienvenido Peregrino</p>
                        <h2 className="text-4xl md:text-5xl font-serif text-white mb-4">{user.username}</h2>

                        {/* SCORE - Enhanced Visuals */}
                        <div className="inline-flex flex-col items-center md:items-start p-4 bg-gradient-to-r from-[#f8b134]/20 to-transparent border border-[#f8b134]/30 rounded-2xl">
                            <span className="text-[#f8b134] text-xs font-bold tracking-widest uppercase mb-1">Tu Puntaje Actual</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl md:text-5xl font-black text-[#f8b134] drop-shadow-[0_0_10px_rgba(248,177,52,0.5)]">
                                    {user.score}
                                </span>
                                <span className="text-sm text-[#f8b134]/60 font-serif italic">pts</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 w-full md:w-auto">
                        {/* Stats Grid - Cleaner Look */}
                        <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
                            {/* Stat 1 */}
                            <div className="flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-4 rounded-2xl min-w-[100px] aspect-square">
                                <span className="text-3xl font-bold text-white mb-2">{payedCount}</span>
                                <span className="text-[10px] uppercase text-white/50 text-center leading-tight">Boletas<br />Pagadas</span>
                            </div>

                            {/* Stat 2 */}
                            <div className="flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-4 rounded-2xl min-w-[100px] aspect-square">
                                <span className="text-3xl font-bold text-white mb-2">{visitedCount}</span>
                                <span className="text-[10px] uppercase text-white/50 text-center leading-tight">Visitas<br />Parroquias</span>
                            </div>

                            {/* Stat 3 */}
                            <div className="flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-4 rounded-2xl min-w-[100px] aspect-square">
                                <span className="text-3xl font-bold text-white mb-2">{questionsCount}</span>
                                <span className="text-[10px] uppercase text-white/50 text-center leading-tight">Bartipreguntas<br />Respondidas</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ticket Numbers Section */}
                {user['tickets-numbers'] && (
                    <div className="w-full border-t border-white/10 pt-6">
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-3 text-center md:text-left">Tus Números de Boleta</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            {user['tickets-numbers'].toString().split(',').map((ticket, index) => (
                                <div key={index} className="px-4 py-2 bg-[#f8b134]/10 border border-[#f8b134]/30 rounded-lg">
                                    <span className="text-[#f8b134] font-mono font-bold text-lg tracking-wider">
                                        #{ticket.trim()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
