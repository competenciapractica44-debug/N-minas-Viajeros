import React from 'react';
import { FileText, Table, Calendar, ShieldAlert, User as UserIcon, Download } from 'lucide-react';
import { ConvenioInfo, WorkerProfile, PayrollBreakdown } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { DriveSyncBadge } from './DriveSyncBadge';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  selectedMonth: number;
  selectedYear: number;
  onChangeMonth: (year: number, month: number) => void;
  convenio: ConvenioInfo;
  profile: WorkerProfile;
  payroll: PayrollBreakdown;
  onOpenConvenioModal: () => void;
  onOpenProfileModal: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  user: FirebaseUser | null;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  onManualSync: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  selectedMonth,
  selectedYear,
  onChangeMonth,
  convenio,
  profile,
  payroll,
  onOpenConvenioModal,
  onOpenProfileModal,
  onExportPDF,
  onExportExcel,
  user,
  isSyncing,
  lastSyncTime,
  onManualSync,
  onOpenLogin,
  onLogout,
}) => {
  const isExpiringSoon = selectedYear >= 2026;

  // Dynamic available years starting strictly at 2026 (excluding 2024 and 2025)
  const availableYears = React.useMemo(() => {
    const yearsSet = new Set<number>([2026, 2027]);
    if (convenio?.ratesByYear) {
      Object.keys(convenio.ratesByYear).forEach((y) => {
        const yNum = Number(y);
        if (yNum >= 2026) yearsSet.add(yNum);
      });
    }
    if (selectedYear >= 2026) yearsSet.add(selectedYear);
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [convenio, selectedYear]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-lg tracking-wider">
            RN
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                RutaNómina
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">·</span>
              <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
                {profile.companyName || 'Direxis Zaragoza'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5 capitalize">
              {currentTab === 'nomina' && 'Cálculo y Liquidación'}
              {currentTab === 'calendario' && 'Cuadrante y Partes de Trabajo'}
              {currentTab === 'turnos' && 'Base de Datos de Turnos'}
              {currentTab === 'extras' && 'Pluses Fuera de Convenio'}
            </p>
          </div>
        </div>

        {/* Center / Month Selector */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                onChangeMonth(y, m);
              }}
              className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs sm:text-sm font-semibold pl-3 pr-8 py-1.5 rounded-lg border border-slate-200/80 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {availableYears.map((y) =>
                MONTH_NAMES.map((name, idx) => (
                  <option key={`${y}-${idx + 1}`} value={`${y}-${idx + 1}`}>
                    {name} {y}
                  </option>
                ))
              )}
            </select>
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Convenio Renewal Badge / Trigger */}
          <button
            onClick={onOpenConvenioModal}
            title="Ver o actualizar tablas del Convenio Colectivo"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
              isExpiringSoon
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : 'bg-blue-50 text-blue-700 border-blue-200/70 hover:bg-blue-100'
            }`}
          >
            <ShieldAlert className={`w-3.5 h-3.5 shrink-0 ${isExpiringSoon ? 'text-amber-600' : 'text-blue-600'}`} />
            <span>Convenio {selectedYear}</span>
            {isExpiringSoon && <span className="text-[10px] font-semibold text-amber-600">(Vence)</span>}
          </button>
        </div>

        {/* Action Controls & Profile */}
        <div className="flex items-center gap-2">
          {/* Google Drive Status & User Badge */}
          <DriveSyncBadge
            user={user}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            onManualSync={onManualSync}
            onOpenLogin={onOpenLogin}
            onLogout={onLogout}
          />

          <button
            onClick={onExportPDF}
            title="Exportar nómina y partes a PDF oficial"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            onClick={onExportExcel}
            title="Exportar reporte detallado en Excel (.xlsx)"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            <Table className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={onOpenProfileModal}
            className="flex items-center gap-2 p-1 pl-2 sm:pl-2.5 bg-slate-100 hover:bg-slate-200/70 rounded-full border border-slate-200 transition-colors"
            title="Configuración de trabajador y empresa"
          >
            <span className="text-xs font-medium text-slate-700 max-w-[80px] sm:max-w-[100px] truncate hidden sm:inline">
              {profile.name.split(' ')[0]}
            </span>
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'C'}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
