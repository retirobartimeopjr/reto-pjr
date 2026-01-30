
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
            <h3 className="text-xl font-serif text-[#f8b134] mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Ranking Oficial
            </h3>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left text-sm text-white/80">
                    <thead className="bg-white/5 text-xs uppercase font-medium text-white/50">
                        <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Usuario</th>
                            <th className="px-4 py-3 text-right">Puntos</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {ranking.map((user, index) => {
                            let rankClass = "text-white/70";
                            let rowClass = "hover:bg-white/5 transition-colors";

                            if (index === 0) {
                                rankClass = "text-yellow-400 font-bold";
                                rowClass += " bg-yellow-400/5";
                            } else if (index === 1) {
                                rankClass = "text-gray-300 font-bold";
                                rowClass += " bg-gray-300/5";
                            } else if (index === 2) {
                                rankClass = "text-orange-400 font-bold";
                                rowClass += " bg-orange-400/5";
                            }

                            return (
                                <tr key={index} className={rowClass}>
                                    <td className={`px-4 py-3 font-mono ${rankClass}`}>{index + 1}</td>
                                    <td className="px-4 py-3 font-medium text-white truncate max-w-[150px]">{user.username}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[#f8b134]">{user.score}</td>
                                </tr>
                            );
                        })}
                        {ranking.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-white/30 italic">
                                    Aún no hay participantes registrados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
