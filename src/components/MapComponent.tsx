'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { getParroquias, Parroquia } from '../app/actions/getParroquias';
import { Location, LOCATIONS } from '../data/locations';

// Fix for default marker icon missing in Leaflet with Webpack/Next.js
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
    iconSize: [32, 32], // Adjust size as needed
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

interface LocationWithDistance extends Location {
    distance: number;
}

function MapInner({ onLocationFound, triggerLocate, isFollowing, setIsFollowing, userPosition }: {
    onLocationFound: (latlng: L.LatLng) => void,
    triggerLocate: number,
    isFollowing: boolean,
    setIsFollowing: (v: boolean) => void,
    userPosition: L.LatLng | null
}) {
    const map = useMap();

    // Handle user interaction (drag) to stop following
    useEffect(() => {
        const onDrag = () => {
            if (isFollowing) {
                setIsFollowing(false);
            }
        };
        map.on('dragstart', onDrag);
        return () => {
            map.off('dragstart', onDrag);
        };
    }, [map, isFollowing, setIsFollowing]);

    // Handle "Follow Me" behavior: Fly to user position when following is enabled or position updates
    useEffect(() => {
        if (isFollowing && userPosition) {
            map.flyTo(userPosition, 17, { animate: true, duration: 1.5 });
        }
    }, [map, isFollowing, userPosition]);

    // Location Polling
    useEffect(() => {
        // Initial locate
        map.locate({ setView: false });

        // Interval locate every 5 seconds
        const interval = setInterval(() => {
            map.locate({ setView: false });
        }, 5000);

        const onLocate = (e: L.LocationEvent) => {
            onLocationFound(e.latlng);
            // We do NOT flyTo here anymore; the separate useEffect handles it via state change.
            // This keeps logic clean: Data updates state -> State updates View.
        };

        map.on("locationfound", onLocate);

        return () => {
            clearInterval(interval);
            map.off("locationfound", onLocate);
        };
    }, [map, onLocationFound]);

    useEffect(() => {
        if (triggerLocate > 0) {
            map.locate({ setView: false });
        }
    }, [triggerLocate, map]);

    return null;
}

