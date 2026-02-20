import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { userStore } from '../store/userStore';

export default function PublicActions() {
    const user = useStore(userStore);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Only show if user is NOT authenticated
    if (!mounted || user.isAuthenticated === 'true') {
        return null;
    }

    const handleShare = async () => {
        const shareData = {
            title: 'Reto Bartimeo',
            text: '¡Hola! Te invito a unirte al Reto Bartimeo este año. Es una experiencia increíble que sé que te va a gustar. Dale un vistazo aquí: https://retirobartimeo.org ¡Anímate!'
        };

        try {
            // 2. Fallback: Abrir WhatsApp en una pestaña nueva
            const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');

        } catch (err) {
            console.error('Error al compartir:', err);
        }
    };

    const handleDonate = () => {
        if ((window as any).openDonationModal) {
            (window as any).openDonationModal();
        }
    };

    return (
        <div className="w-full max-w-md mx-auto px-4 mt-8 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <div className="grid grid-cols-2 gap-4">
                {/* Invite Button */}
                <button
                    onClick={handleShare}
                    className="relative overflow-hidden group bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-white/5"
                >
                    <div className="flex flex-col items-center gap-2 relative z-10">
                        <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 group-hover:scale-110 transition-transform duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <span className="font-serif text-white/90 font-medium tracking-wide">Invitar Amigos</span>
                    </div>
                </button>

                {/* Donate Button */}
                <button
                    onClick={handleDonate}
                    className="relative overflow-hidden group bg-gradient-to-br from-[#722F37]/40 to-[#3d0000]/40 hover:from-[#722F37]/60 hover:to-[#3d0000]/60 border border-[#f8b134]/20 hover:border-[#f8b134]/40 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(114,47,55,0.3)]"
                >
                    <div className="absolute inset-0 bg-[#f8b134]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="flex flex-col items-center gap-2 relative z-10">
                        <div className="p-3 bg-[#f8b134]/10 rounded-full text-[#f8b134] group-hover:scale-110 transition-transform duration-300 shadow-[0_0_10px_rgba(248,177,52,0.2)]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <span className="font-serif text-[#f8b134] font-medium tracking-wide">Hacer Donación</span>
                    </div>
                </button>
            </div>
        </div>
    );
}
