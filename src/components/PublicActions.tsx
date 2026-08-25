import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { userStore } from '../store/userStore';

export default function PublicActions() {
    const user = useStore(userStore);
    const [mounted, setMounted] = useState(false);
    const [showDonationInfo, setShowDonationInfo] = useState(false);

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
            const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
            console.error('Error al compartir:', err);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText('3182004659');
        alert('¡Número copiado al portapapeles!');
    };

    const modalContent = showDonationInfo ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-[#6b3131] rounded-[2rem] w-full max-w-sm relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10">
                <button 
                    onClick={() => setShowDonationInfo(false)}
                    className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/30 rounded-full p-2 transition z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-8 pt-10 flex flex-col items-center text-center">
                    <div className="flex justify-center items-center gap-4 mb-6 relative z-10">
                        <a onClick={(e) => {
                            e.preventDefault();
                            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                            if (isMobile) {
                                window.location.href = 'nequi://';
                            } else {
                                window.open('https://www.nequi.com.co/', '_blank');
                            }
                        }} className="bg-black/20 p-2 rounded-xl border border-white/5 hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm">
                            <img src="/nequi.png" alt="Nequi" className="h-6 object-contain drop-shadow-md" />
                        </a>
                        <div className="w-px h-6 bg-white/20"></div>
                        <a onClick={(e) => {
                            e.preventDefault();
                            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                            if (isMobile) {
                                window.location.href = 'nequi://';
                            } else {
                                window.open('https://www.nequi.com.co/', '_blank');
                            }
                        }} className="flex items-center gap-2 bg-black/20 p-2 pr-3 border border-white/5 rounded-xl hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm">
                            <span className="text-white font-bold text-sm drop-shadow-sm">BreB</span>
                            <img src="/breve.avif" alt="Bre-B" className="h-4 object-contain rounded-full shadow-sm" />
                        </a>
                    </div>
                    
                    <p className="text-white text-[15px] font-medium tracking-wide">Por favor transferir a Nicolas Borrero</p>
                    <p className="text-white/80 text-[13px] mb-6">(Líder Joven de Bartimeo)</p>
                    
                    <button 
                        onClick={copyToClipboard}
                        className="w-full bg-[#4a2222] hover:bg-[#3d1c1c] transition-colors rounded-2xl py-5 flex flex-col items-center justify-center cursor-pointer mb-8 border border-black/20 shadow-inner"
                    >
                        <span className="font-[Titan_One] text-[#f8b134] text-4xl tracking-widest mb-2">3182004659</span>
                        <span className="text-white/60 text-[11px] font-bold tracking-widest uppercase flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Toca para copiar
                        </span>
                    </button>
                    
                    <div className="w-full flex items-center gap-3 mb-8">
                        <div className="h-px bg-white/20 flex-1"></div>
                        <span className="text-white/60 text-[11px] font-bold uppercase tracking-widest">O SI PREFIERES</span>
                        <div className="h-px bg-white/20 flex-1"></div>
                    </div>
                    
                    <a 
                        href="https://checkout.nequi.wompi.co/l/VPOS_LoWyIu"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-white hover:bg-gray-100 text-[#6b3131] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition"
                    >
                        Donar con Tarjeta o PSE (Wompi)
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            <div className="w-full max-w-md mx-auto px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                <div className="grid grid-cols-2 gap-4">
                    {/* Invite Button - Prominent but glassmorphic */}
                    <button
                        onClick={handleShare}
                        className="relative overflow-hidden group bg-white/10 hover:bg-white/20 border-2 border-white/20 rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(255,255,255,0.15)] shadow-lg animate-fade-in-up"
                    >
                        <div className="flex flex-col items-center gap-3 relative z-10">
                            <div className="p-4 bg-blue-500/20 rounded-full text-blue-400 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300 animate-bounce-soft">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <span className="font-serif text-white/90 font-bold text-lg tracking-wide">Invitar Amigos</span>
                        </div>
                    </button>

                    {/* Donate Button - Prominent White & Garnet */}
                    <button
                        onClick={() => setShowDonationInfo(true)}
                        className="relative overflow-hidden group bg-gradient-to-br from-white to-gray-100 hover:from-gray-50 hover:to-gray-200 border-2 border-white rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(255,255,255,0.4)] shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-fade-in-up"
                    >
                        <div className="absolute inset-0 bg-[#722F37]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="flex flex-col items-center gap-3 relative z-10">
                            <div className="p-4 bg-[#722F37]/10 rounded-full text-[#722F37] group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 animate-bounce-soft shadow-[0_0_15px_rgba(114,47,55,0.2)]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </div>
                            <span className="font-serif text-[#722F37] font-black text-xl tracking-wide uppercase drop-shadow-sm">Hacer Donación</span>
                        </div>
                    </button>
                </div>
            </div>

            {mounted && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
        </>
    );
}
