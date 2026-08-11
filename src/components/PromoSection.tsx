import { useState, useEffect, useRef } from 'react';

export default function PromoSection() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Si el contenedor sale completamente de la pantalla
        if (!entry.isIntersecting && isOpen) {
          setIsOpen(false); // Lo cerramos automáticamente
          
          // Desplazar suavemente al ranking para evitar el salto brusco en celular
          setTimeout(() => {
            const leaderboard = document.getElementById('leaderboard');
            if (leaderboard) {
              leaderboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 50); // Pequeño retraso para permitir que React aplique el cambio de altura primero
        }
      },
      { threshold: 0 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isOpen]);

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 animate-fade-in-up px-4 md:px-0 font-sans" ref={containerRef}>
      {/* Trigger Button - Sober & Clear */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full relative group overflow-hidden rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-brand/50 transition-all duration-300 shadow-lg"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

        <div className="relative z-10 flex flex-col items-center justify-center py-6 px-4 text-center">
          <h2 className="text-xl md:text-3xl font-serif font-bold text-brand tracking-widest uppercase mb-2">
            {isOpen ? 'Ocultar Instrucciones' : '¿Cómo participar y ganar?'}
          </h2>
          <div className="flex items-center gap-2 text-white/80 text-sm md:text-base font-light tracking-wide">
            <span>{isOpen ? 'Click para cerrar' : 'Toca aquí para ver la dinámica y premios'}</span>
            <span className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
          </div>
        </div>
      </button>

      {/* Expanded Content - Instructions Focus */}
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[5000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
          }`}
      >
        <div className="relative p-6 md:p-8 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl">

          <div className="space-y-8">

            {/* Context */}
            <div className="text-center border-b border-white/10 pb-6">
              <p className="text-lg md:text-xl text-white/90 leading-relaxed font-light">
                Esta es una iniciativa pastoral <span className="text-brand font-medium">que busca recolectar fondos</span> para el V Retiro de nuestros jovenes Bartimeo.
              </p>

              <div className="mt-6 flex justify-center">
                <img
                  src="/acutis.png"
                  alt="Carlo Acutis"
                  className="w-full max-w-[200px] h-auto object-contain drop-shadow-lg opacity-90 rounded-lg"
                />
              </div>
            </div>

            {/* Steps / Instructions Group */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Step 1 */}
              <div className="bg-gradient-to-b from-white/10 to-white/5 p-6 rounded-2xl border border-white/10 flex flex-col gap-3 shadow-lg relative overflow-hidden group hover:border-[#f8b134]/50 transition-all duration-300">
                <div className="absolute -right-2 -top-2 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">🤝</div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl bg-white/10 w-12 h-12 flex items-center justify-center rounded-full shadow-inner z-10">🤝</span>
                  <h3 className="text-xl md:text-2xl font-black text-brand uppercase tracking-widest z-10">Paso 1: Invita</h3>
                </div>
                <p className="text-base md:text-lg text-white/90 leading-snug font-medium relative z-10">
                  Invita a otros y diles que anoten tu número de teléfono cuando se registren.
                </p>
                <div className="relative z-10 mt-auto pt-2">
                  <span className="text-[#fbd07e] font-black block text-lg bg-black/30 p-2 rounded-lg text-center border border-brand/30 shadow-inner tracking-wide">
                    + 150 Puntos por referido
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-gradient-to-b from-white/10 to-white/5 p-6 rounded-2xl border border-white/10 flex flex-col gap-3 shadow-lg relative overflow-hidden group hover:border-[#f8b134]/50 transition-all duration-300">
                <div className="absolute -right-2 -top-2 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">📍</div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl bg-white/10 w-12 h-12 flex items-center justify-center rounded-full shadow-inner z-10">📍</span>
                  <h3 className="text-xl md:text-2xl font-black text-brand uppercase tracking-widest z-10">Paso 2: Peregrina</h3>
                </div>
                <p className="text-base md:text-lg text-white/90 leading-snug font-medium relative z-10">
                  Ve a las Parroquias o Santuarios participantes y confirma tu visita allí.
                </p>
                <div className="relative z-10 mt-auto pt-2">
                  <span className="text-[#fbd07e] font-black block text-lg bg-black/30 p-2 rounded-lg text-center border border-brand/30 shadow-inner tracking-wide">
                    + 200, 500, 800 pts
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-gradient-to-b from-white/10 to-white/5 p-6 rounded-2xl border border-white/10 flex flex-col gap-3 shadow-lg relative overflow-hidden group hover:border-[#f8b134]/50 transition-all duration-300">
                <div className="absolute -right-2 -top-2 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">🧠</div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl bg-white/10 w-12 h-12 flex items-center justify-center rounded-full shadow-inner z-10">🧠</span>
                  <h3 className="text-xl md:text-2xl font-black text-brand uppercase tracking-widest z-10">Paso 3: Responde</h3>
                </div>
                <p className="text-base md:text-lg text-white/90 leading-snug font-medium relative z-10">
                  Contesta las Bartipreguntas sobre nuestra fe.
                </p>
                <div className="relative z-10 mt-auto pt-2">
                  <span className="text-[#fbd07e] font-black block text-lg bg-black/30 p-2 rounded-lg text-center border border-brand/30 shadow-inner tracking-wide">
                    + 20 Puntos por acierto
                  </span>
                </div>
              </div>

            </div>

            {/* Prizes Section - Clean & Direct */}
            <div className="bg-gradient-to-br from-black/80 to-brand/20 p-6 md:p-8 rounded-2xl border-2 border-brand/50 shadow-[0_0_30px_rgba(248,177,52,0.15)] flex flex-col gap-6 mt-10">
              
              <h3 className="text-3xl md:text-4xl font-serif font-black text-brand mb-2 text-center drop-shadow-md tracking-wide">
                LOS PREMIOS
              </h3>
              
              <div className="space-y-4">
                {/* 1st Prize */}
                <div className="bg-white/5 p-5 rounded-xl border border-white/10 flex flex-row items-center gap-4 justify-between relative overflow-hidden group">
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-brand/20 to-transparent pointer-events-none"></div>
                  <div className="flex flex-col gap-1 z-10 w-2/3">
                    <span className="text-white/70 font-semibold tracking-wider text-sm uppercase">1er Lugar (Gran Premio)</span>
                    <span className="font-black text-4xl text-[#fbd07e] drop-shadow-lg tracking-tighter">$2.000.000 COP</span>
                    <span className="text-white/80 font-light text-sm mt-1">Para el peregrino con más puntos acumulados al final.</span>
                  </div>
                  <div className="z-10 w-1/3 flex justify-end">
                    <img src="/dospalos.png" alt="2 Millones" className="w-24 md:w-32 h-auto object-contain drop-shadow-[0_0_15px_rgba(248,177,52,0.4)] group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>

                {/* 2nd Prize */}
                <div className="bg-white/5 p-5 rounded-xl border border-white/10 flex flex-row items-center gap-4 justify-between relative overflow-hidden group">
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
                  <div className="flex flex-col gap-1 z-10 w-2/3">
                    <span className="text-white/70 font-semibold tracking-wider text-sm uppercase">2do Lugar</span>
                    <span className="font-black text-3xl text-white/90 drop-shadow-md tracking-tighter">$1.000.000 COP</span>
                    <span className="text-white/80 font-light text-sm mt-1">Para el segundo peregrino con más puntos.</span>
                  </div>
                  <div className="z-10 w-1/3 flex justify-end">
                    <img src="/unpalo.png" alt="1 Millón" className="w-24 md:w-32 h-auto object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>

                {/* Raffle */}
                <div className="bg-brand/10 p-5 rounded-xl border border-brand/30 flex flex-row items-center gap-4 justify-between relative overflow-hidden group">
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-brand/20 to-transparent pointer-events-none"></div>
                  <div className="flex flex-col gap-1 z-10 w-2/3">
                    <span className="text-brand font-semibold tracking-wider text-sm uppercase">Gran Sorteo Final (Rifa)</span>
                    <span className="font-black text-3xl text-[#fbd07e] drop-shadow-md tracking-tighter">$500.000 COP</span>
                    <span className="text-white/80 font-light text-sm mt-1">Sorteo entre participantes el día final del Reto.</span>
                  </div>
                  <div className="z-10 w-1/3 flex justify-end">
                    <img src="/mediopalo.png" alt="500 Mil" className="w-24 md:w-32 h-auto object-contain drop-shadow-[0_0_15px_rgba(248,177,52,0.3)] group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-xl md:text-2xl font-serif italic text-white/60">
                ¡Gracias por hacer posible esta experiencia!
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
