
import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { userStore } from '../store/userStore';

type UserRank = {
    username: string;
    score: number;
};

export default function Leaderboard() {
    const [ranking, setRanking] = useState<UserRank[]>([]);
    const [loading, setLoading] = useState(true);
    const user = useStore(userStore);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                // Determine if we need to force refresh
                const res = await fetch('/api/leaderboard');
                if (!res.ok) throw new Error("Failed to fetch");
                const data: UserRank[] = await res.json();

                // OPTIMISTIC PATCH: If current user has a higher score locally than in DB (due to recent visit), patch it
                if (user && user.username) {
                    const currentScore = parseInt(user.score);
                    const userInRank = data.find(u => u.username === user.username);

                    if (userInRank && userInRank.score < currentScore) {
                        userInRank.score = currentScore;
                        // Re-sort if needed (simple sort desc)
                        data.sort((a, b) => b.score - a.score);
                    }
                }

                setRanking(data);
            } catch (error) {
                console.error("Error fetching leaderboard:", error);
            } finally {
                setLoading(false);
            }
        };

        // Initial Fetch and Fetch whenever user score changes (indicating a visit)
        fetchLeaderboard();

        // Optional: Polling every 60s
        const interval = setInterval(fetchLeaderboard, 60000);
        return () => clearInterval(interval);
    }, [user.score]); // Re-run when score updates

    if (loading) {
        return <div className="text-center text-white/50 text-sm py-4">Cargando Clasificación...</div>;
    }

    return (
        <div className="w-full">
            <h3 className="text-3xl font-serif text-[#f8b134] mb-6 flex items-center gap-3 drop-shadow-[0_2px_10px_rgba(248,177,52,0.3)]">
                <div className="p-2 bg-[#f8b134]/10 rounded-full border border-[#f8b134]/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                Ranking Oficial
            </h3>

            <div className="flex flex-col gap-3">
                {ranking.map((user, index) => {
                    const rank = index + 1;
                    let cardStyle = "bg-white/5 border-white/10";
                    let rankBadgeStyle = "bg-white/10 text-white/50";
                    let scoreStyle = "text-[#f8b134]";
                    let icon = null;

                    if (rank === 1) {
                        cardStyle = "bg-gradient-to-r from-[#f8b134]/20 to-[#f8b134]/5 border-[#f8b134]/50 shadow-[0_0_20px_rgba(248,177,52,0.2)]";
                        rankBadgeStyle = "bg-[#f8b134] text-black font-bold shadow-lg scale-110";
                        scoreStyle = "text-[#f8b134] drop-shadow-[0_0_5px_rgba(248,177,52,0.8)]";
                        icon = <span className="text-2xl mr-2">🏆</span>;
                    } else if (rank === 2) {
                        cardStyle = "bg-gradient-to-r from-gray-300/20 to-gray-300/5 border-gray-300/50";
                        rankBadgeStyle = "bg-gray-300 text-black font-bold shadow-lg";
                        scoreStyle = "text-gray-300";
                        icon = <span className="text-2xl mr-2">🥈</span>;
                    } else if (rank === 3) {
                        cardStyle = "bg-gradient-to-r from-orange-400/20 to-orange-400/5 border-orange-400/50";
                        rankBadgeStyle = "bg-orange-400 text-black font-bold shadow-lg";
                        scoreStyle = "text-orange-400";
                        icon = <span className="text-2xl mr-2">🥉</span>;
                    }

                    return (
                        <div
                            key={index}
                            className={`relative flex items-center p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${cardStyle}`}
                        >
                            {/* Rank Badge */}
                            <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full text-xl font-mono ${rankBadgeStyle}`}>
                                {rank}
                            </div>

                            {/* User Info */}
                            <div className="ml-4 flex-grow min-w-0">
                                <div className="flex items-center">
                                    {icon}
                                    <h4 className={`text-lg md:text-xl font-bold truncate ${rank <= 3 ? 'text-white' : 'text-white/90'}`}>
                                        {user.username}
                                    </h4>
                                </div>
                            </div>

                            {/* Score */}
                            <div className="flex flex-col items-end flex-shrink-0 ml-4">
                                <span className={`text-2xl md:text-3xl font-black ${scoreStyle}`}>
                                    {user.score}
                                </span>
                                <span className="text-[10px] uppercase tracking-widest text-white/40">Puntos</span>
                            </div>
                        </div>
                    );
                })}

                {ranking.length === 0 && (
                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-white/30 italic text-lg">Aún no hay participantes registrados.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
