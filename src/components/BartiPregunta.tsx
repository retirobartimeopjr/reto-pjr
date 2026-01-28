
import { useStore } from '@nanostores/react';
import confetti from 'canvas-confetti';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { db } from '../lib/firebase.client';
import { refreshUserData, userStore } from '../store/userStore';

type Question = {
    id: string; // Document ID usually, but here field is 'preguntaid'
    preguntaid: string;
    tipo: 'multiple' | 'boolean';
    pregunta: string;
    opcionA?: string;
    opcionB?: string;
    opcionC?: string;
    opcionD?: string;
    reward: number;
    // We don't fetch answer on client ideally to prevent cheating, 
    // but looking at requirements, we need to send response. Backend verifies.
};

export default function BartiPregunta() {
    const user = useStore(userStore);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);

    const fetchQuestion = async () => {
        if (user.isAuthenticated !== 'true') {
            alert("Debes iniciar sesión para jugar.");
            return;
        }

        setLoading(true);
        try {
            // Fetch all questions (Optimisation idea for later: Cache or Cloud Function to get random)
            const snap = await getDocs(collection(db, 'pregunta'));
            const questions: Question[] = [];
            snap.forEach(doc => {
                questions.push({ id: doc.id, ...doc.data() } as Question);
            });

            // Filter answered
            const viewedIds = (user.preguntasVistas || '').split(',').map(s => s.trim());
            const available = questions.filter(q => !viewedIds.includes(q.preguntaid));

            if (available.length === 0) {
                alert("¡Felicidades! Has respondido todas las preguntas disponibles por ahora.");
                setIsOpen(false);
            } else {
                // Random Pick
                const randomQ = available[Math.floor(Math.random() * available.length)];
                setCurrentQuestion(randomQ);
                setResult(null);
                setIsOpen(true);
            }

        } catch (e) {
            console.error(e);
            alert("Error cargando preguntas.");
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = async (respuesta: string) => {
        if (!currentQuestion || !user.docId) return;

        // Optimistic UI or just submit and let backend handle score
        // Requirement says: logic is on Cloud Function. Component just sends doc.
        // But for UX we might want to know if correct...
        // Assuming client doesn't know 'correcta' field for security. 
        // We will just show "Respuesta Enviada" and let user check dashboard for score update?
        // OR the user prompt implies we verify 'correcta' boolean? 
        // "Al responder, crear documento... (La validación real de puntos la hace el backend)"
        // Let's blindly submit and give generic success feedback to match requirement strictly.

        try {
            await addDoc(collection(db, 'respuesta'), {
                userId: user.docId,
                preguntaid: currentQuestion.preguntaid,
                respuesta: respuesta,
                timestamp: serverTimestamp(),
                // 'correcta' will be stamped by backend function
            });

            // Trigger animation
            confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 }
            });

            setResult('correct'); // Just visual state to show "Enviado/Procesando"
            setTimeout(() => {
                setIsOpen(false);
                setCurrentQuestion(null);
                refreshUserData(); // Try to get points
            }, 2000);

        } catch (e) {
            console.error("Error sending answer", e);
            alert("Error enviando respuesta");
        }
    };

    return (
        <>
            <button
                onClick={fetchQuestion}
                disabled={loading}
                className="w-full bg-[#f8b134] hover:bg-[#dca336] text-black font-serif font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(248,177,52,0.3)] transition-all transform hover:scale-105 flex flex-col items-center justify-center gap-1 group"
            >
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🎲</span>
                    <span className="text-lg">Jugar BartiPregunta</span>
                </div>
                <span className="text-[10px] uppercase opacity-70 tracking-widest group-hover:tracking-[0.2em] transition-all">Gana Puntos Extra</span>
            </button>

            <AnimatePresence>
                {isOpen && currentQuestion && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 50 }}
                            className="relative w-full max-w-lg bg-[#1a1a1a] border border-[#f8b134]/30 rounded-3xl p-8 shadow-2xl overflow-hidden"
                        >
                            {/* Header */}
                            <div className="text-center mb-8">
                                <span className="inline-block px-3 py-1 bg-[#f8b134]/20 text-[#f8b134] text-xs font-bold rounded-full mb-3">
                                    POR {currentQuestion.reward} PUNTOS
                                </span>
                                <h3 className="text-2xl md:text-3xl font-serif text-white leading-tight">
                                    {currentQuestion.pregunta}
                                </h3>
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-1 gap-3">
                                {currentQuestion.tipo === 'boolean' ? (
                                    <>
                                        <OptionButton label="Verdadero" onClick={() => handleAnswer("Verdadero")} />
                                        <OptionButton label="Falso" onClick={() => handleAnswer("Falso")} />
                                    </>
                                ) : (
                                    <>
                                        {currentQuestion.opcionA && <OptionButton label={currentQuestion.opcionA} onClick={() => handleAnswer(currentQuestion.opcionA!)} />}
                                        {currentQuestion.opcionB && <OptionButton label={currentQuestion.opcionB} onClick={() => handleAnswer(currentQuestion.opcionB!)} />}
                                        {currentQuestion.opcionC && <OptionButton label={currentQuestion.opcionC} onClick={() => handleAnswer(currentQuestion.opcionC!)} />}
                                        {currentQuestion.opcionD && <OptionButton label={currentQuestion.opcionD} onClick={() => handleAnswer(currentQuestion.opcionD!)} />}
                                    </>
                                )}
                            </div>

                            {/* Result Overlay */}
                            {result && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 backdrop-blur-sm"
                                >
                                    <div className="text-center">
                                        <div className="text-6xl mb-4">✨</div>
                                        <h4 className="text-2xl text-[#f8b134] font-serif">¡Respuesta Enviada!</h4>
                                        <p className="text-white/60 text-sm">Validando con el servidor...</p>
                                    </div>
                                </motion.div>
                            )}

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}

const OptionButton = ({ label, onClick }: { label: string, onClick: () => void }) => (
    <button
        onClick={onClick}
        className="w-full text-left bg-white/5 hover:bg-[#f8b134] hover:text-black border border-white/10 p-4 rounded-xl transition-all duration-200 group relative overflow-hidden"
    >
        <span className="relative z-10 font-medium">{label}</span>
    </button>
);
