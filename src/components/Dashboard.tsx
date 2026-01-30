import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { userStore } from '../store/userStore';

export default function Dashboard() {
    const user = useStore(userStore);

    if (user.isAuthenticated !== 'true') {
        return null; // Should not happen if protected, but safe guard
    }

    const payedCount = Number(user.payedTickets) || 0;
    const visitedCount = user.parroquiasVistitadas ? user.parroquiasVistitadas.split(',').filter(Boolean).length : 0;
    const questionsCount = user.preguntasVistas ? user.preguntasVistas.split(',').filter(Boolean).length : 0;

    // Trivia State
    const [isTriviaOpen, setIsTriviaOpen] = useState(false);
    const [loadingQuestion, setLoadingQuestion] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [triviaFeedback, setTriviaFeedback] = useState<{ type: 'success' | 'error' | null, message: string, reward?: number }>({ type: null, message: '' });

    // Function to play confetti
    const triggerConfetti = () => {
        import('canvas-confetti').then((module) => {
            const confetti = module.default;
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#f8b134', '#ffffff', '#bf8418'],
                zIndex: 10000,
            });
        });
    };

    const handleOpenTrivia = async () => {
        setLoadingQuestion(true);
        setIsTriviaOpen(true);
        setTriviaFeedback({ type: null, message: '' });
        setCurrentQuestion(null);

        try {
            const res = await fetch(`/api/trivia/question?userId=${user.docId}`);
            const data = await res.json();

            if (data.empty) {
                setTriviaFeedback({ type: 'error', message: data.message });
            } else if (data.error) {
                setTriviaFeedback({ type: 'error', message: 'Error cargando pregunta.' });
            } else {
                setCurrentQuestion(data);
            }
        } catch (error) {
            console.error(error);
            setTriviaFeedback({ type: 'error', message: 'Error de conexión.' });
        } finally {
            setLoadingQuestion(false);
        }
    };

    const handleAnswer = async (answer: string) => {
        if (!currentQuestion) return;
        setLoadingQuestion(true); // Re-use loading state for answer pending

        try {
            const res = await fetch('/api/trivia/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.docId,
                    preguntaId: currentQuestion.id,
                    respuesta: answer
                })
            });
            const result = await res.json();

            if (result.success) {
                if (result.isCorrect) {
                    // CORRECT!
                    setTriviaFeedback({
                        type: 'success',
                        message: '¡Respuesta Correcta!',
                        reward: result.reward
                    });
                    triggerConfetti();

                    // Optimistic Update
                    const newScore = (parseInt(user.score) || 0) + (result.reward || 0);
                    const newQuestionsCount = (questionsCount || 0) + 1;

                    // We need to update the store. Since we can't easily modify the 'preguntasVistas' string correctly without logic,
                    // we'll just fake it or let the background refresh handle it. 
                    // But score is important.
                    userStore.set({
                        ...user,
                        score: newScore.toString(),
                        // append dummy ID to update count locally if needed, or just rely on score
                        preguntasVistas: (user.preguntasVistas || "") + "," + currentQuestion.id
                    });

                } else {
                    // INCORRECT
                    setTriviaFeedback({ type: 'error', message: 'Respuesta Incorrecta', reward: 0 });
                    // Still update view count? Yes, script says we record it.
                    userStore.set({
                        ...user,
                        preguntasVistas: (user.preguntasVistas || "") + "," + currentQuestion.id
                    });
                }
            } else {
                setTriviaFeedback({ type: 'error', message: 'Error validando respuesta.' });
            }

        } catch (error) {
            setTriviaFeedback({ type: 'error', message: 'Error enviando respuesta.' });
        } finally {
            setLoadingQuestion(false);
            // Auto close success after few seconds?
            // setTimeout(() => setIsTriviaOpen(false), 3000); 
            // Better let user close it or play again? For now just show result.
        }
    };

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

                <div className="flex flex-col gap-4 w-full md:w-auto">
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

                    {/* Trivia Button */}
                    <button
                        onClick={handleOpenTrivia}
                        className="w-full py-3 px-4 bg-gradient-to-r from-[#f8b134] to-[#f8b134]/80 hover:from-[#f8b134]/90 hover:to-[#f8b134] text-black font-bold rounded-xl shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        Jugar BartiPregunta
                    </button>
                </div>
            </div>

            {/* TRIVIA MODAL */}
            {isTriviaOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1a1a1a] border border-[#f8b134]/30 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                        {/* Close Button */}
                        <button
                            onClick={() => setIsTriviaOpen(false)}
                            className="absolute top-4 right-4 text-white/50 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>

                        <h3 className="text-xl font-serif text-[#f8b134] mb-4 text-center">BartiPregunta</h3>

                        {loadingQuestion ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-8 h-8 border-2 border-[#f8b134] border-t-transparent rounded-full animate-spin mb-2" />
                                <p className="text-white/50 text-sm">Cargando...</p>
                            </div>
                        ) : triviaFeedback.type ? (
                            <div className="text-center py-6">
                                {triviaFeedback.type === 'success' ? (
                                    <>
                                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                                            <svg className="text-green-500 w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <h4 className="text-2xl font-bold text-white mb-2">{triviaFeedback.message}</h4>
                                        <p className="text-[#f8b134] text-xl font-bold mb-4">+{triviaFeedback.reward} Puntos</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/50">
                                            <svg className="text-red-500 w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                        <h4 className="text-xl font-bold text-white mb-2">{triviaFeedback.message}</h4>
                                        <p className="text-white/50 mb-4">¡Inténtalo de nuevo con otra pregunta!</p>
                                    </>
                                )}
                                <button
                                    onClick={() => handleOpenTrivia()}
                                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
                                >
                                    Siguiente Pregunta
                                </button>
                            </div>
                        ) : currentQuestion ? (
                            <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <p className="text-white text-lg font-medium text-center mb-6 leading-relaxed">
                                    {currentQuestion.pregunta}
                                </p>
                                <div className="space-y-3">
                                    {currentQuestion.options.map((option: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => handleAnswer(option)}
                                            className="w-full p-4 text-left bg-white/5 hover:bg-[#f8b134]/20 border border-white/10 hover:border-[#f8b134] rounded-xl text-white transition duration-200 group"
                                        >
                                            <span className="inline-block w-6 h-6 rounded-full bg-white/10 group-hover:bg-[#f8b134] text-xs flex items-center justify-center mr-3 transition-colors">
                                                {String.fromCharCode(65 + i)}
                                            </span>
                                            {option}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 text-center">
                                    <span className="text-xs text-white/30 uppercase tracking-widest">Premio: {currentQuestion.reward} pts</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-white/50">
                                No hay preguntas disponibles.
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}
