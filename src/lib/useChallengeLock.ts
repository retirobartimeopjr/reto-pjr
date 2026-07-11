import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { isChallengeOver } from '../store/uiStore';

/**
 * Hook centralizado para verificar si la competencia cerró y bloquear acciones.
 *
 * Uso:
 *   const { challengeOver, checkAndBlock, showEndModal, setShowEndModal, winner } = useChallengeLock();
 *
 *   const handleAction = async () => {
 *     const blocked = await checkAndBlock();
 *     if (blocked) return;
 *     // ... resto del código
 *   };
 */
export function useChallengeLock() {
    const challengeOver = useStore(isChallengeOver);
    const [showEndModal, setShowEndModal] = useState(false);
    const [winner, setWinner] = useState<{ username: string; score: number } | null>(null);

    const checkAndBlock = async (): Promise<boolean> => {
        if (!challengeOver) return false; // No bloqueado — continuar con la acción

        // Fetch del ganador (el #1 del leaderboard)
        try {
            const res = await fetch('/api/leaderboard');
            const data = await res.json();
            if (data && data.length > 0) {
                setWinner({ username: data[0].username, score: data[0].score });
            }
        } catch (e) {
            console.error('[useChallengeLock] Error fetching winner:', e);
        }

        setShowEndModal(true);
        return true; // Bloqueado — no ejecutar la acción
    };

    return { challengeOver, checkAndBlock, showEndModal, setShowEndModal, winner };
}
