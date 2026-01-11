'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const MapComponent = dynamic(() => import('../../components/MapComponent'), {
    ssr: false,
    loading: () => <p>Loading Map...</p>
});

export default function MapPage() {
    return (
        <div className="flex flex-col h-screen w-full">
            <header className="p-4 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <h1 className="text-xl font-bold">GPS Locator</h1>
                <Link href="/" className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    Back to Home
                </Link>
            </header>
            <main className="flex-grow relative">
                <MapComponent />
            </main>
        </div>
    );
}
