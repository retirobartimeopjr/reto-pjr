import { atom } from 'nanostores';

export const isLoginOpen = atom(false);

// ==================================================================
// ⏰ FIN DE COMPETENCIA — Reto Bartimeo
// Se activa cuando faltan ≤5 segundos o cuando el tiempo ya expiró.
// Fuente de verdad: Countdown.astro (vanilla JS) actualiza este átomo.
// Los React islands lo consumen vía useChallengeLock.ts
// ==================================================================
export const isChallengeOver = atom<boolean>(false);
