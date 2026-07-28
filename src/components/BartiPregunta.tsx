import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isLoginOpen, userStore } from '../store/userStore';
import { challengeStartTime, challengeEndTime } from '../store/challengeStore';

export default function BartiPregunta() {
    const user = useStore(userStore);
    const start_time = useStore(challengeStartTime);
    const end_time = useStore(challengeEndTime);
    const [showLoginWarning, setShowLoginWarning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [triviaFeedback, setTriviaFeedback] = useState<{ type: 'success' | 'error' | null, message: string, reward?: number }>({ type: null, message: '' });
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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

        if (user.isAuthenticated !== 'true') {
            setShowLoginWarning(true);
            return;
        }

        if (start_time && Date.now() < start_time) {
            setTriviaFeedback({ type: 'error', message: '¡Ten paciencia! El reto aún no ha comenzado. Las Bartipreguntas estarán disponibles pronto.' });
            setIsOpen(true);
            return;
        }

        if (end_time && Date.now() >= end_time) {
            setTriviaFeedback({ type: 'error', message: '¡El reto ha finalizado! Ya no es posible responder más preguntas.' });
            setIsOpen(true);
            return;
        }

        setLoading(true);
        setIsOpen(true);
        setTriviaFeedback({ type: null, message: '' });
        setCurrentQuestion(null);

        try {
            const res = await fetch(`/api/trivia/question?userId=${user.docId}`);
            const data = await res.json();

            if (data.empty) {
                // Check if it's due to daily limit or no more questions
                if (data.limitReached) {
                    setTriviaFeedback({ type: 'error', message: data.message });
                } else {
                    setTriviaFeedback({ type: 'error', message: data.message });
                }
            } else if (data.error) {
                setTriviaFeedback({ type: 'error', message: 'Error cargando pregunta.' });
            } else {
                setCurrentQuestion(data);
            }
        } catch (error) {
            console.error(error);
            setTriviaFeedback({ type: 'error', message: 'Error de conexión.' });
        } finally {
            setLoading(false);
        }
    };

    const handleLoginRedirect = () => {
        setShowLoginWarning(false);
        setTimeout(() => {
            // Try global trigger first (more reliable across island boundaries if defined)
            if ((window as any).openLoginModule) {
                (window as any).openLoginModule();
            } else {
                isLoginOpen.set(true);
            }
        }, 100);
    };

    const handleAnswer = async (answer: string) => {
        if (!currentQuestion) return;
        setLoading(true);

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
                    const questionsCount = user.preguntasVistas ? user.preguntasVistas.split(',').filter(Boolean).length : 0;
                    const newScore = (parseInt(user.score) || 0) + (result.reward || 0);

                    userStore.set({
                        ...user,
                        score: newScore.toString(),
                        preguntasVistas: (user.preguntasVistas || "") + "," + currentQuestion.id
                    });

                } else {
                    // INCORRECT
                    setTriviaFeedback({ type: 'error', message: 'Respuesta Incorrecta', reward: 0 });
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
            setLoading(false);
        }
    };

    const Portal = ({ children }: { children: React.ReactNode }) => {
        if (!mounted || typeof document === 'undefined') return null;
        return createPortal(children, document.body);
    };

    return (
        <>

            <button
                onClick={handleOpenTrivia}
                className="w-full relative overflow-hidden bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:to-[#a06d10] text-black rounded-2xl shadow-[0_0_25px_rgba(248,177,52,0.4)] transition-all duration-300 transform hover:scale-[1.02] group border-2 border-[#fff5d6]/50"
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[url('/noise.svg')] mix-blend-overlay"></div>

                <div className="relative z-10 flex flex-row items-center justify-between px-6 py-4 md:px-8 md:py-6 gap-4">

                    {/* Left: Text Content */}
                    <div className="flex flex-col items-start text-left shrink">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-black/20 text-black px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                                Trivia Diaria
                            </span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-serif font-black leading-none mb-1 drop-shadow-sm">
                            BartiPregunta
                        </h3>
                        <p className="text-black font-bold text-lg md:text-xl leading-normal mt-1">
                            ¡Responde al Llamado y Gana Puntos! 📣
                        </p>
                    </div>

                    {/* Right: Image */}
                    <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 drop-shadow-xl transform group-hover:rotate-6 transition-transform duration-300">
                        <img
                            src="/biblia.png"
                            alt="Biblia"
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                {/* Shine Effect */}
                <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg] group-hover:animate-shine" />
            </button>

            {/* LOGIN WARNING MODAL */}
            {showLoginWarning && (
                <Portal>
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-[#f8b134]/30 w-full max-w-sm rounded-2xl p-8 shadow-2xl relative text-center">
                            <div className="w-16 h-16 rounded-full bg-[#f8b134]/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-[#f8b134]/30">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f8b134" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2">Inicia Sesión</h3>
                            <p className="text-white/60 text-sm mb-6 leading-relaxed">
                                Para participar en la trivia y ganar puntos, necesitas ingresar a tu cuenta.
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleLoginRedirect}
                                    className="w-full py-3 px-4 bg-[#f8b134] hover:bg-[#dca336] text-black font-bold rounded-xl transition-colors"
                                >
                                    Ingresar Ahora
                                </button>
                                <button
                                    onClick={() => setShowLoginWarning(false)}
                                    className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* TRIVIA MODAL (Updated Style) */}
            {isOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-[#f8b134]/30 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                            {/* Close Button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 text-white/50 hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>

                            <div className="text-center mb-6">
                                <span className="inline-block px-3 py-1 bg-[#f8b134]/20 text-[#f8b134] text-xs font-bold rounded-full mb-2">
                                    TRIVIA DIARIA
                                </span>
                                <h3 className="text-2xl font-serif text-white">BartiPregunta</h3>
                            </div>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="w-10 h-10 border-2 border-[#f8b134] border-t-transparent rounded-full animate-spin mb-3" />
                                    <p className="text-white/50 text-sm">Cargando...</p>
                                </div>
                            ) : triviaFeedback.type ? (
                                <div className="text-center py-6 animate-in zoom-in duration-300">
                                    {triviaFeedback.type === 'success' ? (
                                        <>
                                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                                <svg className="text-green-500 w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <h4 className="text-2xl font-bold text-white mb-2">{triviaFeedback.message}</h4>
                                            <p className="text-[#f8b134] text-3xl font-bold mb-6">+{triviaFeedback.reward} Puntos</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                                                <svg className="text-red-500 w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </div>
                                            <h4 className="text-xl font-bold text-white mb-2">{triviaFeedback.message}</h4>
                                            <p className="text-white/50 mb-6">¡Inténtalo de nuevo con otra pregunta!</p>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handleOpenTrivia()}
                                        className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition border border-white/10"
                                    >
                                        Siguiente Pregunta
                                    </button>
                                </div>
                            ) : currentQuestion ? (
                                <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                                    <div className="flex justify-center items-center mb-6">
                                        <span className="bg-white/10 text-white/70 px-3 py-1 rounded-full text-xs font-medium border border-white/10">
                                            Pregunta {currentQuestion.dailyCount} de {currentQuestion.maxDaily} hoy
                                        </span>
                                    </div>
                                    <p className="text-white text-xl font-medium text-center mb-8 leading-relaxed">
                                        {currentQuestion.pregunta}
                                    </p>
                                    <div className="space-y-3">
                                        {currentQuestion.options.map((option: string, i: number) => (
                                            <button
                                                key={i}
                                                onClick={() => handleAnswer(option)}
                                                className="w-full p-4 text-left bg-white/5 hover:bg-[#f8b134] hover:text-black border border-white/10 hover:border-[#f8b134] rounded-xl text-white transition-all duration-200 group flex items-center"
                                            >
                                                <span className="inline-flex w-8 h-8 rounded-full bg-white/10 group-hover:bg-black/20 text-xs items-center justify-center mr-4 transition-colors font-bold shrink-0">
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                <span className="font-medium">{option}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-6 text-center">
                                        <span className="inline-block px-3 py-1 rounded bg-[#f8b134]/10 text-[#f8b134] text-[10px] font-bold uppercase tracking-widest border border-[#f8b134]/20">Premio: {currentQuestion.reward} pts</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-white/50 py-8">
                                    No hay preguntas disponibles.
                                </div>
                            )}
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
}
