'use server';

import { readSheet } from '@/lib/googleSheets';

export interface Parroquia {
    id: string;
    name: string;
    center: { lat: number; lng: number };
    vicaria: string;
}

export async function getParroquias(): Promise<Parroquia[]> {
    try {
        const rows = await readSheet('parroquia!A:F');
        // validRows filters out header or empty rows if necessary.
        // Assuming row format: Column A=ID, Column B=Name, Column D=Location(lat, lng), Column F=Vicaria
        // Indexes: A=0, B=1, C=2, D=3, E=4, F=5

        const parroquias: Parroquia[] = rows
            .filter(row => row[0] && row[1] && row[3]) // Basic validation
            .map(row => {
                try {
                    const [latStr, lngStr] = row[3].split(',').map((s: string) => s.trim());
                    const lat = parseFloat(latStr);
                    const lng = parseFloat(lngStr);

                    if (isNaN(lat) || isNaN(lng)) return null;

                    return {
                        id: row[0],
                        name: row[1],
                        center: { lat, lng },
                        vicaria: row[5] || '' // Column F is index 5
                    };
                } catch (e) {
                    console.error('Error parsing row:', row, e);
                    return null;
                }
            })
            .filter((item): item is Parroquia => item !== null);

        return parroquias;
    } catch (error) {
        console.error('Failed to fetch parroquias:', error);
        return [];
    }
}
