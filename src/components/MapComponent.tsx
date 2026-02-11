import { useStore } from '@nanostores/react';
import confetti from 'canvas-confetti';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { LOCATIONS } from '../data/locations'; // We will need to port this
import { db } from '../lib/firebase.client';
import { isLoginOpen } from '../store/uiStore';
import { userStore } from '../store/userStore';


// Fix for default marker icon missing in Leaflet with Webpack/Next.js/Astro
// Use local paths or CDN. Leaflet in Astro might need explicit icon configuration.
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const customIcon = new L.Icon({
    iconUrl: iconUrl,
    iconRetinaUrl: iconRetinaUrl,
    shadowUrl: shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const parroquiaIcon = new L.Icon({
    iconUrl: '/parroquia.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

interface Location {
    id: string;
    name: string;
    center: { lat: number; lng: number };
    radius: number;
}

interface Parroquia {
    id: string;
    name: string;
    vicaria?: string;
    center: { lat: number; lng: number };
    reward: number;
}

interface LocationWithDistance extends Location {
    distance: number;
}

function MapInner({ onLocationFound, triggerLocate, isFollowing, setIsFollowing, userPosition, flyToTarget }: {
    onLocationFound: (latlng: L.LatLng) => void,
    triggerLocate: number,
    isFollowing: boolean,
    setIsFollowing: (v: boolean) => void,
    userPosition: L.LatLng | null,
    flyToTarget: { lat: number; lng: number } | null
}) {
    const map = useMap();

    // Workaround for map not rendering tiles correctly sometimes on resize/load
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);

    // Handle user interaction (drag/click)
    useEffect(() => {
        const onInteraction = () => {
            if (isFollowing) {
                setIsFollowing(false);
            }
            // If we don't have user position yet, try to get it on interaction
            if (!userPosition) {
                map.locate({ setView: false, enableHighAccuracy: true });
            }
        };

        map.on('dragstart', onInteraction);
        map.on('click', onInteraction);

        return () => {
            map.off('dragstart', onInteraction);
            map.off('click', onInteraction);
        };
    }, [map, isFollowing, setIsFollowing, userPosition]);

    // Handle "Follow Me" behavior
    useEffect(() => {
        if (isFollowing && userPosition) {
            map.flyTo(userPosition, 17, { animate: true, duration: 1.0 });
        }
    }, [map, isFollowing, userPosition]);

    // Handle "Click to Fly" behavior
    useEffect(() => {
        if (flyToTarget) {
            map.flyTo(flyToTarget, 18, { animate: true, duration: 1.5 });
        }
    }, [map, flyToTarget]);

    // Location Polling
    useEffect(() => {
        map.locate({ setView: false, enableHighAccuracy: true });

        const interval = setInterval(() => {
            if (isFollowing) {
                map.locate({ setView: false, enableHighAccuracy: true });
            }
        }, 5000); // Back to 5s for stability

        const onLocate = (e: L.LocationEvent) => {
            onLocationFound(e.latlng);
        };

        const onLocationError = (e: L.ErrorEvent) => {
            console.error("Location error:", e.message);
        };

        map.on("locationfound", onLocate);
        map.on("locationerror", onLocationError);

        return () => {
            clearInterval(interval);
            map.off("locationfound", onLocate);
            map.off("locationerror", onLocationError);
        };
    }, [map, onLocationFound, isFollowing]);

    useEffect(() => {
        if (triggerLocate > 0) {
            map.locate({ setView: false, enableHighAccuracy: true });
        }
    }, [triggerLocate, map]);

    return null;
}

export default function MapComponent() {
    const user = useStore(userStore);
    const [mounted, setMounted] = useState(false);
    const [userPosition, setUserPosition] = useState<L.LatLng | null>(null);
    const [isFollowing, setIsFollowing] = useState(true);
    const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number } | null>(null);
    const [sortedLocations, setSortedLocations] = useState<LocationWithDistance[]>([]);
    const [closestLocation, setClosestLocation] = useState<LocationWithDistance | null>(null);
    const [isInside, setIsInside] = useState(false);
    const [triggerLocate, setTriggerLocate] = useState(0);
    const [parroquias, setParroquias] = useState<Parroquia[]>([]);
    const [showMobileDataHint, setShowMobileDataHint] = useState(true);
    const [visitConfirmed, setVisitConfirmed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Fetch Parroquias from API
        fetch('/api/parroquias')
            .then(res => res.json())
            .then(data => setParroquias(data))
            .catch(err => console.error("Error fetching parroquias:", err));
    }, []);

    // Calculate distances
    useEffect(() => {
        // If no user position, list is empty? No, let's show all sorted by default center or something?
        // Actually, if we stick to "Nearby", we need position.
        // But to debug "no elements appear", let's ensure we log.
        if (!userPosition && parroquias.length > 0) {
            // Fallback: Show list but with distance from default center?
            // Or just wait.
            return;
        }
        if (!userPosition) return;

        const parishLocations = parroquias.map(p => ({
            id: p.id,
            name: p.name,
            center: p.center,
            radius: 30,
            reward: p.reward
        }));

        const allLocations = [...LOCATIONS, ...parishLocations];

        const locationsWithDistance = allLocations.map(loc => {
            const locLatLng = L.latLng(loc.center.lat, loc.center.lng);
            return {
                ...loc,
                distance: userPosition.distanceTo(locLatLng)
            };
        });

        const sorted = locationsWithDistance.sort((a, b) => a.distance - b.distance);

        // Filter logic: Show nearby within 5km, OR if list is empty, maybe show top 5 regardless of distance?
        const THRESHOLD_METERS = 5000;
        const filtered = sorted.filter(l => l.distance <= THRESHOLD_METERS);

        // If nothing is nearby, maybe user is far mostly. Show closest anyway?
        // Let's fallback to showing top 5 closest if filtered is empty.
        const finalDisplay = filtered.length > 0 ? filtered : sorted.slice(0, 5);

        setSortedLocations(finalDisplay);

        if (finalDisplay.length > 0) {
            const closest = finalDisplay[0];
            setClosestLocation(closest);
            setIsInside(closest.distance <= closest.radius);
        }
    }, [userPosition, parroquias]);

    const handleLocationFound = (latlng: L.LatLng) => {
        setUserPosition(latlng);
    };

    const handleRecenter = () => {
        setIsFollowing(true);
        setTriggerLocate(prev => prev + 1);
    };

    const handleConfirmVisit = async () => {
        if (user.isAuthenticated !== 'true') {
            isLoginOpen.set(true);
            return;
        }

        if (!closestLocation) return;

        // Find the full parroquia object to get the reward, or cast closestLocation if we added it there
        // Since we mapped parishLocations with reward, it should be in closestLocation as an extended property
        // But Typescript might complain if we don't extend LocationWithDistance. 
        // For now, let's treat it as any or look it up.
        // Quickest fix: cast closestLocation to any to access reward.
        const locationReward = (closestLocation as any).reward || 0;
        const parroquiaId = closestLocation.id;

        setLoading(true);

        try {
            await addDoc(collection(db, 'visit'), {
                userId: user.docId,
                parroquiaid: parroquiaId,
                reward: locationReward,
                timestamp: serverTimestamp(),
                userLocation: "GPS_CONFIRMED",
                platform: "web"
            });

            console.log("Visit sent successfully:", {
                userId: user.docId,
                parroquiaid: parroquiaId,
                reward: locationReward
            });

            setVisitConfirmed(true);
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });

        } catch (error) {
            console.error("Error creating visit:", error);
            alert("Hubo un error al registrar la visita. Intenta nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    // ... file upload logic omitted for brevity in first pass, or can be ported.
    // Let's include a stub for file upload.
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { };


    const getVicariaColor = (vicaria: string | undefined): string => {
        if (!vicaria) return 'gray';
        const v = vicaria.toLowerCase();
        if (v.includes('san pedro')) return 'green';
        if (v.includes('misericordioso')) return 'blue';
        if (v.includes('historica') || v.includes('histórica')) return 'yellow';
        return 'gray';
    };

    if (!mounted) return (
        <div className="h-full w-full flex flex-col items-center justify-center text-white bg-zinc-900/50 backdrop-blur-sm gap-4">
            <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            <p className="font-medium text-brand animate-pulse">Cargando Mapa...</p>
        </div>
    );

    return (
        <div className="relative h-full w-full flex flex-col md:flex-row text-black dark:text-white">
            {/* Sidebar with distinct background */}
            <div className="order-2 md:order-1 w-full md:w-[35%] bg-zinc-900/95 backdrop-blur-md border-t md:border-t-0 md:border-r border-white/10 shadow-xl h-1/2 md:h-full overflow-y-auto z-[1001]">
                <div className="p-4 sticky top-0 bg-zinc-900/95 backdrop-blur z-10 border-b border-white/5">
                    <h2 className="text-lg font-bold mb-4 text-brand uppercase tracking-wider">Ubicaciones Cercanas</h2>
                    <button
                        onClick={handleRecenter}
                        className={`w-full py-3 px-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${isFollowing
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-brand text-black hover:bg-[#ffc857] shadow-brand/20"
                            }`}
                    >
                        {isFollowing ? "📍 Siguiéndote" : "◎ Recentrar / Seguir"}
                    </button>
                </div>

                <div className="px-4 pb-4 space-y-4">
                    {/* Closest Location Card */}
                    {closestLocation && (
                        <div className="p-5 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl border border-brand/30 shadow-[0_0_15px_rgba(248,177,52,0.1)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-brand" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                            </div>

                            <h3 className="font-bold text-xs text-brand/80 uppercase mb-1 tracking-widest">Más Cercana</h3>
                            <p className="font-bold text-xl text-white mb-1 group-hover:text-brand transition-colors">{closestLocation.name}</p>
                            <p className="text-sm text-zinc-400 mb-4 font-mono">{Math.round(closestLocation.distance)}m de distancia</p>

                            <div className={`text-sm font-bold flex items-center gap-2 mb-4 ${isInside ? 'text-green-400' : 'text-orange-400'}`}>
                                <span className={`inline-block w-2 h-2 rounded-full ${isInside ? 'bg-green-400 animate-pulse' : 'bg-orange-400'}`}></span>
                                {isInside ? "¡Estás dentro del radio!" : "Acércate más para validar"}
                            </div>

                            <button
                                onClick={handleConfirmVisit}
                                disabled={!isInside || visitConfirmed || loading}
                                className={`w-full py-2 px-4 rounded-lg font-bold text-sm transition-all ${visitConfirmed
                                    ? 'bg-green-500/20 text-green-400 cursor-default'
                                    : !isInside
                                        ? 'bg-white/5 text-zinc-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] text-black shadow-lg shadow-orange-500/20 active:scale-95'
                                    }`}
                            >
                                {visitConfirmed ? '¡Visita Confirmada!' : loading ? 'Registrando...' : '¡Sí, estoy aquí!'}
                            </button>
                        </div>
                    )}

                    {/* List */}
                    <div className="space-y-2">
                        {sortedLocations.length === 0 && <p className="text-zinc-500 text-sm text-center py-4 italic">Esperando señal GPS...</p>}
                        {sortedLocations.slice(1).map(loc => (
                            <div key={loc.id}
                                className="group p-4 bg-zinc-900/50 rounded-xl border border-white/5 hover:border-brand/30 cursor-pointer hover:bg-white/5 transition-all active:scale-[0.98]"
                                onClick={() => { setIsFollowing(false); setFlyToTarget(loc.center); }}
                            >
                                <div className="flex justify-between items-start">
                                    <p className="font-bold text-zinc-300 group-hover:text-white transition-colors">{loc.name}</p>
                                    <span className="text-xs font-mono text-zinc-500 group-hover:text-brand">{Math.round(loc.distance)}m</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Map */}
            <div className="order-1 md:order-2 flex-grow relative h-1/2 md:h-full">
                {showMobileDataHint && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-blue-100 text-blue-800 px-4 py-2 rounded-full shadow-lg text-xs font-medium flex gap-2">
                        <span>📡 Use Mobile Data for best GPS.</span>
                        <button onClick={() => setShowMobileDataHint(false)}>✕</button>
                    </div>
                )}
                <MapContainer center={LOCATIONS[0].center} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                        attribution='&copy; OpenStreetMap'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapInner
                        onLocationFound={handleLocationFound}
                        triggerLocate={triggerLocate}
                        isFollowing={isFollowing}
                        setIsFollowing={setIsFollowing}
                        userPosition={userPosition}
                        flyToTarget={flyToTarget}
                    />
                    {userPosition && (
                        <Marker position={userPosition} icon={customIcon}><Popup>You are here</Popup></Marker>
                    )}
                    {/* Static Locations */}
                    {LOCATIONS.map(loc => (
                        <Circle key={loc.id} center={loc.center} radius={loc.radius} pathOptions={{ color: 'blue', fillOpacity: 0.2 }}>
                            <Popup>{loc.name}</Popup>
                        </Circle>
                    ))}
                    {/* Parroquias */}
                    {parroquias.map(p => (
                        <React.Fragment key={p.id}>
                            <Circle center={p.center} radius={30} pathOptions={{ color: getVicariaColor(p.vicaria), fillOpacity: 0.2 }} />
                            <Marker position={p.center} icon={parroquiaIcon}>
                                <Popup>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-sm">{p.vicaria}</div>
                                </Popup>
                            </Marker>
                        </React.Fragment>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
