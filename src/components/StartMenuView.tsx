import React from 'react';
import {
  UserCog,
  CalendarDays,
  CalendarRange,
  ArrowRight,
  CreditCard,
  Database,
  SlidersHorizontal,
  ShieldAlert,
  Cloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { WorkerProfile, ConvenioYearRate } from '../types';
import { AnnualLiquidationResult, formatEuro, formatHoras } from '../utils/annualCalendar';

interface StartMenuViewProps {
  profile: WorkerProfile;
  selectedYear: number;
  selectedMonthName: string;
  yearRate: ConvenioYearRate;
  annualSummary: AnnualLiquidationResult;
  assignedDaysCount: number;
  user: FirebaseUser | null;
  isSyncing: boolean;
  onOpenProfileModal: () => void;
  onOpenConvenioModal: () => void;
  onSelectTab: (tab: string) => void;
  onOpenLogin: () => void;
  onManualSync: () => void;
}

export const StartMenuView: React.FC<StartMenuViewProps> = ({
  profile,
  selectedYear,
  selectedMonthName,
  yearRate,
  annualSummary,
  assignedDaysCount,
  user,
  isSyncing,
  onOpenProfileModal,
  onOpenConvenioModal,
  onSelectTab,
  onOpenLogin,
  onManualSync,
}) => {
  const isProfileConfigured = Boolean(profile.name?.trim());
  const jornadaPct =
    profile.contractType === 'tiempo_parcial'
      ? profile.partTimePercentage ?? 50
      : 100;
  const extrasLabel =
    profile.prorrateoPagasExtra === 'ninguna'
      ? '3 pagas íntegras'
      : profile.prorrateoPagasExtra === 'una_paga'
      ? 'Marzo prorr. + 2 íntegras'
      : '3 pagas prorrateadas';

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-28 space-y-6">
      {/* Cabecera de bienvenida y estado del usuario */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
              <span>Menú Principal</span>
              <span className="text-blue-300">·</span>
              <span>Convenio {selectedYear}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {isProfileConfigured
                ? `Hola, ${profile.name.trim().split(' ')[0]}`
                : 'Bienvenido a RutaNómina'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Elige qué apartado deseas abrir. Todos tus datos personales, turnos y calendario anual se sincronizan automáticamente con tu carpeta privada en Google Drive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSyncing ? 'Sincronizando Drive...' : 'Drive conectado · Sincronizar'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                <span>Conectar Google Drive</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumen rápido de parámetros compartidos */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/70">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trabajador / Empresa
            </span>
            <span className="font-bold text-slate-800 truncate block mt-0.5">
              {isProfileConfigured ? profile.name.trim() : 'Pendiente de configurar'}
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/70">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Jornada y Horas Base
            </span>
            <span className="font-bold text-slate-800 block mt-0.5">
              {jornadaPct}% · {annualSummary.jornadaAnualEfectiva.toLocaleString('es-ES')} h/año
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/70">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pagas Extras
            </span>
            <span className="font-bold text-slate-800 block mt-0.5">{extrasLabel}</span>
          </div>

          <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/70">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Salario Base Convenio
            </span>
            <span className="font-bold text-slate-800 block mt-0.5">
              {yearRate.salarioBaseDia.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              €/día · IRPF {(profile.irpfPercentage || 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </section>

      {/* Las 3 Opciones Principales del Menú */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Opción 1: Datos personales y particularidades del empleado */}
        <article
          className={`flex flex-col justify-between rounded-2xl border p-5 sm:p-6 bg-white shadow-xs transition-all hover:shadow-md ${
            !isProfileConfigured ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-200'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                Opción 1
              </span>
              {isProfileConfigured ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Configurado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                  <AlertCircle className="w-4 h-4" /> Recomendado primero
                </span>
              )}
            </div>

            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <UserCog className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                Datos personales y particularidades
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Configura tu nombre, NIF, empresa, localidad para festivos, % de jornada, pagas extras (prorrateo o 2 íntegras + 1 prorr.), IRPF y ciclo de corte. Se guarda en tu Drive y nutre toda la app.
              </p>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <span>{isProfileConfigured ? 'Editar datos del empleado' : 'Rellenar ficha inicial'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenConvenioModal}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Tablas Convenio {selectedYear}</span>
            </button>
          </div>
        </article>

        {/* Opción 2: Introducción de los turnos */}
        <article className="flex flex-col justify-between rounded-2xl border border-slate-200 p-5 sm:p-6 bg-white shadow-xs transition-all hover:shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                Opción 2
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {assignedDaysCount} días con registro en {selectedYear}
              </span>
            </div>

            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                Introducción de los turnos
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Uso diario para anotar el turno realizado cada día en el cuadrante, descansos, vacaciones (V), bajas (B), excesos horarios y extras fuera de convenio.
              </p>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 space-y-2.5">
            <button
              type="button"
              onClick={() => onSelectTab('calendario')}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <span>Abrir cuadrante ({selectedMonthName})</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onSelectTab('nomina')}
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Nómina</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('turnos')}
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-slate-600" />
                <span>Turnos BD</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('extras')}
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                <span>Extras</span>
              </button>
            </div>
          </div>
        </article>

        {/* Opción 3: Calendario anual y bolsa de horas */}
        <article className="flex flex-col justify-between rounded-2xl border border-cyan-200 p-5 sm:p-6 bg-white shadow-xs transition-all hover:shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-lg">
                Opción 3
              </span>
              <span className="text-[11px] font-bold text-cyan-700">
                Sincronizado con tu Perfil
              </span>
            </div>

            <div className="w-11 h-11 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-xs">
              <CalendarRange className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                Calendario anual y Bolsa de horas
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Cuadro numérico anual editable con cálculo de liquidación, saldo mensual y acumulado de bolsa de horas, bajas IT por tramos, vacaciones (31 días) y exportación Excel.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 font-semibold block">Bruto Fijo / Vac.</span>
                <span className="font-extrabold text-slate-900">
                  {formatEuro(annualSummary.brutoFijoAnual)} · {annualSummary.totalVacNat}/{annualSummary.p.vacReglamentarias}d
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">
                  {annualSummary.mesesConTurnosCount > 0 ? 'Real Diario / Comp.' : 'Bolsa Teórica'}
                </span>
                <span className="font-extrabold text-slate-900">
                  {annualSummary.mesesConTurnosCount > 0
                    ? `${formatHoras(annualSummary.sumaHorasRealizadas)} (${formatHoras(annualSummary.bolsaCompensacionFinal, true)})`
                    : formatHoras(annualSummary.bolsaAcumuladaFinal, true)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectTab('anual')}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <span>Abrir calendario anual {selectedYear}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </article>
      </div>
    </div>
  );
};
