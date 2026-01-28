
import { useStore } from '@nanostores/react';
import { userStore } from '../store/userStore';

export default function Dashboard() {
    const user = useStore(userStore);

    if (user.isAuthenticated !== 'true') {
        return null; // Should not happen if protected, but safe guard
    }

    const payedCount = Number(user.payedTickets) || 0;
    const visitedCount = user.parroquiasVistitadas ? user.parroquiasVistitadas.split(',').filter(Boolean).length : 0;
    const questionsCount = user.preguntasVistas ? user.preguntasVistas.split(',').filter(Boolean).length : 0;

    return (
        <div className="w-full relative overflow-hidden rounded-3xl bg-black/40 border border-white/10 p-8 shadow-2xl backdrop-blur-sm">
            {/* Background Glows */}
            <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] rounded-full bg-[#f8b134]/10 blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center md:justify-between gap-8">

                {/* User Info */}
                <div className="text-center md:text-left">
                    <p className="text-white/50 text-sm uppercase tracking-widest mb-1">Bienvenido Peregrino</p>
                    <h2 className="text-4xl md:text-5xl font-serif text-white mb-2">{user.username}</h2>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f8b134]/10 border border-[#f8b134]/30 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-[#f8b134] animate-pulse"></span>
                        <span className="text-[#f8b134] text-xs font-bold tracking-wide">SCORE: {user.score}</span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
                    {/* Stat 1 */}
                    <div className="flex flex-col items-center bg-white/5 border border-white/10 p-3 rounded-xl min-w-[90px]">
                        <span className="text-2xl font-bold text-white mb-1">{payedCount}</span>
                        <span className="text-[10px] uppercase text-white/40 text-center">Tickets<br />Pagos</span>
                    </div>

                    {/* Stat 2 */}
                    <div className="flex flex-col items-center bg-white/5 border border-white/10 p-3 rounded-xl min-w-[90px]">
                        <span className="text-2xl font-bold text-white mb-1">{visitedCount}</span>
                        <span className="text-[10px] uppercase text-white/40 text-center">Visitas<br />Santuarios</span>
                    </div>

                    {/* Stat 3 */}
                    <div className="flex flex-col items-center bg-white/5 border border-white/10 p-3 rounded-xl min-w-[90px]">
                        <span className="text-2xl font-bold text-white mb-1">{questionsCount}</span>
                        <span className="text-[10px] uppercase text-white/40 text-center">Trivias<br /> jugadas</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
