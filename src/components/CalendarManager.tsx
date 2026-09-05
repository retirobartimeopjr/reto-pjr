import React, { useState, useEffect } from 'react';

interface CalendarManagerProps {
    username: string;
    password?: string;
}

export default function CalendarManager({ username, password }: CalendarManagerProps) {
    const [calendarData, setCalendarData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusFeedback, setStatusFeedback] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/calendar');
                if (res.ok) {
                    const data = await res.json();
                    setCalendarData(data);
                } else {
                    setErrorMsg('Error al cargar datos del calendario');
                }
            } catch (err) {
                setErrorMsg('Error de red al cargar el calendario');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setStatusFeedback('');
        setErrorMsg('');

        // Recalculate eventDays and retreatDays before saving
        const newData = { ...calendarData };
        if (newData.months) {
            newData.months.forEach((month: any) => {
                const newEventDays = new Set<number>();
                const newRetreatDays = new Set<number>();
                
                month.cards?.forEach((card: any) => {
                    const matchDays = card.date.match(/\d+/g)?.map(Number) || [];
                    matchDays.forEach((d: number) => {
                        if (card.isRetreat) {
                            newRetreatDays.add(d);
                        } else {
                            newEventDays.add(d);
                        }
                    });
                });
                
                month.eventDays = Array.from(newEventDays).sort((a, b) => a - b);
                month.retreatDays = Array.from(newRetreatDays).sort((a, b) => a - b);
            });
        }

        try {
            const res = await fetch('/api/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    data: newData
                })
            });

            const result = await res.json();
            if (res.ok && result.success) {
                setStatusFeedback('¡Cambios guardados con éxito!');
                setTimeout(() => setStatusFeedback(''), 3000);
            } else {
                setErrorMsg(result.error || 'Error desconocido al guardar');
            }
        } catch (err) {
            setErrorMsg('Error de red al intentar guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleAddCard = (monthIdx: number) => {
        const newData = { ...calendarData };
        if (!newData.months[monthIdx].cards) {
            newData.months[monthIdx].cards = [];
        }
        newData.months[monthIdx].cards.push({
            date: "Nuevo evento",
            isRetreat: false,
            fields: [
                { label: "Actividad", value: "Descripción..." }
            ]
        });
        setCalendarData(newData);
    };

    const handleDeleteCard = (monthIdx: number, cardIdx: number) => {
        if(confirm("¿Estás seguro de eliminar este evento?")) {
            const newData = { ...calendarData };
            newData.months[monthIdx].cards.splice(cardIdx, 1);
            setCalendarData(newData);
        }
    };

    const updateCard = (monthIdx: number, cardIdx: number, key: string, value: any) => {
        const newData = { ...calendarData };
        newData.months[monthIdx].cards[cardIdx][key] = value;
        setCalendarData(newData);
    };

    const handleAddField = (monthIdx: number, cardIdx: number) => {
        const newData = { ...calendarData };
        if (!newData.months[monthIdx].cards[cardIdx].fields) {
            newData.months[monthIdx].cards[cardIdx].fields = [];
        }
        newData.months[monthIdx].cards[cardIdx].fields.push({ label: "Nueva etiqueta", value: "Nuevo valor" });
        setCalendarData(newData);
    };

    const updateField = (monthIdx: number, cardIdx: number, fieldIdx: number, key: string, value: string) => {
        const newData = { ...calendarData };
        newData.months[monthIdx].cards[cardIdx].fields[fieldIdx][key] = value;
        setCalendarData(newData);
    };

    const handleDeleteField = (monthIdx: number, cardIdx: number, fieldIdx: number) => {
        const newData = { ...calendarData };
        newData.months[monthIdx].cards[cardIdx].fields.splice(fieldIdx, 1);
        setCalendarData(newData);
    };

    if (loading) return <div className="text-white/50 p-4">Cargando editor del calendario...</div>;
    if (!calendarData) return <div className="text-red-400 p-4">No se encontraron datos del calendario.</div>;

    const currentMonth = calendarData.months?.[selectedMonthIdx];

    return (
        <div className="bg-[#111] border border-[#333] rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[600px]">
            {/* Sidebar for Months */}
            <div className="w-full md:w-64 bg-[#1a1a1a] border-r border-[#333] flex flex-col">
                <div className="p-4 border-b border-[#333]">
                    <h3 className="text-[#f8b134] font-bold text-lg">Meses</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {calendarData.months?.map((month: any, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedMonthIdx(idx)}
                            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${
                                selectedMonthIdx === idx 
                                ? 'bg-[#f8b134] text-black shadow-lg shadow-[#f8b134]/20' 
                                : 'text-white/70 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            {month.name} 2026
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-[#333]">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-[#f8b134] text-black font-bold py-3 px-4 rounded-lg hover:bg-[#e09e2b] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    {errorMsg && <p className="text-red-400 text-xs mt-2 text-center">{errorMsg}</p>}
                    {statusFeedback && <p className="text-green-400 text-xs mt-2 text-center">{statusFeedback}</p>}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-[#0a0a0a]">
                {currentMonth ? (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <h2 className="text-3xl font-serif text-white">{currentMonth.name} <span className="text-white/30">2026</span></h2>
                                <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition">
                                    <input 
                                        type="checkbox" 
                                        checked={currentMonth.hidden || false}
                                        onChange={(e) => {
                                            const newData = { ...calendarData };
                                            newData.months[selectedMonthIdx].hidden = e.target.checked;
                                            setCalendarData(newData);
                                        }}
                                        className="w-4 h-4 accent-[#f8b134]"
                                    />
                                    <span className="text-sm font-medium text-white/70">Ocultar mes</span>
                                </label>
                            </div>
                            <button 
                                onClick={() => handleAddCard(selectedMonthIdx)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm font-bold flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Nuevo Evento
                            </button>
                        </div>
                        
                        <p className="text-white/50 text-sm mb-6">
                            Los días sombreados del calendario se calcularán automáticamente basándose en los números que escribas en el campo "Fecha (Texto)".
                        </p>

                        <div className="space-y-6">
                            {currentMonth.cards?.map((card: any, cardIdx: number) => (
                                <div key={cardIdx} className={`bg-[#1a1a1a] border rounded-xl p-5 relative transition ${card.isRetreat ? 'border-[#f8b134]/50 shadow-[0_0_15px_rgba(248,177,52,0.1)]' : 'border-[#333]'}`}>
                                    <button 
                                        onClick={() => handleDeleteCard(selectedMonthIdx, cardIdx)}
                                        className="absolute top-4 right-4 text-white/30 hover:text-red-400 transition"
                                        title="Eliminar evento"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>

                                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-6">
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1">Fecha (Texto)</label>
                                            <input 
                                                type="text" 
                                                value={card.date}
                                                onChange={(e) => updateCard(selectedMonthIdx, cardIdx, 'date', e.target.value)}
                                                placeholder="Ej: 14 y 15 de agosto"
                                                className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-2 text-white outline-none focus:border-[#f8b134]"
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer pt-4 md:pt-0">
                                            <input 
                                                type="checkbox" 
                                                checked={card.isRetreat}
                                                onChange={(e) => updateCard(selectedMonthIdx, cardIdx, 'isRetreat', e.target.checked)}
                                                className="w-5 h-5 accent-[#f8b134]"
                                            />
                                            <span className="text-sm font-medium text-white/80">¿Es un Retiro?</span>
                                        </label>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider">Detalles del Evento</h4>
                                            <button 
                                                onClick={() => handleAddField(selectedMonthIdx, cardIdx)}
                                                className="text-[#f8b134] text-xs hover:underline flex items-center gap-1"
                                            >
                                                + Añadir detalle
                                            </button>
                                        </div>
                                        
                                        {card.fields?.map((field: any, fieldIdx: number) => (
                                            <div key={fieldIdx} className="flex gap-3 items-start">
                                                <input 
                                                    type="text" 
                                                    value={field.label}
                                                    onChange={(e) => updateField(selectedMonthIdx, cardIdx, fieldIdx, 'label', e.target.value)}
                                                    placeholder="Ej: Reunión"
                                                    className="w-1/3 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-[#f8b134]"
                                                />
                                                <input 
                                                    type="text" 
                                                    value={field.value}
                                                    onChange={(e) => updateField(selectedMonthIdx, cardIdx, fieldIdx, 'value', e.target.value)}
                                                    placeholder="Ej: Con el equipo"
                                                    className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#f8b134]"
                                                />
                                                <button 
                                                    onClick={() => handleDeleteField(selectedMonthIdx, cardIdx, fieldIdx)}
                                                    className="p-2 text-white/30 hover:text-red-400 transition"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {(!currentMonth.cards || currentMonth.cards.length === 0) && (
                                <div className="text-center py-10 text-white/30 border border-dashed border-[#333] rounded-xl">
                                    No hay eventos en este mes. Haz clic en "Nuevo Evento" para empezar.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-white/30">
                        Selecciona un mes para editar
                    </div>
                )}
            </div>
        </div>
    );
}
