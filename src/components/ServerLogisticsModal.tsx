import { useState, useRef } from 'react';
import type { Server, ServidoresConfig } from './ServersManager';

interface ServerLogisticsModalProps {
    server: Server;
    config: ServidoresConfig | null;
    existingFamilies: string[];
    onClose: () => void;
    onSave: () => void;
    onRefresh?: () => void;
}

export default function ServerLogisticsModal({ server, config, existingFamilies, onClose, onSave, onRefresh }: ServerLogisticsModalProps) {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'logistics' | 'payments'>('logistics');

    // Logistics State
    const [retreatRole, setRetreatRole] = useState(server.retreat_role || 'none');
    const [familyGroup, setFamilyGroup] = useState(server.family_group || '');
    const [hasFamily, setHasFamily] = useState(!!(server.family_group && server.family_group.trim().length > 0));
    const [antiquity, setAntiquity] = useState(server.antiquity || 'antiguo');
    const [shifts, setShifts] = useState<string[]>(server.shifts || []);
    const [meals, setMeals] = useState(server.meals || { cena: false, almuerzo: false });
    const [merch, setMerch] = useState(server.merchandise || { camiseta: null, saco: false, mono: false, kanguro: false, custom: [] });
    const [scholarship, setScholarship] = useState(server.scholarship || 0);

    // New Custom Item State
    const [newCustomName, setNewCustomName] = useState('');
    const [newCustomPrice, setNewCustomPrice] = useState('');

    // Payment State
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentFile, setPaymentFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isExterno = retreatRole === 'externo';

    const handleDeletePayment = async (paymentIndex: number) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este abono? El valor será descontado del total abonado.')) return;
        
        setLoading(true);
        try {
            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_payment',
                    server_id: server.id,
                    payment_index: paymentIndex
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Abono eliminado exitosamente');
                if (onRefresh) onRefresh(); else onSave();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Error eliminando abono');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLogistics = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    server_id: server.id,
                    server_name: server.server_name,
                    is_v_retiro: server.is_v_retiro,
                    retreat_role: retreatRole,
                    family_group: hasFamily ? familyGroup : '',
                    antiquity,
                    shifts,
                    meals,
                    merchandise: merch,
                    scholarship
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Logística guardada exitosamente');
                onSave();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Error guardando logística');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCustom = () => {
        if (!newCustomName || !newCustomPrice) return;
        setMerch({
            ...merch,
            custom: [...(merch.custom || []), { name: newCustomName, price: Number(newCustomPrice) }]
        });
        setNewCustomName('');
        setNewCustomPrice('');
    };

    const handleRemoveCustom = (index: number) => {
        const newCustom = [...(merch.custom || [])];
        newCustom.splice(index, 1);
        setMerch({ ...merch, custom: newCustom });
    };

    const handleAddPayment = async () => {
        if (!paymentAmount) return alert('Debes ingresar un monto');
        setLoading(true);
        try {
            let receiptUrl = '';
            
            if (paymentFile) {
                // Upload to S3
                const payload = {
                    fileName: paymentFile.name,
                    fileType: paymentFile.type,
                    folder: 'tickets',
                    username: `server_${server.server_name}`
                };
                const presignRes = await fetch('/api/s3/presign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const { uploadUrl, publicUrl, success } = await presignRes.json();
                if (!success || !uploadUrl) throw new Error("Error obteniendo URL de subida");

                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': paymentFile.type },
                    body: paymentFile
                });
                
                if (!uploadRes.ok) throw new Error("Error subiendo el archivo al servidor");
                receiptUrl = publicUrl;
            }

            const res = await fetch('/api/coordi/servidores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_payment',
                    server_id: server.id,
                    payment: {
                        amount: Number(paymentAmount),
                        note: paymentNote,
                        receiptUrl
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Pago agregado exitosamente');
                setPaymentAmount('');
                setPaymentNote('');
                setPaymentFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (onRefresh) onRefresh(); else onSave();
            } else {
                alert('Error agregando pago');
            }
        } catch (e) {
            console.error(e);
            alert('Error agregando pago');
        } finally {
            setLoading(false);
        }
    };

    const toggleShift = (day: string) => {
        setShifts(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const calculateTotal = () => {
        if (!config) return 0;
        let total = isExterno ? 0 : (antiquity === 'nuevo' ? config.base_nuevo : config.base_antiguo);
        if (isExterno) {
            if (meals.almuerzo) total += config.almuerzo_price;
            if (meals.cena) total += config.cena_price;
        }
        if (merch.camiseta) total += config.camiseta_price;
        if (merch.saco) total += config.saco_price;
        if (merch.mono) total += config.mono_price;
        if (merch.kanguro) total += config.kanguro_price;
        if (merch.custom && Array.isArray(merch.custom)) {
            merch.custom.forEach((c: any) => { total += Number(c.price || 0); });
        }
        total -= (scholarship || 0);
        return Math.max(0, total);
    };

    const totalDeuda = calculateTotal();
    const totalAbonado = (server.payments || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const saldo = totalDeuda - totalAbonado;

    const handleSendInvoice = () => {
        if (!config) return;
        const firstName = server.server_name ? server.server_name.split(' ')[0] : 'Servidor(a)';
        let msg = `Hola *${firstName}* 👋🏻\n\nTe compartimos el resumen de tu aporte económico para el *V Retiro Bartimeo*.\n\nTe pedimos realizar el pago antes del *14 de Septiembre* para poder cerrar nuestra logística a tiempo. ¡Muchas gracias por tu apoyo!\n\n`;
        
        msg += `🔹 *Aporte Base (${antiquity}):* $${(antiquity === 'nuevo' ? config.base_nuevo : config.base_antiguo).toLocaleString('es-CO')}\n`;
        
        if (isExterno) {
            if (meals.almuerzo) msg += `🍽️ *Almuerzo:* $${config.almuerzo_price.toLocaleString('es-CO')}\n`;
            if (meals.cena) msg += `🍽️ *Cena:* $${config.cena_price.toLocaleString('es-CO')}\n`;
        }
        
        if (merch.camiseta) msg += `👕 *Camiseta (${merch.camiseta}):* $${config.camiseta_price.toLocaleString('es-CO')}\n`;
        if (merch.saco) msg += `🧥 *Saco Granate:* $${config.saco_price.toLocaleString('es-CO')}\n`;
        if (merch.mono) msg += `🎀 *Moño:* $${config.mono_price.toLocaleString('es-CO')}\n`;
        if (merch.kanguro) msg += `🎒 *Kanguro:* $${config.kanguro_price.toLocaleString('es-CO')}\n`;
        
        if (merch.custom && merch.custom.length > 0) {
            merch.custom.forEach((c: any) => {
                msg += `➕ *${c.name}:* $${c.price.toLocaleString('es-CO')}\n`;
            });
        }
        
        if (scholarship > 0) {
            msg += `\n🎓 *Beca / Descuento:* -$${scholarship.toLocaleString('es-CO')}\n`;
        }
        
        msg += `\n*TOTAL A PAGAR:* $${totalDeuda.toLocaleString('es-CO')}\n`;
        
        if (server.payments && server.payments.length > 0) {
            msg += `\n✅ *Abonos Realizados:*\n`;
            server.payments.forEach(p => {
                msg += `  - ${new Date(p.date).toLocaleDateString('es-CO')}: $${Number(p.amount).toLocaleString('es-CO')}\n`;
            });
            msg += `\n*TOTAL ABONADO:* $${totalAbonado.toLocaleString('es-CO')}\n`;
        }
        
        msg += `\n🔴 *SALDO PENDIENTE:* $${saldo.toLocaleString('es-CO')}\n\n`;
        msg += `¡Gracias por tu servicio! 🙏🔥`;

        const phone = server.phone ? server.phone.replace(/\D/g, '') : '';
        const url = `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#1a0a0d] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative mt-10 mb-10">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6 border-b border-white/10 shrink-0">
                    <h2 className="text-2xl font-bold text-white mb-1">{server.server_name}</h2>
                    <div className="flex gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${retreatRole === 'interno' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                            {retreatRole || 'No asignado'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs uppercase font-bold bg-white/10 text-white/70">
                            {antiquity}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${saldo <= 0 ? 'bg-green-500/20 text-green-400' : 'bg-brand/20 text-brand'}`}>
                            Saldo: ${saldo.toLocaleString('es-CO')}
                        </span>
                    </div>
                </div>

                <div className="flex border-b border-white/10 shrink-0">
                    <button 
                        onClick={() => setActiveTab('logistics')}
                        className={`flex-1 p-4 font-bold transition border-b-2 ${activeTab === 'logistics' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
                    >
                        Logística y Responsabilidades
                    </button>
                    <button 
                        onClick={() => setActiveTab('payments')}
                        className={`flex-1 p-4 font-bold transition border-b-2 ${activeTab === 'payments' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'}`}
                    >
                        Pagos y Abonos
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {activeTab === 'logistics' && (
                        <div className="space-y-6">
                            {/* Rol */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                <h4 className="text-white font-bold mb-3">Rol en Retiro</h4>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                        <input type="radio" name="retreatRole" value="interno" checked={retreatRole === 'interno'} onChange={(e) => setRetreatRole(e.target.value)} />
                                        Interno
                                    </label>
                                    <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                        <input type="radio" name="retreatRole" value="externo" checked={retreatRole === 'externo'} onChange={(e) => setRetreatRole(e.target.value)} />
                                        Externo
                                    </label>
                                    <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                        <input type="radio" name="retreatRole" value="none" checked={retreatRole === 'none'} onChange={(e) => setRetreatRole(e.target.value)} />
                                        No asignado
                                    </label>
                                </div>
                            </div>

                            {/* Familia */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                <label className="flex items-center gap-3 text-white font-bold cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-brand"
                                        checked={hasFamily}
                                        onChange={e => {
                                            setHasFamily(e.target.checked);
                                            if (!e.target.checked) setFamilyGroup('');
                                        }} 
                                    />
                                    ¿HACE PARTE DE UNA FAMILIA DE SERVIDORES?
                                </label>
                                
                                {hasFamily && (
                                    <div className="mt-4">
                                        <input 
                                            type="text" 
                                            list="family-groups-list"
                                            placeholder="Escribe o selecciona una familia... Ej: Familia Pérez" 
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                            value={familyGroup}
                                            onChange={e => setFamilyGroup(e.target.value)}
                                        />
                                        <datalist id="family-groups-list">
                                            {existingFamilies.map(fam => (
                                                <option key={fam} value={fam} />
                                            ))}
                                        </datalist>
                                        <p className="text-xs text-white/50 mt-2">Los servidores con el mismo nombre de familia aparecerán agrupados.</p>
                                    </div>
                                )}
                            </div>

                            {/* Antigüedad */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                <h4 className="text-white font-bold mb-3">Antigüedad</h4>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                        <input type="radio" name="antiquity" value="antiguo" checked={antiquity === 'antiguo'} onChange={(e) => setAntiquity(e.target.value)} />
                                        Antiguo (Base: ${config?.base_antiguo.toLocaleString('es-CO')})
                                    </label>
                                    <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                        <input type="radio" name="antiquity" value="nuevo" checked={antiquity === 'nuevo'} onChange={(e) => setAntiquity(e.target.value)} />
                                        Nuevo (Base: ${config?.base_nuevo.toLocaleString('es-CO')})
                                    </label>
                                </div>
                            </div>

                            {/* Externo Options */}
                            {isExterno ? (
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                                    <h4 className="text-white font-bold">Opciones para Externo</h4>
                                    
                                    <div>
                                        <div className="text-sm text-white/50 mb-2">Días de Servicio:</div>
                                        <div className="flex flex-wrap gap-3">
                                            {['Viernes', 'Sábado Mañana', 'Sábado Tarde', 'Domingo'].map(day => (
                                                <label key={day} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition ${shifts.includes(day) ? 'bg-brand/20 border-brand/50 text-white' : 'bg-black/40 border-white/10 text-white/50 hover:border-white/30'}`}>
                                                    <input type="checkbox" className="hidden" checked={shifts.includes(day)} onChange={() => toggleShift(day)} />
                                                    {day}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm text-white/50 mb-2">Comidas:</div>
                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                                <input type="checkbox" checked={meals.almuerzo} onChange={(e) => setMeals({...meals, almuerzo: e.target.checked})} />
                                                Almuerzo (+${config?.almuerzo_price.toLocaleString('es-CO')})
                                            </label>
                                            <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                                <input type="checkbox" checked={meals.cena} onChange={(e) => setMeals({...meals, cena: e.target.checked})} />
                                                Cena (+${config?.cena_price.toLocaleString('es-CO')})
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-blue-900/10 p-4 rounded-xl border border-blue-500/20 text-blue-300/80 text-sm">
                                    Este servidor es <strong>Interno</strong>. Se asume que asiste los 3 días completos y tiene Almuerzo y Cena incluidos en su tarifa base.
                                </div>
                            )}

                            {/* Ropa y Mercancía */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                                <h4 className="text-white font-bold">Ropa y Artículos</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-white/70 text-sm block mb-1">Camiseta (+${config?.camiseta_price.toLocaleString('es-CO')})</label>
                                        <select 
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white"
                                            value={merch.camiseta || ''}
                                            onChange={(e) => setMerch({...merch, camiseta: e.target.value || null})}
                                        >
                                            <option value="">No requiere</option>
                                            <option value="Blanca">Blanca</option>
                                            <option value="Granate">Granate</option>
                                            <option value="Gris">Gris</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                            <input type="checkbox" checked={merch.saco} onChange={(e) => setMerch({...merch, saco: e.target.checked})} />
                                            Saco Granate (+${config?.saco_price.toLocaleString('es-CO')})
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                            <input type="checkbox" checked={merch.mono} onChange={(e) => setMerch({...merch, mono: e.target.checked})} />
                                            Moño (+${config?.mono_price.toLocaleString('es-CO')})
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                            <input type="checkbox" checked={merch.kanguro} onChange={(e) => setMerch({...merch, kanguro: e.target.checked})} />
                                            Kanguro (+${config?.kanguro_price.toLocaleString('es-CO')})
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Otras Responsabilidades */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                                <h4 className="text-white font-bold">Otras Responsabilidades (Ej. Transporte)</h4>
                                {merch.custom && merch.custom.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {merch.custom.map((c: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-white/5">
                                                <span className="text-white/80">{c.name}</span>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-brand font-mono">${Number(c.price).toLocaleString('es-CO')}</span>
                                                    <button onClick={() => handleRemoveCustom(i)} className="text-red-400 hover:text-red-300">✖</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Concepto (Ej: Pasaje)" className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-white" value={newCustomName} onChange={e => setNewCustomName(e.target.value)} />
                                    <input type="number" placeholder="Valor ($)" className="w-32 bg-black/40 border border-white/10 rounded-lg p-2 text-white" value={newCustomPrice} onChange={e => setNewCustomPrice(e.target.value)} />
                                    <button onClick={handleAddCustom} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition font-bold">+</button>
                                </div>
                            </div>

                            {/* Beca */}
                            <div className="bg-brand/10 p-4 rounded-xl border border-brand/20 space-y-2">
                                <h4 className="text-brand font-bold">Beca o Descuento Autorizado</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-white/50 text-xl font-bold">-$</span>
                                    <input type="number" className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white text-lg font-bold focus:border-brand/50 outline-none" value={scholarship || ''} onChange={e => setScholarship(Number(e.target.value))} placeholder="Ej: 50000" />
                                </div>
                                <p className="text-xs text-white/40">Este valor se restará del total a pagar.</p>
                            </div>

                            <button onClick={handleSaveLogistics} disabled={loading} className="w-full bg-brand hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg transition text-lg mt-4">
                                Guardar Cambios
                            </button>
                            <button 
                                onClick={async () => {
                                    if (confirm('¿Estás seguro de que deseas resetear a CERO la deuda y eliminar todos los abonos? Esto vaciará merch, comidas, pagos y becas.')) {
                                        setLoading(true);
                                        try {
                                            const res = await fetch('/api/coordi/servidores', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ action: 'reset_finances', server_id: server.id })
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                alert('Finanzas reseteadas a cero.');
                                                if (onRefresh) onRefresh(); else onSave();
                                                onClose();
                                            } else {
                                                alert('Error al resetear: ' + data.error);
                                            }
                                        } catch(e) { alert('Error de red'); }
                                        setLoading(false);
                                    }
                                }} 
                                disabled={loading} 
                                className="w-full bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-500/20 font-bold py-3 rounded-xl shadow-lg transition mt-3"
                            >
                                Resetear Finanzas a Cero
                            </button>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-6">
                            {/* Summary Banner */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-black/20 p-4 rounded-xl border border-white/10 text-center">
                                    <div className="text-white/50 text-xs uppercase mb-1">Total Deuda</div>
                                    <div className="text-xl font-bold text-white">${totalDeuda.toLocaleString('es-CO')}</div>
                                </div>
                                <div className="bg-green-900/10 p-4 rounded-xl border border-green-500/20 text-center">
                                    <div className="text-green-400/50 text-xs uppercase mb-1">Total Abonado</div>
                                    <div className="text-xl font-bold text-green-400">${totalAbonado.toLocaleString('es-CO')}</div>
                                </div>
                                <div className={`p-4 rounded-xl border text-center ${saldo <= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-brand/10 border-brand/30'}`}>
                                    <div className={`${saldo <= 0 ? 'text-green-400/70' : 'text-brand/70'} text-xs uppercase mb-1`}>Saldo Pendiente</div>
                                    <div className={`text-xl font-bold ${saldo <= 0 ? 'text-green-400' : 'text-brand'}`}>${saldo.toLocaleString('es-CO')}</div>
                                </div>
                            </div>

                            {/* Add Payment Form */}
                            <div className="bg-black/30 p-5 rounded-xl border border-white/10 space-y-4">
                                <h4 className="text-white font-bold flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                    </svg>
                                    Registrar Nuevo Abono
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-white/70 text-xs block mb-1">Monto ($) *</label>
                                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white font-bold" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Ej: 100000" />
                                    </div>
                                    <div>
                                        <label className="text-white/70 text-xs block mb-1">Comprobante (Imagen)</label>
                                        <input type="file" ref={fileInputRef} accept="image/*" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white text-sm" onChange={e => setPaymentFile(e.target.files?.[0] || null)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-white/70 text-xs block mb-1">Nota / Observación</label>
                                    <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Ej: Transferencia Bancolombia" />
                                </div>
                                <button onClick={handleAddPayment} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg transition">
                                    {loading ? 'Subiendo y Guardando...' : 'Guardar Abono'}
                                </button>
                            </div>

                            {/* Payment History */}
                            <div>
                                <h4 className="text-white font-bold mb-3">Historial de Abonos</h4>
                                {(!server.payments || server.payments.length === 0) ? (
                                    <div className="text-center text-white/40 p-6 bg-black/20 rounded-xl border border-dashed border-white/10">
                                        No se han registrado pagos para este servidor.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {server.payments.map((p, idx) => (
                                            <div key={idx} className="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div>
                                                    <div className="text-green-400 font-bold text-lg">${Number(p.amount).toLocaleString('es-CO')}</div>
                                                    <div className="text-white/50 text-xs flex items-center gap-2 mt-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        {new Date(p.date).toLocaleString('es-CO')}
                                                    </div>
                                                    {p.note && <div className="text-white/70 text-sm mt-2">📝 {p.note}</div>}
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    {p.receiptUrl && (
                                                        <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded flex items-center gap-2 text-sm transition shrink-0">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                            </svg>
                                                            Ver Comprobante
                                                        </a>
                                                    )}
                                                    <button onClick={() => handleDeletePayment(idx)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded transition shrink-0" title="Eliminar abono">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10 bg-black/20 shrink-0 flex justify-between items-center">
                    <button onClick={handleSendInvoice} className="text-green-400 hover:text-green-300 font-bold flex items-center gap-2 text-sm transition bg-green-900/20 hover:bg-green-900/40 px-4 py-2 rounded-lg border border-green-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                        </svg>
                        Enviar Factura
                    </button>
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-lg transition">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
