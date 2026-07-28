
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
                        <div className="relative inline-flex flex-col items-center md:items-start p-5 md:p-6 bg-gradient-to-br from-[#f8b134]/20 to-[#f8b134]/5 border border-[#f8b134]/40 rounded-3xl shadow-[0_0_30px_rgba(248,177,52,0.15)] overflow-hidden mt-2">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f8b134]/20 rounded-full blur-2xl"></div>
                            <span className="text-[#f8b134] text-xs md:text-sm font-black tracking-[0.2em] uppercase mb-1 drop-shadow-md z-10">Tu Puntaje Actual</span>
                            <div className="flex items-baseline gap-2 z-10">
                                <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#ffdb8b] to-[#f8b134] drop-shadow-[0_2px_10px_rgba(248,177,52,0.4)]">
                                    {user.score}
                                </span>
                                <span className="text-lg text-[#f8b134]/80 font-serif italic font-bold">pts</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 w-full md:w-auto mt-6 md:mt-0">
                        {/* Stats Grid - Premium Look */}
                        <div className="grid grid-cols-3 gap-2 md:gap-4 w-full md:w-auto">
                            {/* Stat 1 */}
                            <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-blue-500/10 to-blue-500/5 hover:from-blue-500/20 transition-all border border-blue-500/30 p-3 md:p-5 rounded-2xl overflow-hidden group shadow-lg">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
                                <span className="text-2xl md:text-3xl mb-1 md:mb-2 drop-shadow-md">🎫</span>
                                <span className="text-3xl md:text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] mb-1">{payedCount}</span>
                                <span className="text-[9px] md:text-xs uppercase tracking-widest text-blue-200/90 font-bold text-center leading-tight">Boletas<br />Pagadas</span>
                            </div>

                            {/* Stat 2 */}
                            <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20 transition-all border border-emerald-500/30 p-3 md:p-5 rounded-2xl overflow-hidden group shadow-lg">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                                <span className="text-2xl md:text-3xl mb-1 md:mb-2 drop-shadow-md">📍</span>
                                <span className="text-3xl md:text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] mb-1">{visitedCount}</span>
                                <span className="text-[9px] md:text-xs uppercase tracking-widest text-emerald-200/90 font-bold text-center leading-tight">Visitas<br />Parroquias</span>
                            </div>

                            {/* Stat 3 */}
                            <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-purple-500/10 to-purple-500/5 hover:from-purple-500/20 transition-all border border-purple-500/30 p-3 md:p-5 rounded-2xl overflow-hidden group shadow-lg">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
                                <span className="text-2xl md:text-3xl mb-1 md:mb-2 drop-shadow-md">🧠</span>
                                <span className="text-3xl md:text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] mb-1">{questionsCount}</span>
                                <span className="text-[9px] md:text-xs uppercase tracking-widest text-purple-200/90 font-bold text-center leading-tight">Trivias<br />Resueltas</span>
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
