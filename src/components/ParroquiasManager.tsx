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

export default function ParroquiasManager() {
    const [parroquias, setParroquias] = useState<Parroquia[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    
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
        <div className="bg-[#1a1a1a] rounded-3xl p-6 md:p-8 border border-white/10 mt-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-brand">Gestión de Parroquias</h2>
                    <p className="text-zinc-400 text-sm mt-1">Busca, agrega y modifica puntos en el mapa.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                    <span className="bg-brand/20 text-brand px-3 py-1 rounded-full border border-brand/30">
                        Total: {parroquias.length}
                    </span>
                    {Object.entries(countByVicaria).map(([vic, count]) => (
                        <span key={vic} className="bg-white/5 text-zinc-300 px-3 py-1 rounded-full border border-white/10">
                            {vic}: {count}
                        </span>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel Izquierdo: Formulario y Búsqueda */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Búsqueda */}
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar ciudad, barrio o dirección..."
                            className="flex-grow bg-[#222] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand"
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
                    <div className="bg-[#222] p-5 rounded-2xl border border-white/5 space-y-4 relative">
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
                                className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-brand"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-bold mb-1 block">Vicaría / Zona</label>
                                <select
                                    value={vicaria}
                                    onChange={(e) => setVicaria(e.target.value)}
                                    className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-brand text-sm"
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
                                    className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-brand"
                                />
                            </div>
                        </div>

                        <div className="bg-[#111] p-3 rounded-lg border border-white/5">
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
        </div>
    );
}