export default function MapComponent() {
    const [mounted, setMounted] = useState(false);
    const [userPosition, setUserPosition] = useState<L.LatLng | null>(null);
    const [isFollowing, setIsFollowing] = useState(true); // Default to following
    const [sortedLocations, setSortedLocations] = useState<LocationWithDistance[]>([]);
    const [closestLocation, setClosestLocation] = useState<LocationWithDistance | null>(null);
    const [isInside, setIsInside] = useState(false);
    const [triggerLocate, setTriggerLocate] = useState(0);

    // Mobile Data Hint
    const [showMobileDataHint, setShowMobileDataHint] = useState(true);

    // UI States
    const [showConfirmPopup, setShowConfirmPopup] = useState(false);
    const [visitConfirmed, setVisitConfirmed] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [parroquias, setParroquias] = useState<Parroquia[]>([]);

    useEffect(() => {
        const fetchParroquias = async () => {
            const data = await getParroquias();
            setParroquias(data);
        };
        fetchParroquias();
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLocationFound = (latlng: L.LatLng) => {
        setUserPosition(latlng);

        const locationsWithDistance = LOCATIONS.map(loc => {
            const locLatLng = L.latLng(loc.center.lat, loc.center.lng);
            return {
                ...loc,
                distance: latlng.distanceTo(locLatLng)
            };
        });

        const sorted = locationsWithDistance.sort((a, b) => a.distance - b.distance);
        setSortedLocations(sorted);

        if (sorted.length > 0) {
            const closest = sorted[0];
            setClosestLocation(closest);
            setIsInside(closest.distance <= closest.radius);
        }
    };

    const handleRecenter = () => {
        setIsFollowing(true);
        setTriggerLocate(prev => prev + 1);
    };

    const handleConfirmVisit = () => {
        setShowConfirmPopup(true);
        setVisitConfirmed(true);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !closestLocation) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('parishName', closestLocation.name);

        setUploading(true);
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                setUploadSuccess(true);
            } else {
                alert('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading:', error);
            alert('Error uploading file');
        } finally {
            setUploading(false);
        }
    };

    const getVicariaColor = (vicaria: string | undefined): string => {
        if (!vicaria) return 'gray';
        const v = vicaria.toLowerCase();
        if (v.includes('san pedro')) return 'green';
        if (v.includes('misericordioso')) return 'blue';
        if (v.includes('historica') || v.includes('histórica')) return 'yellow';
        return 'gray';
    };

    if (!mounted) return <p>Loading map...</p>;

    return (
        <div className="relative h-full w-full flex flex-col md:flex-row">
            {/* Sidebar / Overlay for Controls */}
            <div className="order-2 md:order-1 w-full md:w-80 bg-white dark:bg-zinc-900 p-4 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 z-[1000] shadow-md">
                <h2 className="text-lg font-bold mb-4">Nearby Locations</h2>

                <button
                    onClick={handleRecenter}
                    className="w-full mb-4 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                    {isFollowing ? "📍 Following You" : "◎ Recenter / Follow"}
                </button>

                {closestLocation && (
                    <div className="mb-6 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <h3 className="font-semibold text-sm text-zinc-500 uppercase mb-2">Closest Location</h3>
                        <p className="font-bold text-lg">{closestLocation.name}</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                            {Math.round(closestLocation.distance)}m away (Radius: {closestLocation.radius}m)
                        </p>

                        <div className="flex flex-col gap-2">
                            <div className={`text-sm font-medium ${isInside ? 'text-green-600' : 'text-orange-500'}`}>
                                {isInside ? "You are inside the location!" : "You are outside the location."}
                            </div>

                            <button
                                onClick={handleConfirmVisit}
                                disabled={!isInside || visitConfirmed}
                                className={`w-full py-2 px-4 rounded font-medium transition-colors ${!isInside
                                    ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                                    : visitConfirmed
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                            >
                                {visitConfirmed ? 'Visit Confirmed ✓' : 'Confirm Visit'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {sortedLocations.slice(1).map(loc => (
                        <div key={loc.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-100 dark:border-zinc-800">
                            <p className="font-medium">{loc.name}</p>
                            <p className="text-sm text-zinc-500">{Math.round(loc.distance)}m away</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Map Container */}
            <div className="order-1 md:order-2 flex-grow relative h-[50vh] md:h-auto">
                {showMobileDataHint && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-blue-100 text-blue-800 px-4 py-2 rounded-full shadow-lg text-xs md:text-sm font-medium flex items-center gap-2">
                        <span>📡 Suggestion: Use Mobile Data (not WiFi) for better GPS accuracy.</span>
                        <button
                            onClick={() => setShowMobileDataHint(false)}
                            className="ml-2 text-blue-600 hover:text-blue-900 font-bold"
                        >
                            ✕
                        </button>
                    </div>
                )}
                <MapContainer center={LOCATIONS[0].center} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapInner
                        onLocationFound={handleLocationFound}
                        triggerLocate={triggerLocate}
                        isFollowing={isFollowing}
                        setIsFollowing={setIsFollowing}
                        userPosition={userPosition}
                    />

                    {userPosition && (
                        <Marker position={userPosition} icon={customIcon}>
                            <Popup>You are here</Popup>
                        </Marker>
                    )}

                    {/* Display LOCATIONS (built-in) */}
                    {LOCATIONS.map(loc => (
                        <Circle
                            key={loc.id}
                            center={loc.center}
                            radius={loc.radius}
                            pathOptions={{
                                color: closestLocation?.id === loc.id ? 'green' : 'blue',
                                fillColor: closestLocation?.id === loc.id ? 'green' : 'blue',
                                fillOpacity: 0.2
                            }}
                        >
                            <Popup>{loc.name}</Popup>
                        </Circle>
                    ))}

                    {/* Display Fetched Parroquias */}
                    {parroquias.map(p => {
                        const color = getVicariaColor(p.vicaria);
                        return (
                            <div key={p.id}>
                                <Circle
                                    center={p.center}
                                    radius={30}
                                    pathOptions={{
                                        color: color,
                                        fillColor: color,
                                        fillOpacity: 0.2
                                    }}
                                />
                                <Marker
                                    position={p.center}
                                    icon={parroquiaIcon}
                                >
                                    <Popup>
                                        <div className="font-bold">{p.name}</div>
                                        <div className="text-sm text-gray-500">{p.vicaria}</div>
                                    </Popup>
                                </Marker>
                            </div>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Confirmation Modal */}
            {showConfirmPopup && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Visit Confirmed!</h3>
                        <p className="mb-6 text-zinc-600 dark:text-zinc-300">
                            You have successfully confirmed your visit to <strong>{closestLocation?.name}</strong>.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Upload a photo</label>
                            {uploadSuccess ? (
                                <div className="p-3 bg-green-100 text-green-700 rounded border border-green-200 text-center">
                                    Photo uploaded successfully!
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    className="block w-full text-sm text-zinc-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100"
                                />
                            )}
                            {uploading && <p className="text-sm text-blue-600 mt-2">Uploading...</p>}
                        </div>

                        <button
                            onClick={() => setShowConfirmPopup(false)}
                            className="w-full py-2 bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
