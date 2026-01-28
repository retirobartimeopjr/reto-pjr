
import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MusicControl() {
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const audio = document.getElementById('bg-music') as HTMLAudioElement;

        const updateState = () => {
            if (audio) {
                setIsPlaying(!audio.paused);
            }
        };

        if (audio) {
            updateState();
            // Listen for external play events (e.g. auto-play script)
            audio.addEventListener('play', updateState);
            audio.addEventListener('pause', updateState);
        }

        return () => {
            if (audio) {
                audio.removeEventListener('play', updateState);
                audio.removeEventListener('pause', updateState);
            }
        };
    }, []);

    const toggleMusic = () => {
        const audio = document.getElementById('bg-music') as HTMLAudioElement;
        if (!audio) return;

        if (audio.paused) {
            audio.play().catch(e => console.error("Play failed", e));
        } else {
            audio.pause();
        }
    };

    return (
        <button
            onClick={toggleMusic}
            className="group relative flex items-center justify-center p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer z-50 overflow-hidden"
            aria-label={isPlaying ? "Silenciar música" : "Reproducir música"}
        >
            {/* Glow Effect */}
            <div className={`absolute inset-0 bg-[#f8b134]/30 blur-md transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0'}`} />

            <div className="relative z-10 text-white/90 group-hover:text-[#f8b134] transition-colors">
                {isPlaying ? (
                    <Volume2 size={24} strokeWidth={1.5} className="animate-pulse" />
                ) : (
                    <VolumeX size={24} strokeWidth={1.5} />
                )}
            </div>

            {/* Equalizer Animation (Tiny Bars) if playing */}
            {isPlaying && (
                <div className="absolute bottom-1 w-full flex justify-center gap-[2px] opacity-40">
                    <span className="w-[2px] h-[3px] bg-[#f8b134] animate-[bounce_1s_infinite] rounded-full" style={{ animationDelay: '0ms' }} />
                    <span className="w-[2px] h-[5px] bg-[#f8b134] animate-[bounce_1.2s_infinite] rounded-full" style={{ animationDelay: '100ms' }} />
                    <span className="w-[2px] h-[4px] bg-[#f8b134] animate-[bounce_0.8s_infinite] rounded-full" style={{ animationDelay: '200ms' }} />
                </div>
            )}
        </button>
    );
}
