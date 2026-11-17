import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (isIOS ? setShowIOSGuide(true) : void install())}
        title="Instalar RutaNómina en tu móvil o dispositivo"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Icono de RutaNómina"
                  className="w-12 h-12 rounded-xl border border-slate-200 shadow-xs object-cover shrink-0"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Instalar RutaNómina en iPhone / iPad
                  </h3>
                  <p className="text-xs text-slate-500">
                    Añade el icono a tu pantalla de inicio
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                aria-label="Cerrar instrucciones"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-700 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                  1
                </span>
                <span className="flex items-center gap-1 flex-wrap">
                  Pulsa el botón <strong>Compartir</strong>{' '}
                  <Share className="w-3.5 h-3.5 text-blue-600 inline" /> en la barra de Safari.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                  2
                </span>
                <span className="flex items-center gap-1 flex-wrap">
                  Desliza y toca <strong>Añadir a pantalla de inicio</strong>{' '}
                  <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" />.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                  3
                </span>
                <span>
                  Pulsa <strong>Añadir</strong> para guardar el acceso directo con su icono.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
