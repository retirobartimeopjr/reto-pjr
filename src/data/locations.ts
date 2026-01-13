export interface Location {
    id: string;
    name: string;
    center: { lat: number; lng: number };
    radius: number; // meters
}

export const LOCATIONS: Location[] = [
    {
        id: '1',
        name: "Santuario Nino Jesus de Puente",
        center: { lat: 5.892120242899102, lng: -73.6521367558167 },
        radius: 100
    },
    {
        id: '2',
        name: "Catedral de Tunja",
        center: { lat: 5.53528, lng: -73.36778 },
        radius: 100
    },
    {
        id: '3',
        name: "Basílica de Nuestra Señora del Rosario de Chiquinquirá",
        center: { lat: 5.61667, lng: -73.81667 },
        radius: 100
    },
    // Adding a test location near the default map center (London) for testing if geolocation fails or defaults
    {
        id: 'test-london',
        name: "Test Location (London)",
        center: { lat: 51.505, lng: -0.09 },
        radius: 500
    }
];
