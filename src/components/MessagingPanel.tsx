import { useState, useRef, useEffect } from 'react';

export default function MessagingPanel({ username, password }: { username: string, password: string }) {
    const [emails, setEmails] = useState<string[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [subject, setSubject] = useState('');
    const [htmlMessage, setHtmlMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
    const [broadcastCount, setBroadcastCount] = useState<number | null>(null);

    const emailInputRef = useRef<HTMLInputElement>(null);

    // Fetch active users with emails to display the count
    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch('/api/manageUsers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, action: 'fetch', searchQuery: '' })
                });
                if (res.ok) {
                    const data = await res.json();
                    const validUsers = data.filter((u: any) => u.is_active && u.email && u.email.trim() !== '');
                    setBroadcastCount(validUsers.length);
                }
            } catch (e) {
                console.error("No se pudo obtener el conteo de usuarios");
            }
        };
        fetchCount();
    }, [username, password]);

    const handleAddEmail = (emailStr: string) => {
        const cleaned = emailStr.trim().toLowerCase();
        if (cleaned && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) && !emails.includes(cleaned)) {
            setEmails([...emails, cleaned]);
        }
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (['Enter', ',', ' '].includes(e.key)) {
            e.preventDefault();
            handleAddEmail(inputValue);
        } else if (e.key === 'Backspace' && inputValue === '' && emails.length > 0) {
            setEmails(emails.slice(0, -1));
        }
    };

    const handleRemoveEmail = (indexToRemove: number) => {
        setEmails(emails.filter((_, index) => index !== indexToRemove));
    };

    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // If user left something in the input, try to add it first
        if (inputValue.trim()) {
            handleAddEmail(inputValue);
        }

        if (!subject.trim() || !htmlMessage.trim()) {
            setFeedback({ type: 'error', msg: 'El asunto y el mensaje son obligatorios.' });
            return;
        }

        let currentAction = 'broadcast';
        let recipient = undefined;

        // Si hay emails en el arreglo, los usamos. Si escribieron algo pero no presionaron enter, lo intentamos usar.
        const currentEmails = [...emails];
        if (inputValue.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputValue.trim().toLowerCase())) {
            if (!currentEmails.includes(inputValue.trim().toLowerCase())) {
                currentEmails.push(inputValue.trim().toLowerCase());
            }
        }

        if (currentEmails.length > 0) {
            currentAction = 'individual';
            recipient = currentEmails.join(',');
        } else {
            const countText = broadcastCount !== null ? ` a ${broadcastCount} participantes` : ' a TODOS los participantes registrados';
            if (!confirm(`¿Estás seguro de que quieres enviar este correo masivamente${countText}?`)) {
                return;
            }
        }

        setLoading(true);
        setFeedback(null);

        try {
            const res = await fetch('/api/sendEmail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    action: currentAction,
                    to: recipient,
                    subject,
                    htmlMessage: htmlMessage.replace(/\n/g, '<br/>')
                })
            });

            const data = await res.json();
            
            if (res.ok) {
                setFeedback({ type: 'success', msg: data.message || 'Correo enviado con éxito.' });
                setSubject('');
                setHtmlMessage('');
                setEmails([]);
                setInputValue('');
            } else {
                setFeedback({ type: 'error', msg: data.error || 'Error al enviar correos.' });
            }
        } catch (e) {
            setFeedback({ type: 'error', msg: 'Error de conexión al enviar el correo masivo.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#161616] rounded-3xl p-6 md:p-8 border border-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Mensajería Libre
                </h2>
                <p className="text-zinc-400 text-sm mt-1">Envía un correo electrónico a un destinatario específico o a todos los participantes registrados.</p>
            </div>

            <div className="bg-[#161616] rounded-3xl p-6 md:p-8 border border-white/5 max-w-4xl">
                <form onSubmit={handleSendBroadcast} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-zinc-300 mb-2">Destinatario (Opcional)</label>
                        <div 
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 flex flex-wrap gap-2 items-center cursor-text min-h-[50px] transition-colors focus-within:border-brand"
                            onClick={() => emailInputRef.current?.focus()}
                        >
                            {emails.map((email, i) => (
                                <span key={i} className="flex items-center gap-1 bg-brand/10 text-brand px-2 py-1 rounded-md text-xs font-bold border border-brand/30">
                                    {email}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveEmail(i);
                                        }}
                                        className="hover:text-white transition-colors ml-1 focus:outline-none"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </span>
                            ))}
                            <input
                                ref={emailInputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                                placeholder={emails.length === 0 ? "Ej: juan@gmail.com (Espacio/Coma para agregar, o deja blanco para TODOS)" : ""}
                                className="flex-grow bg-transparent text-white focus:outline-none text-sm min-w-[120px]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-zinc-300 mb-2">Asunto del Correo</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={loading}
                            placeholder="Ej: ¡Nuevo reto desbloqueado!"
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand text-sm"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-zinc-300 mb-2">Cuerpo del Mensaje</label>
                        <p className="text-xs text-zinc-500 mb-2">Puedes usar saltos de línea normales o etiquetas HTML (como &lt;b&gt;negrita&lt;/b&gt;).</p>
                        <textarea
                            value={htmlMessage}
                            onChange={(e) => setHtmlMessage(e.target.value)}
                            disabled={loading}
                            rows={8}
                            placeholder="Escribe el mensaje aquí..."
                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand text-sm font-mono"
                        ></textarea>
                    </div>

                    {feedback && (
                        <div className={`p-4 rounded-xl text-sm font-bold border ${
                            feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
                        }`}>
                            {feedback.msg}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-brand text-black px-8 py-3 rounded-xl font-bold hover:bg-brand/90 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <>Enviando correos, por favor espera...</>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                    {(emails.length > 0 || inputValue.trim()) 
                                        ? `Enviar Correo (${emails.length + (inputValue.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputValue.trim().toLowerCase()) && !emails.includes(inputValue.trim().toLowerCase()) ? 1 : 0)})` 
                                        : 'Enviar a Todos'
                                    }
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
