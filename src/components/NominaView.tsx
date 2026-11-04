import React, { useState } from 'react';
import {
  FileText,
  Table as TableIcon,
  Download,
  ShieldCheck,
  TrendingUp,
  Percent,
  Sliders,
  AlertCircle,
  Clock,
  Coins,
  CalendarRange,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PayrollBreakdown,
  WorkerProfile,
  ConvenioInfo,
  MonthlySalaryEvolution,
} from '../types';
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
}) => {
  const [showExtrasDetails, setShowExtrasDetails] = useState(false);
  const isPartTime = profile.contractType === 'tiempo_parcial';
  const currentJornadaPercentage = isPartTime
    ? (profile.partTimePercentage !== undefined && profile.partTimePercentage > 0
        ? profile.partTimePercentage
        : 50)
    : 100;

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28 space-y-4">
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
                Período: <strong>{monthName} {payroll.year}</strong> · {payroll.workedDays} jornadas
              </p>
              {profile.contractType === 'tiempo_parcial' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Jornada Parcial {profile.partTimePercentage || 50}%
                </span>
              )}
              {profile.prorrateoPagasExtra === 'una_paga' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Prorrata 1 paga + Jul/Dic íntegras
                </span>
              )}
            </div>
          </div>

          {/* Quick Export Action Buttons */}
          <div className="flex items-center gap-2">
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
      </div>

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
            Ajusta tu porcentaje de retención para calcular el impacto inmediato en el líquido mensual a percibir.
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
                ? 'Jornada completa al 100% de convenio.'
                : `Jornada parcial al ${currentJornadaPercentage}% proporcional.`}
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
                Ciclo de Corte para Extras y Variables
              </h4>
              <p className="text-[11px] text-slate-500">
                El sueldo base corresponde a los días del mes natural. Los extras y variables se cierran según el ciclo de la empresa:
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
              <strong>{payroll.pendingNextMonthExtrasCount} extras generados entre el día 25 y el 31 (+{formatCurrency(payroll.pendingNextMonthExtrasTotal || 0)})</strong> pasarán a la nómina del mes siguiente según el corte oficial de Direxis.
            </div>
          </div>
        ) : null}
      </div>

      {/* Detailed Section: Devengos vs Deducciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DEVENGOS (Percepciones Salariales) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" /> I. Devengos Salariales
            </h3>
            <span className="text-xs font-extrabold text-emerald-700 font-mono">
              {formatCurrency(payroll.totalDevengado)}
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-semibold text-slate-800">Salario Base Convenio</p>
                <p className="text-[10px] text-slate-400">
                  {payroll.workedDays} días trabajados
                  {payroll.vacationDays > 0 && ` + ${payroll.vacationDays} días vacaciones`}
                  {` x ${formatCurrency(convenio.ratesByYear[payroll.year]?.salarioBaseDia || 50.37)}`}
                  {payroll.partTimeFactor < 1 && ` (Jornada al ${Math.round(payroll.partTimeFactor * 100)}%)`}
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
                    {payroll.vacationDays} {payroll.vacationDays === 1 ? 'día disfrutado' : 'días disfrutados'} x {formatCurrency(convenio.ratesByYear[payroll.year]?.plusVacacionesDia || 10.00)}/día (Contrato al 100%)
                  </p>
                </div>
                <span className="font-extrabold font-mono text-cyan-800 text-sm">+{formatCurrency(payroll.plusVacaciones)}</span>
              </div>
            ) : payroll.vacationDays > 0 ? (
              <div className="flex items-center justify-between pt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-600">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <p className="font-semibold text-slate-700">Plus de Vacaciones (Art. 9 Convenio)</p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {payroll.partTimeFactor < 1
                      ? `Inactivo: Contrato al ${Math.round(payroll.partTimeFactor * 100)}% de jornada (la opción de perfil requiere jornada al 100%).`
                      : 'Inactivo: Desactivado en el Perfil del trabajador.'}
                  </p>
                </div>
                <span className="font-mono text-slate-400 text-xs">0,00 €</span>
              </div>
            ) : null}

            {payroll.plusConductorPerceptor > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Conductor-Perceptor (Art. 19)</p>
                  <p className="text-[10px] text-slate-400">
                    6,27 € por jornada {payroll.partTimeFactor < 1 ? `(proporcional ${Math.round(payroll.partTimeFactor * 100)}%)` : 'completa'}
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusConductorPerceptor)}</span>
              </div>
            )}

            {payroll.plusQuebrantoMoneda > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Quebranto de Moneda (Art. 20)</p>
                  <p className="text-[10px] text-slate-400">1,89 € por día de cobro/taquilla</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusQuebrantoMoneda)}</span>
              </div>
            )}

            {payroll.plusNocturnidad > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Nocturnidad (Art. 18)</p>
                  <p className="text-[10px] text-slate-400">{payroll.nightHours}h en tramo 22:00-06:00 x 2,48 €/h</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusNocturnidad)}</span>
              </div>
            )}

            {payroll.plusFestivos > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Festivos y Domingos (Art. 17)</p>
                  <p className="text-[10px] text-slate-400">{payroll.holidayDays} festivos / domingos trabajados</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusFestivos)}</span>
              </div>
            )}

            {payroll.prorrataPagasExtra > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Prorrata Pagas Extras (Art. 11)</p>
                  <p className="text-[10px] text-slate-400">
                    {profile.prorrateoPagasExtra === 'una_paga'
                      ? 'Prorrata 1 paga (Marzo, 2,5 días/mes · Julio y Dic íntegras)'
                      : '3 pagas anuales prorrateadas (7,5 días/mes)'}
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.prorrataPagasExtra)}</span>
              </div>
            )}

            {payroll.pagaExtraIntegraMes > 0 && (
              <div className="flex items-center justify-between pt-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <p className="font-bold text-emerald-900">{payroll.pagaExtraIntegraNombre || 'Paga Extraordinaria Íntegra'}</p>
                  </div>
                  <p className="text-[10px] text-emerald-700">Abono completo de 30 días de salario base en fecha de devengo</p>
                </div>
                <span className="font-extrabold font-mono text-emerald-800 text-sm">+{formatCurrency(payroll.pagaExtraIntegraMes)}</span>
              </div>
            )}

            {payroll.importeHorasExtra > 0 && (
              <div className="flex items-center justify-between pt-2 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200/80">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <p className="font-bold text-indigo-950">Horas Extraordinarias / Exceso Horario</p>
                  </div>
                  <p className="text-[10px] text-indigo-700">
                    {payroll.horasExtra} horas acumuladas por terminar más tarde de turno ({formatCurrency(convenio.ratesByYear[payroll.year]?.horaOrdinaria || 12.87)}/h)
                  </p>
                </div>
                <span className="font-extrabold font-mono text-indigo-900 text-sm">+{formatCurrency(payroll.importeHorasExtra)}</span>
              </div>
            )}

            {payroll.totalExtrasFueraConvenio > 0 ? (
              <div className="pt-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-amber-900">Complementos y Extras Fuera de Convenio</p>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                        {payroll.extrasItemsList.length} extras
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-700">
                      Corte: <strong>{payroll.extrasCutoffPeriod}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-amber-800">+{formatCurrency(payroll.totalExtrasFueraConvenio)}</span>
                    {payroll.extrasItemsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowExtrasDetails(!showExtrasDetails)}
                        className="text-amber-800 hover:text-amber-950 p-0.5 rounded transition-colors"
                        title={showExtrasDetails ? 'Ocultar desglose' : 'Ver desglose'}
                      >
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
            ) : (
              <div className="flex items-center justify-between pt-2 text-slate-400">
                <div>
                  <p className="font-medium text-slate-500">Complementos y Extras Fuera de Convenio</p>
                  <p className="text-[10px] text-slate-400">Sin extras en el ciclo ({payroll.extrasCutoffPeriod})</p>
                </div>
                <span className="font-mono text-slate-400">0,00 €</span>
              </div>
            )}
          </div>
        </div>

        {/* DEDUCCIONES (Impuestos y Seguridad Social) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-rose-600" /> II. Deducciones y Tributos
            </h3>
            <span className="text-xs font-extrabold text-rose-700 font-mono">
              -{formatCurrency(payroll.totalDeducido)}
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-semibold text-slate-800">Contingencias Comunes</p>
                <p className="text-[10px] text-slate-400">4,70% sobre base {formatCurrency(payroll.baseCotizacionSS)}</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.contingenciasComunes)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Desempleo Trabajador</p>
                <p className="text-[10px] text-slate-400">{profile.contractType === 'temporal' ? '1,60%' : '1,55%'} (Régimen General)</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.desempleo)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Formación Profesional</p>
                <p className="text-[10px] text-slate-400">0,10% sobre base</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.formacionProfesional)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Mecanismo Equidad Intergeneracional (MEI)</p>
                <p className="text-[10px] text-slate-400">Cotización obligatoria de pensiones</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.mei)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 bg-blue-50/50 p-2 rounded-xl">
              <div>
                <p className="font-semibold text-blue-900">Retención I.R.P.F.</p>
                <p className="text-[10px] text-blue-700">{payroll.retencionIrpf}% sobre base tributable</p>
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
    </div>
  );
};
