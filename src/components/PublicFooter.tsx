import React from 'react';
import { ShieldCheck, FileText } from 'lucide-react';

export type PublicLegalPage = 'privacidad' | 'terminos';

interface PublicFooterProps {
  onNavigateLegal: (page: PublicLegalPage) => void;
  compact?: boolean;
  className?: string;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({
  onNavigateLegal,
  compact = false,
  className = '',
}) => {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, page: PublicLegalPage) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigateLegal(page);
    }
  };

  if (compact) {
    return (
      <footer className={`pt-3 mt-3 border-t border-slate-200/80 text-center space-y-1.5 ${className}`}>
        <p className="text-[11px] font-semibold text-slate-500">
          RutaNómina - Transporte de Viajeros
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
          <a
            href="/?page=privacidad"
            onClick={(e) => handleLinkClick(e, 'privacidad')}
            className="text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center gap-1"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Política de Privacidad</span>
          </a>
          <span className="text-slate-300">·</span>
          <a
            href="/?page=terminos"
            onClick={(e) => handleLinkClick(e, 'terminos')}
            className="text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            <span>Condiciones del Servicio</span>
          </a>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`bg-white border-t border-slate-200 mt-8 pb-24 ${className}`}>
      <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="text-center sm:text-left">
          <span className="font-bold text-slate-800">RutaNómina - Transporte de Viajeros</span>
          <span className="hidden sm:inline text-slate-300 mx-2">·</span>
          <span className="block sm:inline text-[11px] text-slate-500">
            Gestión de rutas, jornadas y nóminas de conductores de transporte de viajeros.
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <a
            href="/?page=privacidad"
            onClick={(e) => handleLinkClick(e, 'privacidad')}
            className="text-slate-600 hover:text-blue-700 font-semibold hover:underline inline-flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Política de Privacidad</span>
          </a>
          <span className="text-slate-300">|</span>
          <a
            href="/?page=terminos"
            onClick={(e) => handleLinkClick(e, 'terminos')}
            className="text-slate-600 hover:text-blue-700 font-semibold hover:underline inline-flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Condiciones del Servicio</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
