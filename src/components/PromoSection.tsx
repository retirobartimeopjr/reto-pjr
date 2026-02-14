import { useState } from 'react';

export default function PromoSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 animate-fade-in-up px-4 md:px-0 font-sans">
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
        className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
          }`}
      >
        <div className="relative p-6 md:p-8 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl">

          <div className="space-y-8">

            {/* Context */}
            <div className="text-center border-b border-white/10 pb-6">
              <p className="text-lg md:text-xl text-white/90 leading-relaxed font-light">
                Esta es una iniciativa para llevar <span className="text-brand font-medium">tecnología a la comunidad</span> y recaudar fondos para nuestro IV Retiro.
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Step 1 */}
              <div className="bg-white/5 p-5 rounded-lg border border-white/5 flex flex-col gap-3">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl">📍</span>
                  <h3 className="text-lg md:text-xl font-bold text-brand uppercase tracking-wider">Paso 1: Visita</h3>
                </div>
                <p className="text-base md:text-lg text-white/80 leading-snug">
                  Ve a las Parroquias participantes y confirma tu visita.
                  <br />
                  <span className="text-brand/90 font-bold block mt-2">+ 100 Puntos por templo</span>
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white/5 p-5 rounded-lg border border-white/5 flex flex-col gap-3">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl">🧠</span>
                  <h3 className="text-lg md:text-xl font-bold text-brand uppercase tracking-wider">Paso 2: Responde</h3>
                </div>
                <p className="text-base md:text-lg text-white/80 leading-snug">
                  Contesta las BartiPreguntas sobre nuestra fe.
                  <br />
                  <span className="text-brand/90 font-bold block mt-2">+ 50 Puntos por acierto</span>
                </p>
              </div>
            </div>

            {/* Prizes Section - Clean & Direct */}
            <div className="bg-gradient-to-r from-brand/10 to-transparent p-6 rounded-lg border-l-4 border-brand">
              <h3 className="text-xl md:text-2xl font-serif font-bold text-white mb-3">
                Los Premios
              </h3>
              <ul className="space-y-3 text-lg md:text-xl text-white/90 font-light list-disc list-inside marker:text-brand">
                <li>
                  <span className="font-medium text-white">Gran Premio:</span> Para el peregrino con más puntos acumulados.
                </li>
                <li>
                  <span className="font-medium text-white">Segundo Premio:</span> Sorteo entre todos los participantes (si no ganaste por puntos).
                </li>
              </ul>
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
