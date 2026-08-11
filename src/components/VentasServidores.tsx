import React, { useState, useEffect } from 'react';
import { Package, Receipt, Users, Clock, Settings, X, Trash2, Edit2 } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
};

export default function VentasServidores() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form State
  const [vendedor, setVendedor] = useState('');
  const [otroVendedor, setOtroVendedor] = useState('');
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');
  const [horaRecogida, setHoraRecogida] = useState('');
  const [producto, setProducto] = useState('Arroz con Pollo');
  const [variante, setVariante] = useState('Sencillo');
  const [cantidad, setCantidad] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Config State
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ventas');
      const json = await res.json();
      if (json.success) {
        setData(json);
        setConfigForm(json.config);
      } else {
        setError(json.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/ventas/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm)
      });
      const json = await res.json();
      if (json.success) {
        setShowConfig(false);
        fetchData();
      } else {
        alert("Error actualizando config: " + json.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const finalVendedor = vendedor === 'Otro' ? otroVendedor : vendedor;
      
      if (!finalVendedor) {
        setError('Por favor selecciona o escribe el nombre del vendedor.');
        setIsSubmitting(false);
        return;
      }

      // Calculate unit price based on current config
      const productKey = producto === 'Arroz con Pollo' ? 'arroz_con_pollo' : 'tamal';
      const variantKey = variante.toLowerCase();
      const unitPrice = data.config.prices[productKey][variantKey];

      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendedor: finalVendedor,
          comprador_nombre: compradorNombre,
          comprador_telefono: compradorTelefono,
          hora_recogida: horaRecogida,
          producto,
          variante,
          cantidad: Number(cantidad),
          precio_unitario: unitPrice
        })
      });

      const json = await res.json();
      if (json.success) {
        setCompradorNombre('');
        setCompradorTelefono('');
        setHoraRecogida('');
        setCantidad(1);
        fetchData();
      } else {
        setError(json.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas marcar esta reserva como cancelada?')) return;
    try {
      const res = await fetch('/api/ventas/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        alert("Error: " + json.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  if (loading && !data) {
    return <div className="text-center py-20 text-white">Cargando ventas...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-20">
      
      {/* Header and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-red-900/60 to-red-950/60 backdrop-blur-md border border-red-500/30 p-6 rounded-2xl shadow-xl shadow-red-900/20">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <Package className="text-red-400 w-8 h-8" />
            </div>
            <div>
              <p className="text-red-200/80 text-sm font-medium uppercase tracking-wider">Arroces Disponibles</p>
              <h3 className="text-4xl font-bold text-white font-['Titan_One']">{data?.stats?.remainingArroz ?? 0}</h3>
            </div>
          </div>
          <p className="text-red-300/60 text-sm mt-2">De un límite de {data?.config?.limits?.arroz_con_pollo}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-900/60 to-amber-950/60 backdrop-blur-md border border-amber-500/30 p-6 rounded-2xl shadow-xl shadow-amber-900/20">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Package className="text-amber-400 w-8 h-8" />
            </div>
            <div>
              <p className="text-amber-200/80 text-sm font-medium uppercase tracking-wider">Tamales Disponibles</p>
              <h3 className="text-4xl font-bold text-white font-['Titan_One']">{data?.stats?.remainingTamal ?? 0}</h3>
            </div>
          </div>
          <p className="text-amber-300/60 text-sm mt-2">De un límite de {data?.config?.limits?.tamal}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/60 to-emerald-950/60 backdrop-blur-md border border-emerald-500/30 p-6 rounded-2xl shadow-xl shadow-emerald-900/20">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Receipt className="text-emerald-400 w-8 h-8" />
            </div>
            <div>
              <p className="text-emerald-200/80 text-sm font-medium uppercase tracking-wider">Ganancia Parcial</p>
              <h3 className="text-3xl font-bold text-white font-['Inter'] tracking-tight">
                {formatCurrency(data?.stats?.gananciaParcial ?? 0)}
              </h3>
            </div>
          </div>
          <button 
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 text-emerald-300/80 hover:text-emerald-200 text-sm mt-2 transition-colors"
          >
            <Settings className="w-4 h-4" /> Ajustar precios y límites
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario */}
        <div className="lg:col-span-1">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl sticky top-24">
            <h2 className="text-2xl font-['Titan_One'] text-white mb-6 tracking-wide flex items-center gap-3">
              <Edit2 className="text-[#f8b134]" />
              Nueva Reserva
            </h2>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-2">
                <label className="text-white/80 text-sm font-medium">Vendedor</label>
                <select 
                  value={vendedor} 
                  onChange={(e) => setVendedor(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8b134] focus:ring-1 focus:ring-[#f8b134] transition-all appearance-none"
                >
                  <option value="" disabled className="bg-[#1a0a0d]">Selecciona vendedor...</option>
                  <option value="Paola Delgado" className="bg-[#1a0a0d]">Paola Delgado</option>
                  <option value="Fabian Carrera" className="bg-[#1a0a0d]">Fabian Carrera</option>
                  <option value="Otro" className="bg-[#1a0a0d]">Otro...</option>
                </select>
                {vendedor === 'Otro' && (
                  <input 
                    type="text" 
                    placeholder="Escribe el nombre del vendedor" 
                    value={otroVendedor}
                    onChange={(e) => setOtroVendedor(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-2 text-white focus:outline-none focus:border-[#f8b134] transition-all"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-white/80 text-sm font-medium">Nombre del Comprador</label>
                <input 
                  type="text" 
                  value={compradorNombre}
                  onChange={(e) => setCompradorNombre(e.target.value)}
                  required
                  placeholder="Ej. Juan Pérez"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8b134] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-white/80 text-sm font-medium">Teléfono</label>
                  <input 
                    type="text" 
                    value={compradorTelefono}
                    onChange={(e) => setCompradorTelefono(e.target.value)}
                    placeholder="Opcional"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8b134] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-white/80 text-sm font-medium">Hora Recogida</label>
                  <input 
                    type="time" 
                    value={horaRecogida}
                    onChange={(e) => setHoraRecogida(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8b134] transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white/80 text-sm font-medium">Producto</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProducto('Arroz con Pollo')}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      producto === 'Arroz con Pollo' 
                      ? 'bg-red-500/20 border-red-500 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Arroz con Pollo
                  </button>
                  <button
                    type="button"
                    onClick={() => setProducto('Tamal')}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      producto === 'Tamal' 
                      ? 'bg-amber-500/20 border-amber-500 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Tamal
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-white/80 text-sm font-medium">Variante</label>
                  <select 
                    value={variante}
                    onChange={(e) => setVariante(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8b134] transition-all appearance-none"
                  >
                    <option value="Sencillo" className="bg-[#1a0a0d]">Sencillo</option>
                    <option value="Combo" className="bg-[#1a0a0d]">Combo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-white/80 text-sm font-medium">Cantidad</label>
                  <input 
                    type="number" 
                    min="1"
                    max="20"
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#f8b134] transition-all"
                  />
                </div>
              </div>

              {/* Price Preview */}
              {data && (
                <div className="pt-4 pb-2 flex justify-between items-center border-t border-white/10 mt-6">
                  <span className="text-white/60 text-sm">Total a cobrar:</span>
                  <span className="text-[#f8b134] text-xl font-bold font-['Inter']">
                    {formatCurrency(
                      (data.config.prices[producto === 'Arroz con Pollo' ? 'arroz_con_pollo' : 'tamal'][variante.toLowerCase()]) * cantidad
                    )}
                  </span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#f8b134] to-[#ffcc66] text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(248,177,52,0.4)] hover:shadow-[0_0_30px_rgba(248,177,52,0.6)] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting ? 'Registrando...' : 'Registrar Reserva'}
              </button>
            </form>
          </div>
        </div>

        {/* Lista de Reservas */}
        <div className="lg:col-span-2">
          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-['Titan_One'] text-white tracking-wide">Últimas Reservas</h2>
              <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-medium">
                {data?.ventas?.length ?? 0} Registros
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Comprador</th>
                    <th className="p-4 font-medium">Pedido</th>
                    <th className="p-4 font-medium">Vendedor</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium text-center">Estado</th>
                    <th className="p-4 font-medium text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.ventas?.map((v: any) => (
                    <tr key={v.id} className={`hover:bg-white/5 transition-colors ${v.estado === 'CANCELADA' ? 'opacity-50' : ''}`}>
                      <td className="p-4">
                        <div className="font-medium text-white">{v.comprador_nombre}</div>
                        <div className="text-white/50 text-xs flex items-center gap-1 mt-1">
                          <Users className="w-3 h-3" /> {v.comprador_telefono || 'Sin teléfono'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${v.producto === 'Arroz con Pollo' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                          <span className="text-white text-sm font-medium">{v.cantidad}x {v.producto}</span>
                        </div>
                        <div className="text-white/50 text-xs mt-1 ml-4">
                          {v.variante} • Recoge: <Clock className="w-3 h-3 inline pb-[1px]" /> {v.hora_recogida}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="bg-white/10 text-white/80 px-2 py-1 rounded text-xs">
                          {v.vendedor}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-[#f8b134] font-medium text-sm">
                          {formatCurrency(v.precio_unitario * v.cantidad)}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          v.estado === 'ACTIVA' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {v.estado}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {v.estado === 'ACTIVA' && (
                          <button 
                            onClick={() => handleCancel(v.id)}
                            className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Cancelar pedido"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data?.ventas?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/40">
                        No hay reservas registradas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Configuración */}
      {showConfig && configForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a0a0d] border border-white/20 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-xl font-['Titan_One'] text-white">Ajustar Límites y Precios</h2>
              <button onClick={() => setShowConfig(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleConfigUpdate} className="p-6 space-y-6">
              
              <div>
                <h3 className="text-[#f8b134] font-semibold mb-4 border-b border-white/10 pb-2">Límites Totales</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-white/70 text-xs">Arroz con Pollo</label>
                    <input 
                      type="number" 
                      value={configForm.limits.arroz_con_pollo}
                      onChange={(e) => setConfigForm({...configForm, limits: {...configForm.limits, arroz_con_pollo: Number(e.target.value)}})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f8b134]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-white/70 text-xs">Tamales</label>
                    <input 
                      type="number" 
                      value={configForm.limits.tamal}
                      onChange={(e) => setConfigForm({...configForm, limits: {...configForm.limits, tamal: Number(e.target.value)}})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f8b134]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[#f8b134] font-semibold mb-4 border-b border-white/10 pb-2">Precios: Arroz con Pollo</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-white/70 text-xs">Sencillo ($)</label>
                    <input 
                      type="number" 
                      value={configForm.prices.arroz_con_pollo.sencillo}
                      onChange={(e) => setConfigForm({...configForm, prices: {...configForm.prices, arroz_con_pollo: {...configForm.prices.arroz_con_pollo, sencillo: Number(e.target.value)}}})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f8b134]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-white/70 text-xs">Combo ($)</label>
                    <input 
                      type="number" 
                      value={configForm.prices.arroz_con_pollo.combo}
                      onChange={(e) => setConfigForm({...configForm, prices: {...configForm.prices, arroz_con_pollo: {...configForm.prices.arroz_con_pollo, combo: Number(e.target.value)}}})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f8b134]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[#f8b134] font-semibold mb-4 border-b border-white/10 pb-2">Precios: Tamal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-white/70 text-xs">Sencillo ($)</label>
                    <input 
                      type="number" 
                      value={configForm.prices.tamal.sencillo}
                      onChange={(e) => setConfigForm({...configForm, prices: {...configForm.prices, tamal: {...configForm.prices.tamal, sencillo: Number(e.target.value)}}})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f8b134]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-white/70 text-xs">Combo ($)</label>
                    <input 
                      type="number" 
                      value={configForm.prices.tamal.combo}
                      onChange={(e) => setConfigForm({...configForm, prices: {...configForm.prices, tamal: {...configForm.prices.tamal, combo: Number(e.target.value)}}})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f8b134]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowConfig(false)}
                  className="flex-1 bg-white/5 text-white py-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-[#f8b134] text-black font-bold py-3 rounded-xl hover:bg-[#ffcc66] transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
