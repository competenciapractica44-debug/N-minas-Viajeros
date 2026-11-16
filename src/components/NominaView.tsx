import React, { useState } from 'react';
import {
  FileText,
  Table as TableIcon,
  Percent,
  AlertCircle,
  Clock,
  Coins,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Scale,
  Eye,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRightLeft,
  X,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import {
  PayrollBreakdown,
  WorkerProfile,
  ConvenioInfo,
  MonthlySalaryEvolution,
} from '../types';
import { REAL_OCTOBER_PAYSLIP } from '../data/realOctoberPayslip';
import { getEffectiveYearRate } from '../data/convenioZaragoza';
import { formatCurrency } from '../utils/exporter';
import { YearlySalaryChart } from './YearlySalaryChart';

interface NominaViewProps {
  payroll: PayrollBreakdown;
  profile: WorkerProfile;
  convenio: ConvenioInfo;
  monthName: string;
  selectedYear: number;
  selectedMonth: number;
  yearlyEvolution: MonthlySalaryEvolution[];
  onSelectMonth?: (month: number) => void;
  onUpdateProfile: (partial: Partial<WorkerProfile>) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onSyncRealPayslip?: () => void;
  isDriveConnected?: boolean;
  onOpenDriveNominasModal?: () => void;
  lastCalculatedAt?: Date;
  isRecalculating?: boolean;
  onRecalculate?: () => void;
}

export const NominaView: React.FC<NominaViewProps> = ({
  payroll,
  profile,
  convenio,
  monthName,
  selectedYear,
  selectedMonth,
  yearlyEvolution,
  onSelectMonth,
  onUpdateProfile,
  onExportPDF,
  onExportExcel,
  onSyncRealPayslip,
  isDriveConnected,
  onOpenDriveNominasModal,
  lastCalculatedAt,
  isRecalculating,
  onRecalculate,
}) => {
  const [showExtrasDetails, setShowExtrasDetails] = useState(false);
  const [showRealPayslipModal, setShowRealPayslipModal] = useState(false);
  const [comparisonTab, setComparisonTab] = useState<'tabla_oficial' | 'cotejo_real'>('tabla_oficial');

  const isOctober2026 = selectedYear === 2026 && selectedMonth === 10;
  const isPartTime = profile.contractType === 'tiempo_parcial';
  const currentJornadaPercentage = isPartTime
    ? (profile.partTimePercentage !== undefined && profile.partTimePercentage > 0
        ? profile.partTimePercentage
        : 50)
    : 100;

  const isMasatsBaseMode = profile.salaryBaseRateMode === 'masats_39_89';
  const activeYearRate = getEffectiveYearRate(convenio, payroll.year);
  const convenioBaseDia = parseFloat((activeYearRate.salarioBaseDia * payroll.partTimeFactor).toFixed(2));
  const masatsBaseDia = parseFloat((activeYearRate.salarioBaseDiaMasats ?? 39.89).toFixed(2));
  const convenioBaseTotal = parseFloat((payroll.salarioBaseDays * convenioBaseDia).toFixed(2));
  const masatsBaseTotal = parseFloat((payroll.salarioBaseDays * masatsBaseDia).toFixed(2));
  const reducedConductorUnitRate =
    activeYearRate.plusConductorPerceptorDiaReducido ??
    parseFloat(((activeYearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
  const prorrateoMode = profile.prorrateoPagasExtra || (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna');
  const prorrataNumPagas = prorrateoMode === 'una_paga' ? 1 : 3;
  const prorrataPerPaga = prorrataNumPagas > 0 ? parseFloat((payroll.prorrataPagasExtra / prorrataNumPagas).toFixed(2)) : 0;
  const baseIrpf = Math.max(0, payroll.totalDevengado - payroll.dietasExentas);

  const formatHoursES = (h: number) =>
    new Intl.NumberFormat('es-ES', { minimumFractionDigits: h % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(h);
  const annualLoggedHours = parseFloat(
    yearlyEvolution
      .filter((m) => !m.isProjected)
      .reduce((acc, m) => acc + (m.ordinaryConvenioHours ?? m.totalHours), 0)
      .toFixed(2)
  );
  const periodHoursDiff = parseFloat((payroll.ordinaryConvenioHours - payroll.convenioMonthlyHoursTarget).toFixed(2));
  const annualHoursProgressPct =
    payroll.convenioAnnualHoursTarget > 0
      ? Math.min(100, Math.round((annualLoggedHours / payroll.convenioAnnualHoursTarget) * 100))
      : 0;

  const handleJornadaChange = (newPercentage: number) => {
    if (newPercentage >= 100) {
      onUpdateProfile({
        contractType: profile.contractType === 'temporal' ? 'temporal' : 'indefinido',
        partTimePercentage: 100,
      });
    } else {
      onUpdateProfile({
        contractType: 'tiempo_parcial',
        partTimePercentage: newPercentage,
      });
    }
  };

  // Helper comparison calculations for October
  const realOctoberDevengos = REAL_OCTOBER_PAYSLIP.devengos;
  const appDevengosMap = new Map<string, { cuantia: number; precio: number; devengos: number }>();
  payroll.lines.forEach((line) => {
    appDevengosMap.set(line.name.trim().toLowerCase(), {
      cuantia: line.quantity,
      precio: line.unitPrice,
      devengos: line.amount,
    });
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* Hero Card: Líquido Total a Percibir (Net Pay) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Líquido Total a Percibir (Neto)
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
              {formatCurrency(payroll.liquidoPercibir)}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <p className="text-xs text-slate-300">
                Período: <strong>{monthName} {payroll.year}</strong> · {payroll.workedDays} jornadas · {payroll.totalDays} días naturales
              </p>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isMasatsBaseMode
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                    : 'bg-blue-400/20 text-blue-300 border-blue-400/30'
                }`}
              >
                Base {isMasatsBaseMode ? `${formatCurrency(masatsBaseDia)}/día (Recibo Masats)` : `${formatCurrency(convenioBaseDia)}/día (Convenio ${payroll.year})`}
              </span>
              {profile.contractType === 'tiempo_parcial' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Jornada Parcial {profile.partTimePercentage || 50}%
                </span>
              )}
            </div>
          </div>

          {/* Quick Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenDriveNominasModal && (
              <button
                onClick={onOpenDriveNominasModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl border border-white/20 shadow-xs transition-colors cursor-pointer"
                title="Archivar o ver nóminas en tu carpeta de Google Drive (Direxis / Nóminas)"
              >
                <Cloud className="w-4 h-4 text-sky-300" />
                <span>Drive Nóminas</span>
              </button>
            )}
            <button
              onClick={onExportPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={onExportExcel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/15 transition-colors"
            >
              <TableIcon className="w-4 h-4 text-emerald-400" />
              <span>Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Mini KPI row inside hero card */}
        <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 text-[11px] block">Total Bruto Devengado</span>
            <span className="font-bold text-white font-mono text-sm">{formatCurrency(payroll.totalDevengado)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Total Deducciones</span>
            <span className="font-bold text-rose-300 font-mono text-sm">-{formatCurrency(payroll.totalDeducido)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Base Cotización S.S.</span>
            <span className="font-bold text-slate-200 font-mono text-sm">{formatCurrency(payroll.baseCotizacionSS)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Horas Nocturnas (22-06h)</span>
            <span className="font-bold text-amber-300 font-mono text-sm">{payroll.nightHours} horas</span>
          </div>
        </div>

        {/* Convenio Art. 14 Target Hours Strip */}
        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-white/5 rounded-2xl p-3">
          <div>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold block">
              Horas Convenio a Cumplir ({Math.round(payroll.partTimeFactor * 100)}%)
            </span>
            <span className="font-bold text-sky-300 font-mono text-sm">
              {formatHoursES(payroll.convenioAnnualHoursTarget)} h/año
            </span>
            <span className="text-[11px] text-slate-300 block">
              Ref. mensual: <strong className="font-mono text-white">{formatHoursES(payroll.convenioMonthlyHoursTarget)} h/mes</strong>
              {payroll.partTimeFactor < 1 && ` (${Math.round(payroll.partTimeFactor * 100)}% de ${formatHoursES(payroll.convenioAnnualHoursBase)} h)`}
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold block">
              Horas Ordinarias en Convenio
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white font-mono text-sm">
                {formatHoursES(payroll.ordinaryConvenioHours)} h
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  periodHoursDiff >= 0
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : 'bg-amber-400/20 text-amber-300'
                }`}
              >
                {periodHoursDiff >= 0 ? `+${formatHoursES(periodHoursDiff)} h compl.` : `${formatHoursES(periodHoursDiff)} h`}
              </span>
            </div>
            <span className="text-[11px] text-slate-300 block">
              {payroll.horasFestivas > 0
                ? `Ref. ${formatHoursES(payroll.convenioMonthlyHoursTarget)} h/mes · ${formatHoursES(payroll.horasFestivas)} h festivas excluidas (Total: ${formatHoursES(payroll.totalWorkedHours)} h)`
                : `Respecto a ref. de ${formatHoursES(payroll.convenioMonthlyHoursTarget)} h/mes`}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
              <span>Acumulado Anual {selectedYear}</span>
              <span className="font-mono text-sky-300">{annualHoursProgressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all"
                style={{ width: `${annualHoursProgressPct}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-200 font-mono block">
              <strong>{formatHoursES(annualLoggedHours)} h</strong> / {formatHoursES(payroll.convenioAnnualHoursTarget)} h
            </span>
          </div>
        </div>

        {/* Live recalculation & no-auto-save confirmation strip */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-slate-300">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isRecalculating ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
            <span>
              {isRecalculating
                ? 'Sincronizando y recalculando nómina con los datos del calendario...'
                : `Calculada en vivo desde el calendario (${
                    lastCalculatedAt
                      ? lastCalculatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : 'ahora'
                  }) · No se guarda hasta que elijas archivarla o descargarla`}
            </span>
          </div>
          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              disabled={isRecalculating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/15 transition-colors self-start sm:self-auto shrink-0 disabled:opacity-60 cursor-pointer"
              title="Volver a calcular ahora con los últimos datos del calendario"
            >
              <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>Recalcular</span>
            </button>
          )}
        </div>
      </div>

      {/* Switcher Banner: Vista Oficial con Nº de Veces (Cuantía) vs Cotejo con Nómina Real */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setComparisonTab('tabla_oficial')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              comparisonTab === 'tabla_oficial'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Recibo Oficial (Cuantía y Precio)</span>
          </button>
          <button
            type="button"
            onClick={() => setComparisonTab('cotejo_real')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              comparisonTab === 'cotejo_real'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Scale className="w-4 h-4 text-emerald-300" />
            <span>Cotejo con Nómina Escaneada {isOctober2026 ? '(Octubre)' : ''}</span>
          </button>
        </div>

        {/* Salario Base Selector & Real Image Trigger */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowRealPayslipModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-colors"
            title="Ver foto de la nómina real de octubre"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Ver Foto Nómina</span>
            <span className="sm:hidden">Foto</span>
          </button>

          {isOctober2026 && onSyncRealPayslip && (
            <button
              type="button"
              onClick={onSyncRealPayslip}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-colors"
              title="Cargar los 12 conceptos y cuantías exactas de la nómina real de octubre"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cargar Nómina Exacta</span>
            </button>
          )}
        </div>
      </div>

      {/* Salario Base Mode Selector Pill (Convenio 53.18 vs Masats 39.89) */}
      <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 leading-tight">
              Cálculo del Salario Base en Bruto: {payroll.salarioBaseDays} días en {monthName}
            </h4>
            <p className="text-[11px] text-slate-600">
              {isMasatsBaseMode
                ? `Modalidad recibo Masats (tarifa fija): ${payroll.salarioBaseDays} días × ${formatCurrency(masatsBaseDia)}/día = ${formatCurrency(masatsBaseTotal)} (bruto antes de impuestos).`
                : `Tablas del Convenio ${payroll.year}${payroll.partTimeFactor < 1 ? ` al ${Math.round(payroll.partTimeFactor * 100)}% (${formatCurrency(activeYearRate.salarioBaseDia)} × ${Math.round(payroll.partTimeFactor * 100)}% = ${formatCurrency(convenioBaseDia)}/día)` : ''}: ${payroll.salarioBaseDays} días × ${formatCurrency(convenioBaseDia)}/día = ${formatCurrency(convenioBaseTotal)} (salario base bruto antes de impuestos).`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-blue-200/80 shadow-2xs shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onUpdateProfile({ salaryBaseRateMode: 'convenio_53_18' })}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !isMasatsBaseMode
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Convenio {formatCurrency(convenioBaseDia)} ({formatCurrency(convenioBaseTotal)})
          </button>
          <button
            type="button"
            onClick={() => onUpdateProfile({ salaryBaseRateMode: 'masats_39_89' })}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isMasatsBaseMode
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Recibo Masats {formatCurrency(masatsBaseDia)} ({formatCurrency(masatsBaseTotal)})
          </button>
        </div>
      </div>

      {/* Main View Mode 1: TABLA OFICIAL CON CUANTÍA Y PRECIO */}
      {comparisonTab === 'tabla_oficial' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header of the Official Payslip Table */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold font-mono uppercase">
                  Recibo Individual
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Desglose Oficial en Bruto (Cuantía y Precios del Convenio)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Todos los conceptos se calculan primero en bruto (antes de impuestos) según las cuantías subidas en el Convenio {payroll.year}.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Bruto</span>
              <span className="text-base font-extrabold font-mono text-emerald-700">
                {formatCurrency(payroll.totalDevengado)}
              </span>
            </div>
          </div>

          {/* Table with Cuantía, Precio, Concepto, Devengos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3 sm:px-4 text-center w-28 sm:w-32">
                    Cuantía (Nº Veces)
                  </th>
                  <th className="py-2.5 px-3 sm:px-4 text-right w-24 sm:w-28">
                    Precio Unitario
                  </th>
                  <th className="py-2.5 px-3 sm:px-4">
                    Concepto Retributivo
                  </th>
                  <th className="py-2.5 px-3 sm:px-4 text-right w-28 sm:w-32">
                    Devengos (€)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {payroll.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Cuantía (Nº de veces) */}
                    <td className="py-2.5 px-3 sm:px-4 text-center font-mono">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold text-xs border border-blue-200/60 shadow-2xs">
                        {line.quantityLabel}
                        <span className="ml-1 text-[10px] text-blue-600 font-normal">
                          {line.unit}
                        </span>
                      </span>
                    </td>

                    {/* Precio Unitario */}
                    <td className="py-2.5 px-3 sm:px-4 text-right font-mono text-slate-700 font-semibold">
                      {formatCurrency(line.unitPrice)}
                    </td>

                    {/* Concepto */}
                    <td className="py-2.5 px-3 sm:px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-mono text-[10px]">*</span>
                        <span className="font-semibold text-slate-900">
                          {line.name}
                        </span>
                        {line.isOfficial && (
                          <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium">
                            Oficial
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Devengos (€) */}
                    <td className="py-2.5 px-3 sm:px-4 text-right font-mono font-bold text-slate-900 group-hover:text-emerald-700">
                      {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs">
                  <td colSpan={3} className="py-3 px-4 text-right text-slate-700 uppercase tracking-wide">
                    Total Devengado (Total Bruto):
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-emerald-700">
                    {formatCurrency(payroll.totalDevengado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Main View Mode 2: COTEJO Y COMPARATIVA CON NÓMINA REAL ESCANEADA */}
      {comparisonTab === 'cotejo_real' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Cotejo Línea por Línea: Nómina Real Escaneada vs Nómina Calculada
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Comparativa directa entre el recibo de Octubre 2026 de Jorge Adolfo Garcia Miana y los cálculos de la aplicación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRealPayslipModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition-colors shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver imagen escaneada</span>
            </button>
          </div>

          {/* Side by side comparison table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200 uppercase tracking-wider">
                  <th className="p-3">Concepto</th>
                  <th className="p-3 text-center bg-slate-200/60">
                    Nómina Real (Foto)
                    <span className="block text-[10px] font-normal text-slate-500">Cuantía x Precio = Total</span>
                  </th>
                  <th className="p-3 text-center bg-blue-50/80">
                    Nómina Calculada (App)
                    <span className="block text-[10px] font-normal text-blue-600">Cuantía x Precio = Total</span>
                  </th>
                  <th className="p-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {realOctoberDevengos.map((realItem, idx) => {
                  const appMatch = appDevengosMap.get(realItem.concepto.trim().toLowerCase());
                  const appDevengo = appMatch ? appMatch.devengos : 0;
                  const diff = parseFloat((appDevengo - realItem.devengos).toFixed(2));
                  const isExact = Math.abs(diff) < 0.05;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-mono text-[10px]">*</span>
                          <span>{realItem.concepto}</span>
                        </div>
                      </td>

                      {/* Real Payslip Data */}
                      <td className="p-3 text-center bg-slate-50 font-mono text-slate-800">
                        <span className="font-bold text-slate-900">
                          {realItem.cuantia.toFixed(2).replace('.', ',')}
                        </span>{' '}
                        <span className="text-slate-500 text-[10px]">x {realItem.precio.toFixed(2)}€</span>
                        <span className="block font-extrabold text-slate-900">
                          = {formatCurrency(realItem.devengos)}
                        </span>
                      </td>

                      {/* App Calculated Data */}
                      <td className="p-3 text-center bg-blue-50/30 font-mono">
                        {appMatch ? (
                          <>
                            <span className="font-bold text-blue-900">
                              {appMatch.cuantia.toFixed(2).replace('.', ',')}
                            </span>{' '}
                            <span className="text-slate-500 text-[10px]">x {appMatch.precio.toFixed(2)}€</span>
                            <span className="block font-extrabold text-blue-800">
                              = {formatCurrency(appDevengo)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No computado en mes</span>
                        )}
                      </td>

                      {/* Diff Badge */}
                      <td className="p-3 text-right font-mono">
                        {isExact ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            0,00 €
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              diff > 0
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {/* Total Devengado Comparison */}
                <tr className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                  <td className="p-3 text-slate-800 uppercase">Total Bruto Devengado</td>
                  <td className="p-3 text-center font-mono text-sm text-slate-900">
                    {formatCurrency(REAL_OCTOBER_PAYSLIP.totales.totalDevengado)}
                  </td>
                  <td className="p-3 text-center font-mono text-sm text-blue-900">
                    {formatCurrency(payroll.totalDevengado)}
                  </td>
                  <td className="p-3 text-right font-mono text-sm">
                    {Math.abs(payroll.totalDevengado - REAL_OCTOBER_PAYSLIP.totales.totalDevengado) < 0.05 ? (
                      <span className="text-emerald-700">0,00 €</span>
                    ) : (
                      <span
                        className={
                          payroll.totalDevengado > REAL_OCTOBER_PAYSLIP.totales.totalDevengado
                            ? 'text-indigo-700'
                            : 'text-amber-700'
                        }
                      >
                        {formatCurrency(payroll.totalDevengado - REAL_OCTOBER_PAYSLIP.totales.totalDevengado)}
                      </span>
                    )}
                  </td>
                </tr>

                {/* Líquido Neto Comparison */}
                <tr className="bg-emerald-50 font-bold text-xs border-t border-emerald-200 text-emerald-950">
                  <td className="p-3 uppercase">Líquido a Percibir (Neto)</td>
                  <td className="p-3 text-center font-mono text-sm text-emerald-900">
                    {formatCurrency(REAL_OCTOBER_PAYSLIP.totales.liquidoPercibir)}
                  </td>
                  <td className="p-3 text-center font-mono text-sm text-emerald-900">
                    {formatCurrency(payroll.liquidoPercibir)}
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-emerald-800">
                    {Math.abs(payroll.liquidoPercibir - REAL_OCTOBER_PAYSLIP.totales.liquidoPercibir) < 0.05 ? (
                      <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Coincide
                      </span>
                    ) : (
                      <span>{formatCurrency(payroll.liquidoPercibir - REAL_OCTOBER_PAYSLIP.totales.liquidoPercibir)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100 text-xs text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              ¿Por qué el Salario Base tiene 2 modalidades posibles?
            </p>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              En las tablas oficiales del <strong>Convenio Colectivo de Zaragoza</strong> el salario base diario para el año 2026 es de <strong>53,18 €/día</strong> (lo que genera <strong>1.648,58 €</strong> por los 31 días de octubre). Sin embargo, el recibo impreso de Masats aplica una base de <strong>39,89 €/día</strong> (<strong>1.236,59 €</strong>) y distribuye el resto mediante complementos salariales y prorratas independientes. Puedes alternar entre ambas modalidades con el selector superior para ajustarte a tu caso exacto.
            </p>
          </div>
        </div>
      )}

      {/* Visualización de Datos Recharts: Evolución Anual del Salario Neto */}
      <YearlySalaryChart
        data={yearlyEvolution}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectMonth={onSelectMonth}
      />

      {/* Interactive Controls Row: IRPF & Tanto por Ciento de Jornada */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Interactive IRPF Withholding Control */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900">
                  Retención de I.R.P.F. Trabajador
                </span>
              </div>
              <span className="font-bold font-mono text-xs sm:text-sm text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200/60">
                {profile.irpfPercentage.toFixed(1)}% ({formatCurrency(payroll.retencionIrpfImporte)})
              </span>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <span className="text-[10px] text-slate-400 font-mono">2%</span>
              <input
                type="range"
                min={2}
                max={28}
                step={0.5}
                value={profile.irpfPercentage}
                onChange={(e) => onUpdateProfile({ irpfPercentage: parseFloat(e.target.value) || 2 })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 font-mono">28%</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            Ajusta tu porcentaje de retención para calcular el impacto inmediato en el líquido mensual a percibir (15,0% en recibo Masats).
          </p>
        </div>

        {/* Interactive Tanto por Ciento de Jornada Control */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">
                  Tanto por Ciento de Jornada
                </span>
              </div>
              <span
                className={`font-bold font-mono text-xs sm:text-sm px-2.5 py-0.5 rounded-lg border ${
                  currentJornadaPercentage === 100
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    : 'bg-amber-50 text-amber-800 border-amber-200/60'
                }`}
              >
                {currentJornadaPercentage}% {currentJornadaPercentage === 100 ? '(Completa)' : '(Parcial)'}
              </span>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <span className="text-[10px] text-slate-400 font-mono">10%</span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={currentJornadaPercentage}
                onChange={(e) => handleJornadaChange(parseInt(e.target.value, 10))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 font-mono">100%</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 truncate">
              {currentJornadaPercentage === 100
                ? `Completa 100% · ${formatHoursES(payroll.convenioAnnualHoursTarget)} h/año (${formatHoursES(payroll.convenioMonthlyHoursTarget)} h/mes)`
                : `Parcial ${currentJornadaPercentage}% · ${formatHoursES(payroll.convenioAnnualHoursTarget)} h/año (${formatHoursES(payroll.convenioMonthlyHoursTarget)} h/mes)`}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {[50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleJornadaChange(preset)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    currentJornadaPercentage === preset
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Control Interactivo: Ciclo de Corte de Extras y Variables (Cierre Direxis) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <CalendarRange className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 leading-tight">
                Ciclo de Corte para Variables, Pluses y Extras
              </h4>
              <p className="text-[11px] text-slate-500">
                El salario base y la prorrata corresponden al mes natural. Todos los pluses y variables (Plus de Vacaciones, Conductor, Quebranto, Retén, Nocturnidad, Festivos, Horas y Extras) se cierran estrictamente del ciclo:
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Período de Extras</span>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200 inline-block">
              {payroll.extrasCutoffPeriod}
            </span>
          </div>
        </div>

        {/* 3 options switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onUpdateProfile({ extrasCutoffMode: 'direxis_25_24' })}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              (profile.extrasCutoffMode || 'direxis_25_24') === 'direxis_25_24'
                ? 'bg-blue-50/80 border-blue-600 ring-1 ring-blue-600 shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Direxis Zaragoza</span>
              {(profile.extrasCutoffMode || 'direxis_25_24') === 'direxis_25_24' && (
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Del 25 mes ant. al 24 actual</p>
          </button>

          <button
            type="button"
            onClick={() => onUpdateProfile({ extrasCutoffMode: 'mes_natural' })}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              profile.extrasCutoffMode === 'mes_natural'
                ? 'bg-emerald-50/80 border-emerald-600 ring-1 ring-emerald-600 shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Mes Natural</span>
              {profile.extrasCutoffMode === 'mes_natural' && (
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Del día 1 al fin de mes</p>
          </button>

          <button
            type="button"
            onClick={() => onUpdateProfile({ extrasCutoffMode: 'personalizado', customCutoffStartDay: profile.customCutoffStartDay || 25 })}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              profile.extrasCutoffMode === 'personalizado'
                ? 'bg-purple-50/80 border-purple-600 ring-1 ring-purple-600 shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Personalizado</span>
              {profile.extrasCutoffMode === 'personalizado' && (
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Del {profile.customCutoffStartDay || 25} al {(profile.customCutoffStartDay || 25) - 1}
            </p>
          </button>
        </div>

        {/* If pending extras after cutoff exist in current month */}
        {payroll.pendingNextMonthExtrasCount && payroll.pendingNextMonthExtrasCount > 0 ? (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight">
              <strong>
                {payroll.pendingNextMonthExtrasCount} conceptos variables/pluses generados entre el día{' '}
                {profile.extrasCutoffMode === 'personalizado' ? (profile.customCutoffStartDay || 25) : 25} y el {payroll.totalDays}{' '}
                (+{formatCurrency(payroll.pendingNextMonthExtrasTotal || 0)})
              </strong>{' '}
              quedan excluidos de este mes y pasarán a la nómina del mes siguiente según el período de corte ({payroll.extrasCutoffPeriod}).
            </div>
          </div>
        ) : null}
      </div>

      {/* Detailed Section: Devengos vs Deducciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DEVENGOS (Percepciones Salariales en Bruto) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600" /> I. Devengos Salariales (Bruto)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Cuantías antes de impuestos calculadas desde Convenio {payroll.year}
              </p>
            </div>
            <span className="text-xs font-extrabold text-emerald-700 font-mono">
              {formatCurrency(payroll.totalDevengado)}
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-semibold text-slate-800">Salario Base</p>
                <p className="text-[10px] text-slate-400">
                  {payroll.salarioBaseDays} días ({payroll.workedDays} trabajados + {payroll.restDays} descansos{payroll.vacationDays > 0 ? ` + ${payroll.vacationDays} vac.` : ''}) × {formatCurrency(payroll.salarioBaseUnitPrice)}/día
                  {!isMasatsBaseMode && payroll.partTimeFactor < 1 && ` (${Math.round(payroll.partTimeFactor * 100)}% de ${formatCurrency(activeYearRate.salarioBaseDia)})`}
                </p>
              </div>
              <span className="font-bold font-mono text-slate-900">{formatCurrency(payroll.salarioBase)}</span>
            </div>

            {payroll.plusVacaciones > 0 ? (
              <div className="flex items-center justify-between pt-2 bg-cyan-50/70 p-2.5 rounded-xl border border-cyan-200">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    <p className="font-bold text-cyan-950">Plus de Vacaciones (Art. 9 Convenio)</p>
                  </div>
                  <p className="text-[10px] text-cyan-700">
                    {payroll.vacationPlusDays} {payroll.vacationPlusDays === 1 ? 'día disfrutado' : 'días disfrutados'} ×{' '}
                    {formatCurrency(parseFloat((((activeYearRate.plusVacacionesDia && activeYearRate.plusVacacionesDia > 0 ? activeYearRate.plusVacacionesDia : 10.00)) * payroll.partTimeFactor).toFixed(2)))}/día{' '}
                    {payroll.partTimeFactor < 1
                      ? `(Proporcional al ${Math.round(payroll.partTimeFactor * 100)}% de ${formatCurrency(activeYearRate.plusVacacionesDia && activeYearRate.plusVacacionesDia > 0 ? activeYearRate.plusVacacionesDia : 10.00)})`
                      : '(Contrato al 100%)'}
                  </p>
                </div>
                <span className="font-extrabold font-mono text-cyan-800 text-sm">+{formatCurrency(payroll.plusVacaciones)}</span>
              </div>
            ) : null}

            {payroll.plusConductorPerceptor > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Conductor (Art. 19)</p>
                  <p className="text-[10px] text-slate-400">
                    {payroll.plusConductorCount} jornadas × {formatCurrency(activeYearRate.plusConductorPerceptorDia)} por jornada completa
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusConductorPerceptor)}</span>
              </div>
            )}

            {payroll.medioPlusConductorCount > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">1/2 Plus Conductor</p>
                  <p className="text-[10px] text-slate-400">
                    {payroll.medioPlusConductorCount} servicios × {formatCurrency(reducedConductorUnitRate)}/servicio reducido
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.medioPlusConductorAmount)}</span>
              </div>
            )}

            {payroll.plusQuebrantoMoneda > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Quebranto de Moneda (Art. 20)</p>
                  <p className="text-[10px] text-slate-400">
                    {payroll.quebrantoCount} días de cobro × {formatCurrency(activeYearRate.quebrantoMonedaDia)}
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusQuebrantoMoneda)}</span>
              </div>
            )}

            {payroll.plusNocturnidad > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Nocturnidad (Art. 18)</p>
                  <p className="text-[10px] text-slate-400">
                    {payroll.nightHours}h en tramo 22:00-06:00 × {formatCurrency(activeYearRate.plusNocturnidadHora)}/h
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusNocturnidad)}</span>
              </div>
            )}

            {payroll.plusFestivos > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Festivos y Domingos (Art. 17)</p>
                  <p className="text-[10px] text-slate-400">
                    {payroll.plusFestivoCount} festivo{payroll.plusFestivoCount === 1 ? '' : 's'} × {formatCurrency(payroll.plusFestivoCount > 0 ? payroll.plusFestivos / payroll.plusFestivoCount : activeYearRate.plusFestivoMayor4h)}
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusFestivos)}</span>
              </div>
            )}

            {payroll.horasFestivas > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Festivas (Horas)</p>
                  <p className="text-[10px] text-slate-400">
                    {formatHoursES(payroll.horasFestivas)} h en festivo × {formatCurrency(activeYearRate.horaOrdinaria)}/h (no computan dentro de convenio)
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.horasFestivasAmount)}</span>
              </div>
            )}

            {payroll.plusRetenCount > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Retén</p>
                  <p className="text-[10px] text-slate-400">
                    {payroll.plusRetenCount} días de retén × {formatCurrency(activeYearRate.plusRetenDia ?? 8.25)}/día
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusRetenAmount)}</span>
              </div>
            )}

            {payroll.prorrataPagasExtra > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">
                    Prorrata Pagas Extras ({prorrataNumPagas === 1 ? 'Marzo' : 'Marzo, Julio, Dic.'})
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {isMasatsBaseMode
                      ? `${prorrataNumPagas} ${prorrataNumPagas === 1 ? 'paga prorrateada' : 'pagas prorrateadas'} (${payroll.prorrataDays} días × ${formatCurrency(activeYearRate.prorrataPagaDia ?? 3.28)} = ${formatCurrency(prorrataPerPaga)} c/u)`
                      : `${prorrataNumPagas} ${prorrataNumPagas === 1 ? 'paga prorrateada' : 'pagas prorrateadas'} (${payroll.prorrataDays.toFixed(2).replace('.', ',')} días base × ${formatCurrency(payroll.salarioBaseUnitPrice)} = ${formatCurrency(prorrataPerPaga)} c/u)`}
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.prorrataPagasExtra)}</span>
              </div>
            )}

            {payroll.pagaExtraIntegraMes > 0 && (
              <div className="flex items-center justify-between pt-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                <div>
                  <p className="font-bold text-emerald-950">{payroll.pagaExtraIntegraNombre || 'Paga Extraordinaria Íntegra'}</p>
                  <p className="text-[10px] text-emerald-700">
                    30 días × {formatCurrency(payroll.salarioBaseUnitPrice)}
                  </p>
                </div>
                <span className="font-extrabold font-mono text-emerald-800">+{formatCurrency(payroll.pagaExtraIntegraMes)}</span>
              </div>
            )}

            {payroll.importeHorasExtra > 0 && (
              <div className="flex items-center justify-between pt-2 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200/80">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <p className="font-bold text-indigo-950">Hores Complementarias / Exceso</p>
                  </div>
                  <p className="text-[10px] text-indigo-700">
                    {formatHoursES(payroll.horasComplementarias || payroll.horasExtra)} h × {formatCurrency(activeYearRate.horaOrdinaria)}/h
                    {payroll.ordinaryConvenioHours > payroll.convenioMonthlyHoursTarget
                      ? ` (exceso sobre ${formatHoursES(payroll.convenioMonthlyHoursTarget)} h de convenio)`
                      : ' (exceso de jornada acumulado)'}
                  </p>
                </div>
                <span className="font-extrabold font-mono text-indigo-900 text-sm">+{formatCurrency(payroll.importeHorasExtra)}</span>
              </div>
            )}

            {(payroll.totalExtrasFueraConvenio > 0 || payroll.extrasItemsList.length > 0) && (
              <div className="pt-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-amber-900">
                        {payroll.totalExtrasFueraConvenio > 0
                          ? 'Complementos y Extras Fuera de Convenio'
                          : 'Registro de Extras y Variables del Período'}
                      </p>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                        {payroll.extrasItemsList.length} {payroll.extrasItemsList.length === 1 ? 'apunte' : 'apuntes'}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-700">
                      Corte: <strong>{payroll.extrasCutoffPeriod}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {payroll.totalExtrasFueraConvenio > 0 && (
                      <span className="font-bold font-mono text-amber-800">+{formatCurrency(payroll.totalExtrasFueraConvenio)}</span>
                    )}
                    {payroll.extrasItemsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowExtrasDetails(!showExtrasDetails)}
                        className="text-amber-800 hover:text-amber-950 p-0.5 rounded transition-colors flex items-center gap-1 text-[10px] font-bold"
                        title={showExtrasDetails ? 'Ocultar desglose' : 'Ver desglose'}
                      >
                        <span>{showExtrasDetails ? 'Ocultar' : 'Detalle'}</span>
                        {showExtrasDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Desglose de extras incluidos en el período de corte */}
                {showExtrasDetails && payroll.extrasItemsList.length > 0 && (
                  <div className="pt-2 border-t border-amber-200/60 space-y-1.5 text-[11px] animate-fadeIn">
                    {payroll.extrasItemsList.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-0.5 text-slate-700 border-b border-amber-100/60 last:border-0">
                        <div className="flex items-center gap-1.5 truncate max-w-[210px] sm:max-w-xs">
                          <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1 rounded shrink-0">
                            {item.date.slice(5)}
                          </span>
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-800 shrink-0">
                          +{formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DEDUCCIONES (Impuestos y Seguridad Social) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-rose-600" /> II. Deducciones y Tributos
            </h3>
            <span className="text-xs font-extrabold text-rose-700 font-mono">
              -{formatCurrency(payroll.totalDeducido)}
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-semibold text-slate-800">Contingencias Comunes (Ret. Seg. Soc. C.C.)</p>
                <p className="text-[10px] text-slate-400">4,70% sobre base {formatCurrency(payroll.baseCotizacionSS)}</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.contingenciasComunes)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Desempleo y Formación (Ret. Seg. Soc. D/FP)</p>
                <p className="text-[10px] text-slate-400">
                  {profile.contractType === 'temporal' ? '1,70% sobre base (1,60% desempleo + 0,10% FP)' : '1,65% sobre base (1,55% desempleo + 0,10% FP)'}
                </p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.desempleo + payroll.formacionProfesional)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Mecanismo Equidad Intergeneracional (MEI)</p>
                <p className="text-[10px] text-slate-400">0,15% sobre base {formatCurrency(payroll.baseCotizacionSS)}</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.mei)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 bg-blue-50/50 p-2 rounded-xl">
              <div>
                <p className="font-semibold text-blue-900">Retención I.R.P.F.</p>
                <p className="text-[10px] text-blue-700">{payroll.retencionIrpf}% sobre base bruta sujeta {formatCurrency(baseIrpf)}</p>
              </div>
              <span className="font-bold font-mono text-blue-800">-{formatCurrency(payroll.retencionIrpfImporte)}</span>
            </div>

            {payroll.cuotaSindical > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Cuota Sindical (Art. 36)</p>
                  <p className="text-[10px] text-slate-400">Deducción nómina autorizada</p>
                </div>
                <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.cuotaSindical)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coste Empresa Informativo Card */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 uppercase tracking-wide">
            Coste Total Empresa Estimado (Aportación Patronal)
          </span>
          <span className="font-extrabold font-mono text-slate-900">
            {formatCurrency(payroll.totalCosteEmpresa)}
          </span>
        </div>
        <p className="text-slate-500 leading-relaxed text-[11px]">
          Incluye cotizaciones empresariales a la Seguridad Social (23,60% CC + 5,50% Desempleo + 0,60% FP + 0,20% FOGASA + MEI).
        </p>
      </div>

      {/* Modal / Lightbox to inspect the real scanned October payslip photo */}
      {showRealPayslipModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Nómina Real Digitalizada · Octubre 2026
                </h3>
                <p className="text-xs text-slate-300">
                  S.A. MASATS TRANSPORTES GENERALES, UNIP · GARCIA MIANA, JORGE ADOLFO
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRealPayslipModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: Scanned Image View */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex flex-col items-center justify-center">
              <img
                src="/assets/aistudio/image_6bf52a84.png"
                alt="Nómina real escaneada Octubre 2026 S.A. Masats"
                className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md border border-slate-300"
              />
              <div className="mt-3 text-center text-xs text-slate-600 max-w-lg">
                Recibo original escaneado con los 12 conceptos retributivos, cuantía, precio unitario e importes brutos devengados y deducciones.
              </div>
            </div>

            {/* Modal Footer with quick actions */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500 hidden sm:block">
                Total Líquido: <strong>1.683,27 €</strong> · Total Devengos: <strong>2.144,30 €</strong>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {onSyncRealPayslip && (
                  <button
                    type="button"
                    onClick={() => {
                      onSyncRealPayslip();
                      setShowRealPayslipModal(false);
                      setComparisonTab('cotejo_real');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Cargar estos datos en la aplicación</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRealPayslipModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
