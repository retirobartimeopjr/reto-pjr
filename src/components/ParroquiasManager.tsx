import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface Parroquia {
    id: string;
    name: string;
    vicaria: string;
    center: { lat: number; lng: number };
    reward: number;
    code?: string;
}

// Map Click Handler Component
function MapEvents({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null;
}

// View Updater Component
function MapViewUpdater({ center }: { center: { lat: number; lng: number } | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 15);
        }
    }, [center, map]);
    return null;
}

export default function ParroquiasManager({ username = '', password = '' }: { username?: string, password?: string }) {
    const [parroquias, setParroquias] = useState<Parroquia[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    
    // Directorio State
    const [dirSearch, setDirSearch] = useState('');
    const [selectedDirParroquia, setSelectedDirParroquia] = useState<Parroquia | null>(null);
    const [parroquiaVisitors, setParroquiaVisitors] = useState<any[]>([]);
    const [loadingVisitors, setLoadingVisitors] = useState(false);
    
    // Manual Visit State
    const [manualCedula, setManualCedula] = useState('');
    const [isAddingVisit, setIsAddingVisit] = useState(false);

    // Form State
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [vicaria, setVicaria] = useState('San Pedro');
    const [reward, setReward] = useState<number>(200);
    const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState('');

    const vicariasOptions = [
        "San Pedro",
        "Padre Misericordioso",
        "Histórica",
        "SUBA",
        "Templo",
        "Capilla"
    ];

    useEffect(() => {
        fetchParroquias();
    }, []);

    const fetchParroquias = async () => {
        try {
            const res = await fetch('/api/parroquias');
            if (res.ok) {
                const data = await res.json();
                setParroquias(data);
            }
        } catch (error) {
            console.error('Error fetching parroquias', error);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        
        setIsSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                const newCenter = { lat, lng: lon };
                setMapCenter(newCenter);
                setPinLocation(newCenter);
                setFeedback('Ubicación encontrada');
            } else {
                setFeedback('No se encontraron resultados');
            }
        } catch (error) {
            setFeedback('Error buscando ubicación');
        } finally {
            setIsSearching(false);
            setTimeout(() => setFeedback(''), 3000);
        }
    };

    const handleMapClick = (latlng: L.LatLng) => {
        setPinLocation({ lat: latlng.lat, lng: latlng.lng });
    };

    const handleEditParroquia = (p: Parroquia) => {
        setSelectedId(p.id);
        setName(p.name);
        setVicaria(p.vicaria || 'San Pedro');
        setReward(p.reward || 200);
        setPinLocation(p.center);
        setMapCenter(p.center);
    };

    const resetForm = () => {
        setSelectedId(null);
        setName('');
        setVicaria('San Pedro');
        setReward(200);
        setPinLocation(null);
    };

    const handleViewVisitors = async (p: Parroquia) => {
        setSelectedDirParroquia(p);
        setLoadingVisitors(true);
        setParroquiaVisitors([]);
        try {
            const res = await fetch('/api/parroquiaDetails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'visitors', parroquiaId: p.id })
            });
            const data = await res.json();
            if (res.ok) {
                setParroquiaVisitors(data);
            } else {
                console.error("Error fetching visitors:", data.error);
            }
        } catch (e) {
            console.error("Connection error:", e);
        } finally {
            setLoadingVisitors(false);
        }
    };

    const handleAddVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualCedula.trim() || !selectedDirParroquia) return;

        setIsAddingVisit(true);
        try {
            const res = await fetch('/api/parroquiaDetails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    action: 'add_visit', 
                    parroquiaId: selectedDirParroquia.id,
                    userCedula: manualCedula.trim()
                })
            });
            const data = await res.json();
            if (res.ok) {
                setManualCedula('');
                handleViewVisitors(selectedDirParroquia); // reload list
                alert('Visita agregada correctamente.');
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            alert('Error de conexión.');
        } finally {
            setIsAddingVisit(false);
        }
    };

    const handleDeleteVisit = async (visitId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta visita? Se descontarán los puntos al usuario.')) return;

        try {
            const res = await fetch('/api/parroquiaDetails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    action: 'delete_visit', 
                    visitId
                })
            });
            const data = await res.json();
            if (res.ok) {
                if (selectedDirParroquia) handleViewVisitors(selectedDirParroquia);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            alert('Error de conexión.');
        }
    };

    const filteredDir = parroquias.filter(p => 
        p.name.toLowerCase().includes(dirSearch.toLowerCase()) || 
        (p.code && p.code.toLowerCase().includes(dirSearch.toLowerCase()))
    );

    const handleSave = async () => {
        if (!name || !pinLocation) {
            setFeedback('Falta el nombre o seleccionar un punto en el mapa');
            setTimeout(() => setFeedback(''), 3000);
            return;
        }

        setIsSaving(true);
        const payload = {
            id: selectedId,
            name,
            vicaria,
            latitude: pinLocation.lat,
            longitude: pinLocation.lng,
            reward
        };

        try {
            const res = await fetch('/api/parroquias', {
                method: selectedId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setFeedback(selectedId ? 'Parroquia actualizada con éxito ✅' : 'Parroquia creada con éxito ✅');
                resetForm();
                fetchParroquias();
            } else {
                const errorData = await res.json();
                setFeedback(`Error: ${errorData.error}`);
            }
        } catch (error) {
            setFeedback('Error de red al guardar');
        } finally {
            setIsSaving(false);
            setTimeout(() => setFeedback(''), 3000);
        }
    };

    // Estadísticas
    const countByVicaria = parroquias.reduce((acc, p) => {
        const v = p.vicaria || 'Otra';
        acc[v] = (acc[v] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            <div className="bg-[#161616] rounded-3xl p-6 md:p-8 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Gestión de Parroquias</h2>
                    <p className="text-zinc-400 text-sm mt-1">Busca, agrega y modifica puntos en el mapa.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                    <span className="bg-brand/10 text-brand px-3 py-1.5 rounded-full border border-brand/20">
                        Total: {parroquias.length}
                    </span>
                    {Object.entries(countByVicaria).map(([vic, count]) => (
                        <span key={vic} className="bg-white/5 text-zinc-400 px-3 py-1.5 rounded-full border border-white/10">
                            {vic}: {count}
                        </span>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel Izquierdo: Formulario y Búsqueda */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Búsqueda */}
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar ciudad, barrio o dirección..."
                            className="flex-grow bg-[#161616] border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand/50"
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="bg-brand text-black px-4 py-2 rounded-xl font-bold hover:bg-brand/80 transition disabled:opacity-50"
                        >
                            {isSearching ? '...' : 'Buscar'}
                        </button>
                    </form>

                    {/* Formulario de Parroquia */}
                    <div className="bg-[#161616] p-6 rounded-3xl border border-white/5 space-y-4 relative">
                        {selectedId && (
                            <button 
                                onClick={resetForm}
                                className="absolute top-3 right-3 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/40 transition"
                            >
                                Cancelar Edición
                            </button>
                        )}
                        <h3 className="font-bold text-brand">{selectedId ? '✏️ Editando Parroquia' : '📍 Nueva Parroquia'}</h3>
                        
                        <div>
                            <label className="text-xs text-zinc-400 font-bold mb-1 block">Nombre Oficial</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Parroquia San José..."
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-bold mb-1 block">Vicaría / Zona</label>
                                <select
                                    value={vicaria}
                                    onChange={(e) => setVicaria(e.target.value)}
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand text-sm"
                                >
                                    {vicariasOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 font-bold mb-1 block">Reward (Puntos)</label>
                                <input
                                    type="number"
                                    value={reward}
                                    onChange={(e) => setReward(parseInt(e.target.value) || 0)}
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand text-sm"
                                />
                            </div>
                        </div>

                        <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/5">
                            <label className="text-xs text-zinc-400 font-bold block mb-1">Coordenadas (Pin Rojo)</label>
                            <p className="text-sm font-mono text-zinc-300 break-all">
                                {pinLocation ? `${pinLocation.lat.toFixed(5)}, ${pinLocation.lng.toFixed(5)}` : 'Haz click en el mapa para ubicarla'}
                            </p>
                        </div>

                        {feedback && (
                            <p className={`text-sm font-bold text-center ${feedback.includes('Error') || feedback.includes('Falta') ? 'text-red-400' : 'text-green-400'}`}>
                                {feedback}
                            </p>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={isSaving || !name || !pinLocation}
                            className={`w-full font-bold p-3 rounded-xl transition ${
                                selectedId 
                                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                                : 'bg-green-600 hover:bg-green-500 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isSaving ? 'Guardando...' : selectedId ? 'Actualizar Parroquia' : 'Guardar Parroquia'}
                        </button>
                    </div>
                </div>

                {/* Panel Derecho: Mapa */}
                <div className="lg:col-span-2 h-[500px] rounded-2xl overflow-hidden border border-white/10 z-0">
                    {typeof window !== 'undefined' && (
                        <MapContainer 
                            center={[4.6097, -74.0817]} // Default Bogotá
                            zoom={12} 
                            scrollWheelZoom={true} 
                            style={{ height: "100%", width: "100%", zIndex: 1 }}
                        >
                            <TileLayer
                                attribution='&copy; OpenStreetMap'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapEvents onMapClick={handleMapClick} />
                            <MapViewUpdater center={mapCenter} />
                            
                            {/* Marker Activo (El que se está creando/editando) */}
                            {pinLocation && (
                                <Marker 
                                    position={pinLocation} 
                                    icon={redIcon}
                                    draggable={true}
                                    eventHandlers={{
                                        dragend: (e) => {
                                            const marker = e.target;
                                            const position = marker.getLatLng();
                                            setPinLocation({ lat: position.lat, lng: position.lng });
                                        }
                                    }}
                                >
                                    <Popup>Ubicación Seleccionada</Popup>
                                </Marker>
                            )}

                            {/* Markers de Parroquias Existentes */}
                            {parroquias.map((p) => {
                                // No dibujar si es la que estamos editando para evitar duplicados visuales confusos
                                if (p.id === selectedId) return null;

                                return (
                                    <Marker 
                                        key={p.id} 
                                        position={p.center} 
                                        icon={customIcon}
                                        eventHandlers={{
                                            click: () => handleEditParroquia(p)
                                        }}
                                    >
                                        <Popup>
                                            <div className="text-center text-black">
                                                <strong className="block mb-1">{p.name}</strong>
                                                <span className="text-xs text-gray-500 block">{p.vicaria}</span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleEditParroquia(p); }}
                                                    className="mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded w-full font-bold"
                                                >
                                                    Editar
                                                </button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    )}
                </div>
            </div>

            {/* Directorio de Parroquias */}
            <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                        Directorio y Auditoría
                    </h3>
                    <input
                        type="text"
                        value={dirSearch}
                        onChange={(e) => setDirSearch(e.target.value)}
                        placeholder="Buscar por nombre o código (ej. P-001)..."
                        className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand/50 mb-4"
                    />
                </div>
                
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0a0a0a]">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-white/5 text-zinc-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Código</th>
                                <th className="p-4 font-bold">Parroquia</th>
                                <th className="p-4 font-bold">Vicaria</th>
                                <th className="p-4 font-bold text-center">Recompensa</th>
                                <th className="p-4 font-bold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredDir.map(p => (
                                <tr key={p.id} className="hover:bg-white/5 transition">
                                    <td className="p-4 font-mono text-zinc-400">{p.code || '-'}</td>
                                    <td className="p-4 font-medium text-white">{p.name}</td>
                                    <td className="p-4 text-zinc-400">{p.vicaria}</td>
                                    <td className="p-4 text-brand font-mono text-center">+{p.reward}</td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleViewVisitors(p)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition border bg-brand/10 border-brand/30 text-brand hover:bg-brand/20"
                                        >
                                            Ver Visitantes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredDir.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-500 italic">No se encontraron parroquias en el directorio.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Parroquia Visitors Modal */}
            {selectedDirParroquia && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#161616] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedDirParroquia.name}</h3>
                                <p className="text-sm text-zinc-400 mt-1 font-mono">
                                    {selectedDirParroquia.code || 'Sin código'} • {selectedDirParroquia.vicaria}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedDirParroquia(null)}
                                className="text-zinc-500 hover:text-white transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                <h4 className="text-white font-bold flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                    Historial de Visitantes
                                </h4>
                                
                                <form onSubmit={handleAddVisit} className="flex gap-2 w-full md:w-auto">
                                    <input
                                        type="text"
                                        placeholder="Cédula o celular..."
                                        value={manualCedula}
                                        onChange={(e) => setManualCedula(e.target.value)}
                                        className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand/50 w-full md:w-48"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isAddingVisit || !manualCedula.trim()}
                                        className="bg-brand text-black px-3 py-2 rounded-lg text-sm font-bold hover:bg-brand/80 disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {isAddingVisit ? 'Agregando...' : '+ Visita'}
                                    </button>
                                </form>
                            </div>
                            
                            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
                                {loadingVisitors ? (
                                    <p className="p-6 text-center text-sm text-brand animate-pulse">Cargando visitantes...</p>
                                ) : parroquiaVisitors.length === 0 ? (
                                    <p className="p-6 text-center text-sm text-zinc-500">Nadie ha visitado esta parroquia aún.</p>
                                ) : (
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="border-b border-white/5 text-zinc-500 text-xs uppercase tracking-wider">
                                                <th className="p-4 font-bold">Participante</th>
                                                <th className="p-4 font-bold text-center">Puntos Obtenidos</th>
                                                <th className="p-4 font-bold text-center">Fecha de Escaneo</th>
                                                <th className="p-4 font-bold text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {parroquiaVisitors.map((v, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition group">
                                                    <td className="p-4">
                                                        <div className="text-white font-bold">{v.username || 'Anónimo'}</div>
                                                        <div className="text-xs text-zinc-500 mt-1">
                                                            {v.phone ? `📱 ${v.phone}` : ''} {v.cedula ? ` | 🪪 ${v.cedula}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-brand font-mono font-bold text-center">+{v.points_awarded}</td>
                                                    <td className="p-4 text-center text-zinc-400 text-xs">
                                                        {new Date(v.visited_at).toLocaleString('es-CO')}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button 
                                                            onClick={() => handleDeleteVisit(v.visit_id)}
                                                            className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded transition opacity-0 group-hover:opacity-100"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
