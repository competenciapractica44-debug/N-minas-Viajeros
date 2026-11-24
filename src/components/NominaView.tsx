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
  Cloud,
  RefreshCw,
  Lock,
  Unlock,
  ShieldCheck,
} from 'lucide-react';
import {
  PayrollBreakdown,
  WorkerProfile,
  ConvenioInfo,
  MonthlySalaryEvolution,
  DayAssignment,
  ShiftDefinition,
  ValidatedMonthRecord,
  ValidatedMonthsMap,
} from '../types';
import { getEffectiveYearRate } from '../data/convenioZaragoza';
import { formatCurrency } from '../utils/exporter';
import { ANNUAL_VACATION_DAYS_CONVENIO, getDaysInYear, roundCurrency } from '../utils/calculator';
import { AnnualLiquidationResult } from '../utils/annualCalendar';
import { YearlySalaryChart } from './YearlySalaryChart';
import { ConfirmModal } from './ConfirmModal';

interface NominaViewProps {
  payroll: PayrollBreakdown;
  profile: WorkerProfile;
  convenio: ConvenioInfo;
  assignments?: DayAssignment[];
  shifts?: ShiftDefinition[];
  monthName: string;
  selectedYear: number;
  selectedMonth: number;
  yearlyEvolution: MonthlySalaryEvolution[];
  onSelectMonth?: (month: number, year?: number) => void;
  onUpdateProfile: (partial: Partial<WorkerProfile>) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  isDriveConnected?: boolean;
  onOpenDriveNominasModal?: () => void;
  lastCalculatedAt?: Date;
  isRecalculating?: boolean;
  onRecalculate?: () => void;
  validatedMonth?: ValidatedMonthRecord;
  validatedMonths?: ValidatedMonthsMap;
  annualSummary?: AnnualLiquidationResult;
  isValidatingMonth?: boolean;
  onValidateMonth?: () => Promise<{ success: boolean; driveSaved: boolean; message: string }>;
  onUnvalidateMonth?: () => Promise<void> | void;
}

export const NominaView: React.FC<NominaViewProps> = ({
  payroll,
  profile,
  convenio,
  assignments = [],
  shifts = [],
  monthName,
  selectedYear,
  selectedMonth,
  yearlyEvolution,
  onSelectMonth,
  onUpdateProfile,
  onExportPDF,
  onExportExcel,
  isDriveConnected,
  onOpenDriveNominasModal,
  lastCalculatedAt,
  isRecalculating,
  onRecalculate,
  validatedMonth,
  annualSummary,
  isValidatingMonth,
  onValidateMonth,
  onUnvalidateMonth,
}) => {
  const [showExtrasDetails, setShowExtrasDetails] = useState(false);
  const [showUnvalidateConfirm, setShowUnvalidateConfirm] = useState(false);
  const [showIncompleteValidateConfirm, setShowIncompleteValidateConfirm] = useState(false);
  const [validationToast, setValidationToast] = useState<string | null>(null);

  const isPartTime = profile.contractType === 'tiempo_parcial';
  const currentJornadaPercentage = isPartTime
    ? (profile.partTimePercentage !== undefined && profile.partTimePercentage > 0
        ? profile.partTimePercentage
        : 50)
    : 100;

  const isMasatsBaseMode = profile.salaryBaseRateMode === 'masats_39_89';
  const activeYearRate = getEffectiveYearRate(convenio, payroll.year);
  const convenioBaseDia = roundCurrency(activeYearRate.salarioBaseDia * payroll.partTimeFactor);
  const masatsBaseDia = roundCurrency(activeYearRate.salarioBaseDiaMasats ?? 39.89);
  const convenioBaseTotal = roundCurrency(payroll.salarioBaseDays * convenioBaseDia);
  const masatsBaseTotal = roundCurrency(payroll.salarioBaseDays * masatsBaseDia);
  const reducedConductorUnitRate =
    activeYearRate.plusConductorPerceptorDiaReducido ??
    parseFloat(((activeYearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
  const prorrateoMode = profile.prorrateoPagasExtra || (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna');
  const prorrataNumPagas = prorrateoMode === 'una_paga' ? 1 : 3;
  const firstProrrataLine = payroll.lines.find(
    (l) => l.category === 'prorrata' && l.id.startsWith('paga-prorrateada-')
  );
  const prorrataPerPaga = firstProrrataLine
    ? firstProrrataLine.amount
    : prorrataNumPagas > 0
      ? Number((((30 * payroll.salarioBaseUnitPrice) / 365) * payroll.prorrataDays).toFixed(2))
      : 0;
  const prorrataDailyDisplayRate =
    payroll.prorrataDailyRate ??
    Number(((30 * payroll.salarioBaseUnitPrice) / 365).toFixed(2));
  const liquidatedDaysDisplay = payroll.liquidatedDays ?? payroll.totalDays;
  const hasPartialContractPeriod =
    (payroll.periodStartDay !== undefined && payroll.periodStartDay > 1) ||
    (payroll.periodEndDay !== undefined && payroll.periodEndDay < payroll.totalDays);
  const liquidatedPeriodBadgeText = hasPartialContractPeriod
    ? `Del ${payroll.periodStartDay ?? 1} al ${payroll.periodEndDay ?? payroll.totalDays} de ${monthName} (${liquidatedDaysDisplay} días)`
    : `Mes natural (${payroll.totalDays} días de ${monthName})`;
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
  const activeYearDaysForDisplay = Math.max(1, getDaysInYear(payroll.year) - ANNUAL_VACATION_DAYS_CONVENIO);
  const activeMonthDaysForDisplay = Math.max(0, payroll.totalDays - payroll.vacationDays - payroll.sickDays);
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

  const nonZeroExtrasItems = payroll.extrasItemsList
    .filter(
      (item) =>
        item.amount > 0 &&
        (!payroll.extrasCutoffStartDate || item.date >= payroll.extrasCutoffStartDate) &&
        (!payroll.extrasCutoffEndDate || item.date <= payroll.extrasCutoffEndDate)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const nonZeroExtrasTotal = parseFloat(
    nonZeroExtrasItems.reduce((acc, item) => acc + item.amount, 0).toFixed(2)
  );
  const groupedExtrasByDay = Array.from(
    nonZeroExtrasItems.reduce((map, item) => {
      const existing = map.get(item.date);
      if (existing) {
        existing.items.push(item);
        existing.dayTotal = parseFloat((existing.dayTotal + item.amount).toFixed(2));
      } else {
        map.set(item.date, {
          date: item.date,
          dayTotal: parseFloat(item.amount.toFixed(2)),
          items: [item],
        });
      }
      return map;
    }, new Map<string, { date: string; dayTotal: number; items: typeof nonZeroExtrasItems }>()).values()
  ).sort((a, b) => a.date.localeCompare(b.date));

  const formatShortDateES = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const weekDaysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const wd = weekDaysShort[new Date(y, m - 1, d).getDay()];
    return `${wd} ${String(d).padStart(2, '0')} ${monthsShort[m - 1] || ''}`;
  };

  const formatFullDateES = (dateStr?: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  };

  const cutoffTotalDays = (() => {
    if (!payroll.extrasCutoffStartDate || !payroll.extrasCutoffEndDate) return 0;
    const [sy, sm, sd] = payroll.extrasCutoffStartDate.split('-').map(Number);
    const [ey, em, ed] = payroll.extrasCutoffEndDate.split('-').map(Number);
    if (!sy || !sm || !sd || !ey || !em || !ed) return 0;
    const diff = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
    return Math.max(1, Math.round(diff / (24 * 60 * 60 * 1000)) + 1);
  })();

  const cutoffModeShortLabel =
    payroll.extrasCutoffMode === 'mes_natural'
      ? 'Mes Natural'
      : payroll.extrasCutoffMode === 'personalizado'
        ? 'Corte Personalizado'
        : 'Ciclo Direxis (25-24)';

  const monthStartDateStr = `${payroll.year}-${String(payroll.month).padStart(2, '0')}-01`;
  const hasPrevMonthStretch = Boolean(
    payroll.prevMonthCutoffStartDate &&
      payroll.prevMonthCutoffEndDate &&
      payroll.prevMonthCutoffStartDate < monthStartDateStr
  );
  const prevMonthGroupedExtras = hasPrevMonthStretch
    ? groupedExtrasByDay.filter(
        (g) =>
          g.date >= payroll.prevMonthCutoffStartDate! &&
          g.date <= payroll.prevMonthCutoffEndDate!
      )
    : [];
  const currentMonthGroupedExtras = groupedExtrasByDay.filter(
    (g) =>
      g.date >= (payroll.currentMonthCutoffStartDate || monthStartDateStr) &&
      g.date <= payroll.currentMonthCutoffEndDate
  );
  const prevMonthExtrasSubtotal = parseFloat(
    prevMonthGroupedExtras.reduce((acc, g) => acc + g.dayTotal, 0).toFixed(2)
  );
  const currentMonthExtrasSubtotal = parseFloat(
    currentMonthGroupedExtras.reduce((acc, g) => acc + g.dayTotal, 0).toFixed(2)
  );
  const prevMonthItemsCount = prevMonthGroupedExtras.reduce((acc, g) => acc + g.items.length, 0);
  const currentMonthItemsCount = currentMonthGroupedExtras.reduce((acc, g) => acc + g.items.length, 0);

  const MONTHS_FULL_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const prevMonthNameLabel = payroll.prevMonthCutoffStartDate
    ? MONTHS_FULL_ES[Number(payroll.prevMonthCutoffStartDate.split('-')[1]) - 1] || 'Mes ant.'
    : '';

  const formatStretchStatus = (
    itemsCount: number,
    groupedDaysCount: number,
    workedDaysCount: number,
    restDaysCount: number,
    vacationDaysCount: number,
    recordDaysCount: number
  ) => {
    if (itemsCount > 0) {
      return `${itemsCount} conc. (${groupedDaysCount}d)`;
    }
    if (workedDaysCount > 0) {
      return `${workedDaysCount} jorn. (0 € extra)`;
    }
    if (recordDaysCount > 0) {
      const parts: string[] = [];
      if (vacationDaysCount > 0) parts.push(`${vacationDaysCount} vac.`);
      if (restDaysCount > 0) parts.push(`${restDaysCount} desc.`);
      if (parts.length === 0) parts.push(`${recordDaysCount} reg.`);
      return `${parts.join(' · ')} (0 € extra)`;
    }
    return 'Sin registros';
  };

  const normalizeDateStr = (raw?: string): string => {
    if (!raw) return '';
    const trimmed = String(raw).trim().split('T')[0];
    const m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return trimmed;
  };

  const hasRecord = (a?: DayAssignment) =>
    Boolean(
      a &&
        ((a.shiftCode && a.shiftCode.trim() !== '') ||
          (a.shiftId && a.shiftId.trim() !== '') ||
          a.isRest ||
          a.isVacation ||
          a.isSickLeave ||
          a.isHoliday ||
          (a.extras && a.extras.length > 0) ||
          (a.lateFinishMinutes && a.lateFinishMinutes > 0) ||
          (a.notes && a.notes.trim() !== '') ||
          (a.customLine && a.customLine.trim() !== ''))
    );

  const shiftsByCode = new Map<string, ShiftDefinition>();
  shifts.forEach((s) => {
    shiftsByCode.set(s.code.trim().toUpperCase(), s);
  });

  const assignmentsMap = new Map<string, DayAssignment>();
  assignments.forEach((a) => {
    const key = normalizeDateStr(a.date);
    if (!key) return;
    if (!assignmentsMap.has(key) || hasRecord(a)) {
      assignmentsMap.set(key, { ...a, date: key });
    }
  });

  const describeAssignmentForDay = (asg?: DayAssignment): string => {
    if (!asg) return 'Sin turno';
    const uc = (asg.shiftCode || '').trim().toUpperCase();
    if (asg.isVacation || uc === 'V' || asg.shiftId === 'V') return 'Vacaciones (V)';
    if (asg.isRest || uc === 'D' || asg.shiftId === 'D') return 'Descanso / Fiesta (D)';
    if (asg.isSickLeave || uc === 'B' || asg.shiftId === 'B') return 'Baja / IT (B)';
    const code = (asg.shiftCode || asg.shiftId || '').trim();
    if (asg.shiftSnapshot) {
      return `Turno ${asg.shiftSnapshot.code} (${asg.shiftSnapshot.startTime}–${asg.shiftSnapshot.endTime})`;
    }
    if (code) {
      const def = shiftsByCode.get(code.toUpperCase());
      return def ? `Turno ${def.code} (${def.startTime}–${def.endTime})` : `Turno ${code}`;
    }
    if (asg.isHoliday) return 'Festivo marcado';
    return 'Registro en calendario';
  };

  const buildStretchDayRows = (
    startStr: string | undefined,
    endStr: string | undefined,
    groupedExtras: typeof groupedExtrasByDay
  ) => {
    const extrasByDate = new Map(groupedExtras.map((g) => [g.date, g]));
    const rowsByDate = new Map<
      string,
      {
        date: string;
        dayLabel: string;
        dayTotal: number;
        items: typeof nonZeroExtrasItems;
      }
    >();

    groupedExtras.forEach((g) => {
      const asg = assignmentsMap.get(g.date);
      rowsByDate.set(g.date, {
        date: g.date,
        dayLabel: describeAssignmentForDay(asg),
        dayTotal: g.dayTotal,
        items: g.items,
      });
    });

    if (startStr && endStr) {
      assignmentsMap.forEach((asg, dStr) => {
        if (dStr >= startStr && dStr <= endStr && hasRecord(asg) && !extrasByDate.has(dStr)) {
          rowsByDate.set(dStr, {
            date: dStr,
            dayLabel: describeAssignmentForDay(asg),
            dayTotal: 0,
            items: [],
          });
        }
      });
    }

    return Array.from(rowsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const prevMonthDayRows = hasPrevMonthStretch
    ? buildStretchDayRows(
        payroll.prevMonthCutoffStartDate,
        payroll.prevMonthCutoffEndDate,
        prevMonthGroupedExtras
      )
    : [];
  const currentMonthDayRows = buildStretchDayRows(
    payroll.currentMonthCutoffStartDate || monthStartDateStr,
    payroll.currentMonthCutoffEndDate,
    currentMonthGroupedExtras
  );

  const prevMonthRecordDays = Math.max(
    payroll.prevMonthCutoffRecordDays ?? 0,
    payroll.prevMonthCutoffWorkedDays,
    prevMonthDayRows.length
  );
  const currentMonthRecordDays = Math.max(
    payroll.currentMonthCutoffRecordDays ?? 0,
    payroll.currentMonthCutoffWorkedDays,
    currentMonthDayRows.length
  );

  // Detectar en qué meses existen registros en el calendario para orientar al usuario si está viendo otro mes
  const loggedMonthsSummary = (() => {
    const counts = new Map<string, { year: number; month: number; totalDays: number; lateDays: number }>();
    assignmentsMap.forEach((asg, dStr) => {
      if (!hasRecord(asg)) return;
      const [yStr, mStr, dNumStr] = dStr.split('-');
      const yNum = Number(yStr);
      const mNum = Number(mStr);
      const dNum = Number(dNumStr);
      if (!yNum || !mNum) return;
      const key = `${yNum}-${String(mNum).padStart(2, '0')}`;
      const existing = counts.get(key) || { year: yNum, month: mNum, totalDays: 0, lateDays: 0 };
      existing.totalDays++;
      if (dNum >= 25) existing.lateDays++;
      counts.set(key, existing);
    });
    return Array.from(counts.values()).sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  })();

  const prevMonthStatusLabel = formatStretchStatus(
    prevMonthItemsCount,
    prevMonthGroupedExtras.length,
    payroll.prevMonthCutoffWorkedDays,
    payroll.prevMonthCutoffRestDays ?? 0,
    payroll.prevMonthCutoffVacationDays ?? 0,
    prevMonthRecordDays
  );
  const currentMonthStatusLabel = formatStretchStatus(
    currentMonthItemsCount,
    currentMonthGroupedExtras.length,
    payroll.currentMonthCutoffWorkedDays,
    payroll.currentMonthCutoffRestDays ?? 0,
    payroll.currentMonthCutoffVacationDays ?? 0,
    currentMonthRecordDays
  );

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
            {onValidateMonth && !validatedMonth && (
              <button
                type="button"
                disabled={isValidatingMonth}
                onClick={() => {
                  const prefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-`;
                  const daysTotal = new Date(selectedYear, selectedMonth, 0).getDate();
                  const filledCount = assignments.filter((a) => a.date?.startsWith(prefix) && hasRecord(a)).length;
                  if (filledCount >= daysTotal) {
                    void onValidateMonth().then((res) => {
                      if (res?.message) {
                        setValidationToast(res.message);
                        window.setTimeout(() => setValidationToast(null), 6000);
                      }
                    });
                  } else {
                    setShowIncompleteValidateConfirm(true);
                  }
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                title="Congelar el % de jornada y el % IRPF de este mes y guardar su nómina"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isValidatingMonth ? 'Validando...' : 'Validar Mes'}</span>
              </button>
            )}
            {validatedMonth && onUnvalidateMonth && (
              <button
                type="button"
                onClick={() => setShowUnvalidateConfirm(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold rounded-xl border border-emerald-400/40 transition-colors cursor-pointer"
                title="Este mes está validado y protegido. Pulsa para reabrirlo si necesitas editarlo."
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Validada · Reabrir</span>
              </button>
            )}
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

        {validationToast && (
          <div className="mt-3 bg-emerald-500/25 border border-emerald-400/40 text-emerald-100 px-3.5 py-2 rounded-xl text-xs font-bold">
            {validationToast}
          </div>
        )}

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
              Obj. {monthName} ({activeMonthDaysForDisplay}d{payroll.vacationDays > 0 || payroll.sickDays > 0 ? ` de ${payroll.totalDays}d` : ''}):{' '}
              <strong className="font-mono text-white">{formatHoursES(payroll.convenioMonthlyHoursTarget)} h</strong>
              {` · Base ${activeYearDaysForDisplay}d/año (sin ${ANNUAL_VACATION_DAYS_CONVENIO}d vac.)`}
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold block">
              Horas Reales (hasta 9h/día) vs Teóricas
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-white font-mono text-sm">
                {formatHoursES(payroll.ordinaryConvenioHours)} h
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  payroll.horasExcesoMensual > 0
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : periodHoursDiff >= 0
                      ? 'bg-sky-400/20 text-sky-200'
                      : 'bg-amber-400/20 text-amber-300'
                }`}
              >
                {payroll.horasExcesoMensual > 0
                  ? `+${formatHoursES(payroll.horasExcesoMensual)} h compl.`
                  : periodHoursDiff >= 0
                    ? payroll.vacationDays > 0
                      ? `+${formatHoursES(periodHoursDiff)} h a bolsa/cuota · 0h compl.`
                      : '0h compl. (compensa déficit)'
                    : `${formatHoursES(periodHoursDiff)} h (a compensar · 0h compl.)`}
              </span>
              {payroll.horasExcesoDiario9h > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-indigo-400/25 text-indigo-200">
                  +{formatHoursES(payroll.horasExcesoDiario9h)} h (&gt;9h)
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-300 block">
              {payroll.horasFestivas > 0 || payroll.horasFT > 0
                ? `Teór.: ${formatHoursES(payroll.convenioMonthlyHoursTarget)} h${payroll.horasFestivas > 0 ? ` · ${formatHoursES(payroll.horasFestivas)} h festivas` : ''}${payroll.horasFT > 0 ? ` · ${formatHoursES(payroll.horasFT)} h F/T` : ''} aparte (Total: ${formatHoursES(payroll.totalWorkedHours)} h)`
                : `Teór. ${monthName}: ${formatHoursES(payroll.convenioMonthlyHoursTarget)} h (${payroll.totalDays}d${payroll.vacationDays > 0 ? ` − ${payroll.vacationDays}d vac.` : ''}${payroll.sickDays > 0 ? ` − ${payroll.sickDays}d baja` : ''})`}
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

        {/* Live recalculation / Validated frozen banner */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-slate-300">
            <span className={`w-2 h-2 rounded-full shrink-0 ${validatedMonth ? 'bg-emerald-400' : isRecalculating ? 'bg-amber-400 animate-ping' : 'bg-sky-400'}`}></span>
            {validatedMonth ? (
              <span className="text-emerald-200">
                <strong>Nómina validada el {new Date(validatedMonth.validatedAt).toLocaleDateString('es-ES')}</strong>{' '}
                (Jornada {validatedMonth.jornadaPct}% · IRPF {validatedMonth.irpfPercentage}%). Los cambios posteriores de Jornada, IRPF o Turnos solo aplican a meses sin validar.
              </span>
            ) : (
              <span>
                {isRecalculating
                  ? 'Sincronizando y recalculando nómina con los datos del calendario...'
                  : `Calculada en vivo desde el calendario (${
                      lastCalculatedAt
                        ? lastCalculatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'ahora'
                    }) · Pulsa "Validar Mes" cuando completes el mes para guardar nómina y fijar IRPF, jornada y turnos`}
              </span>
            )}
          </div>
          {!validatedMonth && onRecalculate && (
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

        {(payroll.carriedDeficitAppliedHours || (annualSummary && annualSummary.validatedMonthsCount > 0)) && (
          <div className="mt-2.5 bg-white/10 border border-white/15 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-200">
            <span>
              <strong>Arrastre de meses validados ({annualSummary?.validatedMonthsCount || 0}/12):</strong>{' '}
              saldo acumulado{' '}
              <strong className="font-mono text-white">
                {formatHoursES(annualSummary?.saldoArrastradoValidado ?? payroll.carriedHoursBalance ?? 0)} h
              </strong>
              {payroll.carriedDeficitAppliedHours && payroll.carriedDeficitAppliedHours > 0
                ? ` · Compensadas ${formatHoursES(payroll.carriedDeficitAppliedHours)} h de déficit previo antes de generar complementarias`
                : ''}
            </span>
            {annualSummary && annualSummary.unvalidatedMonthsCount > 0 && (
              <span className="font-mono text-sky-200 font-bold">
                Resto año ({Math.round(payroll.partTimeFactor * 100)}%): {formatHoursES(annualSummary.horasPendientesAjustadasResto)} h ({formatHoursES(annualSummary.cuotaMensualAjustadaResto)} h/mes)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Salario Base Mode Selector Pill (Convenio 53.18 vs Tarifa alternativa) */}
      <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 leading-tight">
              Cálculo del Salario Base en Bruto: {payroll.salarioBaseDays} días en {monthName}
              {hasPartialContractPeriod ? ` (del ${payroll.periodStartDay ?? 1} al ${payroll.periodEndDay ?? payroll.totalDays})` : ''}
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
            disabled={Boolean(validatedMonth)}
            onClick={() => onUpdateProfile({ salaryBaseRateMode: 'convenio_53_18' })}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60 ${
              !isMasatsBaseMode
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Convenio {formatCurrency(convenioBaseDia)} ({formatCurrency(convenioBaseTotal)})
          </button>
        </div>
      </div>

      {/* Main View: TABLA OFICIAL CON CUANTÍA Y PRECIO */}
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

      {/* Apartado Específico: Bolsa de Horas, Vacaciones y Saldo (A favor del Empleado vs Empresa) */}
      {(() => {
        const formatSignedH = (val: number) => {
          const rounded = Math.round(val * 100) / 100;
          if (Math.abs(rounded) < 0.005) return '0,00 h';
          return `${rounded > 0 ? '+' : '−'}${formatHoursES(Math.abs(rounded))} h`;
        };

        const rawDiff =
          payroll.diferenciaRealVsTeoricasMes !== undefined
            ? payroll.diferenciaRealVsTeoricasMes
            : parseFloat((payroll.ordinaryConvenioHours - payroll.convenioMonthlyHoursTarget).toFixed(2));
        const deficitPrevio = payroll.deficitAnteriorPendiente ?? 0;
        const deficitCompensado = payroll.carriedDeficitAppliedHours ?? 0;
        const deficitAlCierre =
          payroll.deficitPendienteAlCierre !== undefined
            ? payroll.deficitPendienteAlCierre
            : rawDiff < 0
              ? parseFloat((deficitPrevio + rawDiff).toFixed(2))
              : parseFloat(Math.min(0, deficitPrevio + deficitCompensado).toFixed(2));

        const cuotaFija =
          payroll.cuotaFijaMensualContrato ??
          Math.ceil(payroll.convenioAnnualHoursTarget / 12);
        const cuotaFijaEnteraAnual =
          payroll.cuotaFijaEnteraAnual ?? Math.ceil(payroll.convenioAnnualHoursTarget / 12);
        const isPostVacReg = Boolean(payroll.isPostVacacionesRegularizado);
        const lastVacMonthName =
          payroll.lastVacationMonthYear && payroll.lastVacationMonthYear >= 1 && payroll.lastVacationMonthYear <= 12
            ? ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][payroll.lastVacationMonthYear - 1]
            : null;
        const umbralCompl =
          payroll.umbralComplementariasMes ??
          (payroll.vacationDays > 0
            ? parseFloat(Math.max(payroll.convenioMonthlyHoursTarget, cuotaFija).toFixed(2))
            : payroll.convenioMonthlyHoursTarget);
        const horasAbsorbidasPorCuotaBolsa = parseFloat(
          Math.max(0, rawDiff - deficitCompensado - payroll.horasExcesoMensual).toFixed(2)
        );
        const bolsaAnterior = payroll.bolsaSaldoAnterior ?? payroll.carriedHoursBalance ?? 0;
        const activeYearDays = Math.max(1, getDaysInYear(payroll.year) - ANNUAL_VACATION_DAYS_CONVENIO);
        const dailyRateEst = (payroll.convenioAnnualHoursBase * payroll.partTimeFactor) / activeYearDays;
        const reservaMes =
          payroll.bolsaGeneradaReservaMes ??
          parseFloat((payroll.totalDays * dailyRateEst - cuotaFija).toFixed(2));
        const descVacMes =
          payroll.bolsaDescontadaVacacionesMes ??
          parseFloat((payroll.vacationDays * dailyRateEst).toFixed(2));
        const movimientoBolsaMes =
          payroll.bolsaHorasMes ??
          parseFloat((payroll.ordinaryConvenioHours - payroll.horasExcesoMensual + payroll.sickDays * dailyRateEst - cuotaFija).toFixed(2));
        const desviacionTrabajadaNoCobrada = parseFloat(
          (movimientoBolsaMes - (reservaMes - descVacMes)).toFixed(2)
        );
        const bolsaCierre =
          payroll.bolsaHorasAcumulada ?? parseFloat((bolsaAnterior + movimientoBolsaMes).toFixed(2));

        const isBolsaPositive = bolsaCierre > 0.004;
        const isBolsaNegative = bolsaCierre < -0.004;
        const hasDeficitDebt = deficitAlCierre < -0.004;

        return (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold font-mono uppercase">
                    Bolsa de Horas
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cálculo de Complementarias, Cuota Fija y Bolsa de Vacaciones
                  </h3>
                  {isPostVacReg && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Regularizada post-vacaciones
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Las horas <strong>festivas{payroll.horasFT > 0 ? ' y F/T' : ''}</strong> se cobran aparte sí o sí.{' '}
                  {isPostVacReg
                    ? `Disfrutados los 31 días de vacaciones${lastVacMonthName ? ` (fin en ${lastVacMonthName}, bolsa a 0,00 h)` : ''}, la cuota se regulariza a ${formatHoursES(cuotaFija)} h para cuadrar la jornada anual.`
                    : `Cuota fija entera redondeada por encima (${formatHoursES(cuotaFijaEnteraAnual)} h/mes); la bolsa cubre los meses con vacaciones hasta quedar a 0,00 h en las últimas vacaciones.`}
                </p>
              </div>

              <div className="shrink-0">
                {isBolsaPositive ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold font-mono">
                    <span>Saldo POSITIVO (a favor del empleado):</span>
                    <span>{formatSignedH(bolsaCierre)}</span>
                  </span>
                ) : isBolsaNegative ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-extrabold font-mono">
                    <span>Saldo NEGATIVO (debe el empleado):</span>
                    <span>{formatSignedH(bolsaCierre)}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold font-mono">
                    <span>Saldo Bolsa: 0,00 h</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-3.5 text-xs">
              {/* Bloque 1: Cálculo de Horas Complementarias del Mes */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  1. Complementarias del Mes
                </p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Horas reales ordinarias (sin fest./F.T):</span>
                    <span className="font-mono font-bold text-slate-900">{formatHoursES(payroll.ordinaryConvenioHours)} h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">(−) Horas teóricas del mes:</span>
                    <span className="font-mono font-bold text-slate-700">−{formatHoursES(payroll.convenioMonthlyHoursTarget)} h</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="font-semibold text-slate-800">Diferencia (Real − Teóricas):</span>
                    <span className={`font-mono font-extrabold ${rawDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatSignedH(rawDiff)}
                    </span>
                  </div>
                  {payroll.vacationDays > 0 && (
                    <div className="flex items-center justify-between text-sky-900 bg-sky-50 px-2 py-1 rounded-lg border border-sky-200/80">
                      <span>Umbral cuota fija mes ({formatHoursES(umbralCompl)} h):</span>
                      <span className="font-mono font-bold">
                        {horasAbsorbidasPorCuotaBolsa > 0
                          ? `−${formatHoursES(horasAbsorbidasPorCuotaBolsa)} h a bolsa`
                          : 'Cubierto con bolsa'}
                      </span>
                    </div>
                  )}
                  {deficitCompensado > 0 && (
                    <div className="flex items-center justify-between text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/80">
                      <span>(−) Descuento déficit anterior:</span>
                      <span className="font-mono font-bold">−{formatHoursES(deficitCompensado)} h</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="font-bold text-indigo-900">Exceso mensual a cobrar:</span>
                    <span className="font-mono font-extrabold text-indigo-700">{formatHoursES(payroll.horasExcesoMensual)} h</span>
                  </div>
                  {(payroll.horasExcesoDiario9h > 0 || payroll.horasFestivas > 0 || payroll.horasFT > 0) && (
                    <div className="text-[10px] text-slate-500 pt-1 leading-snug">
                      {payroll.horasExcesoDiario9h > 0 && (
                        <span>+{formatHoursES(payroll.horasExcesoDiario9h)} h por turnos &gt;9h a complementarias. </span>
                      )}
                      {(payroll.horasFestivas > 0 || payroll.horasFT > 0) && (
                        <span>
                          Aparte: {payroll.horasFestivas > 0 ? `${formatHoursES(payroll.horasFestivas)} h festivas` : ''}
                          {payroll.horasFestivas > 0 && payroll.horasFT > 0 ? ' + ' : ''}
                          {payroll.horasFT > 0 ? `${formatHoursES(payroll.horasFT)} h F/T` : ''} cobradas directo.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bloque 2: Bolsa de Horas y Descuento en Vacaciones */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  2. Bolsa Anual (Enero = 0,00 h)
                </p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Bolsa acumulada mes anterior:</span>
                    <span className={`font-mono font-bold ${bolsaAnterior >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatSignedH(bolsaAnterior)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">
                      Generación reserva mes (vs {formatHoursES(cuotaFija)} h{isPostVacReg ? ' reg.' : ''}):
                    </span>
                    <span className={`font-mono font-bold ${reservaMes >= 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {formatSignedH(reservaMes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">
                      Descuento vacaciones ({payroll.vacationDays}d en {monthName}):
                    </span>
                    <span className={`font-mono font-bold ${descVacMes > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {descVacMes > 0 ? `−${formatHoursES(descVacMes)} h` : '0,00 h'}
                    </span>
                  </div>
                  {Math.abs(desviacionTrabajadaNoCobrada) > 0.004 && (
                    <div className="flex items-center justify-between text-sky-900">
                      <span>Ajuste trabajado a bolsa/déficit:</span>
                      <span className={`font-mono font-bold ${desviacionTrabajadaNoCobrada >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatSignedH(desviacionTrabajadaNoCobrada)}
                      </span>
                    </div>
                  )}
                  {(payroll.horasComplementarias || 0) > 0.004 && (
                    <div className="flex items-center justify-between text-indigo-800 bg-indigo-50/80 px-2 py-1 rounded-lg border border-indigo-200/70">
                      <span>Complementarias cobradas (no van a bolsa):</span>
                      <span className="font-mono font-bold">
                        −{formatHoursES(payroll.horasComplementarias)} h (excluidas)
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Movimiento neto bolsa este mes:</span>
                    <span className={`font-mono font-bold ${movimientoBolsaMes >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatSignedH(movimientoBolsaMes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Bolsa al cierre de {monthName}:</span>
                    <span className={`font-mono font-extrabold ${isBolsaPositive ? 'text-emerald-700' : isBolsaNegative ? 'text-rose-700' : 'text-slate-800'}`}>
                      {formatSignedH(bolsaCierre)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloque 3: Estado del Saldo (Empleado vs Empresa) */}
              <div
                className={`rounded-2xl border p-3.5 flex flex-col justify-between space-y-2 ${
                  hasDeficitDebt || isBolsaNegative
                    ? 'border-rose-200 bg-rose-50/60'
                    : isBolsaPositive
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="space-y-1.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                    3. Situación del Saldo
                  </p>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-700">
                      {isBolsaPositive
                        ? 'A favor del empleado:'
                        : isBolsaNegative
                          ? 'A favor de la empresa (las debe):'
                          : 'Saldo de bolsa:'}
                    </span>
                    <span
                      className={`text-lg font-black font-mono ${
                        isBolsaPositive ? 'text-emerald-700' : isBolsaNegative ? 'text-rose-700' : 'text-slate-800'
                      }`}
                    >
                      {formatSignedH(bolsaCierre)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-600">
                    {isBolsaPositive
                      ? 'Saldo positivo acumulado a favor del trabajador para cubrir futuros días de vacaciones.'
                      : isBolsaNegative
                        ? 'Saldo negativo a favor de la empresa: incluye vacaciones disfrutadas por adelantado o horas pendientes de cubrir durante el año.'
                        : 'Las horas trabajadas y las vacaciones disfrutadas quedan exactamente cuadradas.'}
                  </p>
                </div>

                <div
                  className={`pt-2 border-t text-[11px] ${
                    hasDeficitDebt
                      ? 'border-rose-200 text-rose-900'
                      : 'border-slate-200/70 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Déficit a descontar en próx. excesos:</span>
                    <span className={`font-mono ${hasDeficitDebt ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {hasDeficitDebt ? formatSignedH(deficitAlCierre) : '0,00 h'}
                    </span>
                  </div>
                  {hasDeficitDebt && (
                    <p className="text-[10px] text-rose-700 mt-0.5 leading-snug">
                      El empleado debe {formatHoursES(Math.abs(deficitAlCierre))} h respecto a las teóricas; se descontarán en los próximos meses que sobren horas antes de cobrar complementarias.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
              <span className="text-[10px] text-slate-400 font-mono">0%</span>
              <input
                type="range"
                min={0}
                max={35}
                step={0.5}
                disabled={Boolean(validatedMonth)}
                value={profile.irpfPercentage}
                onChange={(e) => onUpdateProfile({ irpfPercentage: parseFloat(e.target.value) || 0 })}
                className="w-full accent-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 font-mono">35%</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            {validatedMonth
              ? 'Mes validado con IRPF bloqueado. Pulsa "Validada · Reabrir" arriba si deseas modificarlo.'
              : 'Ajusta tu porcentaje de retención para calcular el impacto inmediato en el líquido mensual a percibir.'}
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
                disabled={Boolean(validatedMonth)}
                value={currentJornadaPercentage}
                onChange={(e) => handleJornadaChange(parseInt(e.target.value, 10))}
                className="w-full accent-amber-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 font-mono">100%</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 truncate">
              {currentJornadaPercentage === 100
                ? `Completa 100% · ${formatHoursES(payroll.convenioAnnualHoursTarget)} h/año (Obj. ${monthName}: ${formatHoursES(payroll.convenioMonthlyHoursTarget)} h)`
                : `Parcial ${currentJornadaPercentage}% · ${formatHoursES(payroll.convenioAnnualHoursTarget)} h/año (Obj. ${monthName}: ${formatHoursES(payroll.convenioMonthlyHoursTarget)} h)`}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {[50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={Boolean(validatedMonth)}
                  onClick={() => handleJornadaChange(preset)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
            disabled={Boolean(validatedMonth)}
            onClick={() => onUpdateProfile({ extrasCutoffMode: 'direxis_25_24' })}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between disabled:opacity-60 disabled:cursor-not-allowed ${
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
            disabled={Boolean(validatedMonth)}
            onClick={() => onUpdateProfile({ extrasCutoffMode: 'mes_natural' })}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between disabled:opacity-60 disabled:cursor-not-allowed ${
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
            disabled={Boolean(validatedMonth)}
            onClick={() => onUpdateProfile({ extrasCutoffMode: 'personalizado', customCutoffStartDay: profile.customCutoffStartDay || 25 })}
            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between disabled:opacity-60 disabled:cursor-not-allowed ${
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
              {(profile.customCutoffStartDay || 25) === 1
                ? 'Del 1 al fin de mes (incluidos)'
                : `Del ${profile.customCutoffStartDay || 25} mes ant. al ${(profile.customCutoffStartDay || 25) - 1} actual`}
            </p>
          </button>
        </div>

        {profile.extrasCutoffMode === 'personalizado' && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-purple-50/70 rounded-xl border border-purple-200/80 text-xs text-purple-950">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[11px]">Día de inicio personalizado:</span>
              <input
                type="number"
                min={1}
                max={28}
                disabled={Boolean(validatedMonth)}
                value={profile.customCutoffStartDay || 25}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1));
                  onUpdateProfile({
                    extrasCutoffMode: 'personalizado',
                    customCutoffStartDay: val,
                  });
                }}
                className="w-16 py-1 px-2 border border-purple-300 rounded-lg text-xs font-mono font-bold text-center bg-white text-purple-950 disabled:opacity-60"
              />
            </div>
            <span className="text-[11px] text-purple-800">
              Cobertura actual:{' '}
              <strong>
                {formatFullDateES(payroll.extrasCutoffStartDate)} al {formatFullDateES(payroll.extrasCutoffEndDate)} (incluidos)
              </strong>
            </span>
          </div>
        )}

        {/* If pending extras after cutoff exist in current month */}
        {payroll.pendingNextMonthExtrasCount && payroll.pendingNextMonthExtrasCount > 0 ? (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight">
              <strong>
                {payroll.pendingNextMonthExtrasCount} conceptos variables/pluses generados entre el día{' '}
                {Math.min(payroll.totalDays, (Number(payroll.extrasCutoffEndDate?.split('-')[2] || 24) + 1))} y el {payroll.totalDays}{' '}
                (+{formatCurrency(payroll.pendingNextMonthExtrasTotal || 0)})
              </strong>{' '}
              quedan excluidos de este mes y pasarán a la nómina del mes siguiente según el período de corte ({payroll.extrasCutoffPeriod}, incluidos).
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-slate-800">Salario Base</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${hasPartialContractPeriod ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                    {liquidatedPeriodBadgeText}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {hasPartialContractPeriod
                    ? `${payroll.salarioBaseDays} días liquidados (${payroll.workedDays} trabajados + ${payroll.restDays} descansos${payroll.vacationDays > 0 ? ` + ${payroll.vacationDays} vac.` : ''}) × ${formatCurrency(payroll.salarioBaseUnitPrice)}/día`
                    : `${payroll.salarioBaseDays} días (${payroll.workedDays} trabajados + ${payroll.restDays} descansos${payroll.vacationDays > 0 ? ` + ${payroll.vacationDays} vac.` : ''}) × ${formatCurrency(payroll.salarioBaseUnitPrice)}/día`}
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
                    {payroll.vacationPlusDays} {payroll.vacationPlusDays === 1 ? 'día natural disfrutado' : 'días naturales disfrutados'} ×{' '}
                    {formatCurrency(roundCurrency((activeYearRate.plusVacacionesDia && activeYearRate.plusVacacionesDia > 0 ? activeYearRate.plusVacacionesDia : 10.00) * payroll.partTimeFactor))}/día{' '}
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

            {payroll.medioPlusConductorCount > 0 && payroll.medioPlusConductorAmount > 0 && (
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

            {payroll.horasFestivas > 0 && payroll.horasFestivasAmount > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Festivas (Horas)</p>
                  <p className="text-[10px] text-slate-400">
                    {formatHoursES(payroll.horasFestivas)} h en festivo × {formatCurrency(activeYearRate.horaOrdinaria)}/h (aparte del salario base)
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.horasFestivasAmount)}</span>
              </div>
            )}

            {payroll.horasFT > 0 && payroll.horasFTAmount > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Horas F/T (Fiesta / Trabajo)</p>
                  <p className="text-[10px] text-teal-700">
                    {formatHoursES(payroll.horasFT)} h en días F/T × {formatCurrency(activeYearRate.horaOrdinaria)}/h (aparte del salario base)
                  </p>
                </div>
                <span className="font-bold font-mono text-teal-700">+{formatCurrency(payroll.horasFTAmount)}</span>
              </div>
            )}

            {payroll.plusRetenCount > 0 && payroll.plusRetenAmount > 0 && (
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

            {payroll.plusPuntualidadCount > 0 && payroll.plusPuntualidadAmount > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Puntualidad e Inicio Temprano</p>
                  <p className="text-[10px] text-slate-400">
                    {payroll.plusPuntualidadCount} {payroll.plusPuntualidadCount === 1 ? 'día marcado' : 'días marcados'} × {formatCurrency(activeYearRate.plusPuntualidadDia ?? 12.00)}/día
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusPuntualidadAmount)}</span>
              </div>
            )}

            {payroll.prorrataPagasExtra > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-slate-800">
                      Prorrata Pagas Extras ({prorrataNumPagas === 1 ? 'Marzo' : 'Marzo, Julio, Dic.'})
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${hasPartialContractPeriod ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                      {hasPartialContractPeriod
                        ? `Del ${payroll.periodStartDay ?? 1} al ${payroll.periodEndDay ?? payroll.totalDays} (${liquidatedDaysDisplay} días)`
                        : `Mes natural (${payroll.totalDays} días)`}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {`${prorrataNumPagas} ${prorrataNumPagas === 1 ? 'paga prorrateada' : 'pagas prorrateadas'} (${payroll.prorrataDays.toFixed(2).replace('.', ',')} días × ${formatCurrency(prorrataDailyDisplayRate)}/día = ${formatCurrency(prorrataPerPaga)} c/u)`}
                  </p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.prorrataPagasExtra)}</span>
              </div>
            )}

            {payroll.pagaExtraIntegraMes > 0 && (
              <div className="flex items-center justify-between pt-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-emerald-950">{payroll.pagaExtraIntegraNombre || 'Paga Extraordinaria Íntegra'}</p>
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                      Mes natural ({monthName})
                    </span>
                  </div>
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
                    <p className="font-bold text-indigo-950">Horas Complementarias / Exceso</p>
                  </div>
                  <p className="text-[10px] text-indigo-700">
                    {formatHoursES(payroll.horasComplementarias || payroll.horasExtra)} h × {formatCurrency(activeYearRate.horaOrdinaria)}/h
                    {(() => {
                      const parts: string[] = [];
                      if (payroll.horasExcesoMensual > 0) {
                        const usesQuotaThreshold =
                          payroll.vacationDays > 0 &&
                          payroll.umbralComplementariasMes !== undefined &&
                          payroll.umbralComplementariasMes > payroll.convenioMonthlyHoursTarget;
                        const refThreshold = usesQuotaThreshold
                          ? payroll.umbralComplementariasMes!
                          : payroll.convenioMonthlyHoursTarget;
                        parts.push(
                          `${formatHoursES(payroll.horasExcesoMensual)} h exceso s/ ${formatHoursES(refThreshold)} h ${usesQuotaThreshold ? 'cuota fija' : 'teór.'}`
                        );
                      }
                      if (payroll.horasExcesoDiario9h > 0) {
                        parts.push(`${formatHoursES(payroll.horasExcesoDiario9h)} h en turnos >9h`);
                      }
                      const manualExtraHrs = Math.max(
                        0,
                        Math.round(
                          ((payroll.horasComplementarias || 0) -
                            (payroll.horasExcesoMensual || 0) -
                            (payroll.horasExcesoDiario9h || 0)) *
                            100
                        ) / 100
                      );
                      if (manualExtraHrs > 0) {
                        parts.push(`${formatHoursES(manualExtraHrs)} h manuales`);
                      }
                      return parts.length > 0 ? ` (${parts.join(' + ')} en ${payroll.extrasCutoffPeriod})` : ` (en ${payroll.extrasCutoffPeriod})`;
                    })()}
                  </p>
                </div>
                <span className="font-extrabold font-mono text-indigo-900 text-sm">+{formatCurrency(payroll.importeHorasExtra)}</span>
              </div>
            )}

            {(payroll.totalExtrasFueraConvenio > 0 || nonZeroExtrasItems.length > 0 || hasPrevMonthStretch || currentMonthDayRows.length > 0) && (
              <div className="pt-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200/70 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-amber-950">
                        {payroll.totalExtrasFueraConvenio > 0
                          ? 'Complementos y Extras Fuera de Convenio'
                          : 'Desglose Diario de Conceptos y Extras del Período'}
                      </p>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                        {nonZeroExtrasItems.length} {nonZeroExtrasItems.length === 1 ? 'concepto' : 'conceptos'} · {groupedExtrasByDay.length} {groupedExtrasByDay.length === 1 ? 'día' : 'días'}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-800 mt-0.5 leading-snug">
                      Período de extras:{' '}
                      <strong>
                        {formatFullDateES(payroll.extrasCutoffStartDate)} al {formatFullDateES(payroll.extrasCutoffEndDate)} (incluidos)
                      </strong>{' '}
                      · {cutoffModeShortLabel} ({cutoffTotalDays} {cutoffTotalDays === 1 ? 'día' : 'días'})
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Diferenciación: <strong>Salario Base y Pagas Extras</strong> sobre mes natural de {monthName} (01 al {payroll.totalDays}); <strong>pluses y extras</strong> sobre el período elegido.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {payroll.totalExtrasFueraConvenio > 0 ? (
                      <span className="font-bold font-mono text-amber-900">
                        +{formatCurrency(payroll.totalExtrasFueraConvenio)}
                      </span>
                    ) : (
                      <span className="font-bold font-mono text-emerald-800 text-[11px]">
                        Σ {formatCurrency(nonZeroExtrasTotal)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowExtrasDetails(!showExtrasDetails)}
                      className="text-amber-900 hover:text-amber-950 bg-amber-100/70 hover:bg-amber-200/70 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                      title={showExtrasDetails ? 'Ocultar desglose por días' : 'Ver desglose por días'}
                    >
                      <span>{showExtrasDetails ? 'Ocultar' : 'Detalle'}</span>
                      {showExtrasDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Resumen diferenciado por tramos según el ciclo elegido */}
                {hasPrevMonthStretch ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-white/90 rounded-lg border border-amber-200/80 px-2.5 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-amber-950">
                          1. Mes anterior ({prevMonthNameLabel})
                        </p>
                        <p className="text-slate-500">
                          {formatFullDateES(payroll.prevMonthCutoffStartDate)} – {formatFullDateES(payroll.prevMonthCutoffEndDate)}
                          {' · '}
                          <span className={prevMonthRecordDays > 0 ? 'font-semibold text-slate-700' : ''}>
                            {prevMonthStatusLabel}
                          </span>
                        </p>
                      </div>
                      <span className={`font-mono font-extrabold text-xs shrink-0 ${prevMonthExtrasSubtotal > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        +{formatCurrency(prevMonthExtrasSubtotal)}
                      </span>
                    </div>

                    <div className="bg-white/90 rounded-lg border border-amber-200/80 px-2.5 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-blue-950">
                          2. Mes en curso ({monthName})
                        </p>
                        <p className="text-slate-500">
                          {formatFullDateES(payroll.currentMonthCutoffStartDate)} – {formatFullDateES(payroll.currentMonthCutoffEndDate)}
                          {' · '}
                          <span className={currentMonthRecordDays > 0 ? 'font-semibold text-slate-700' : ''}>
                            {currentMonthStatusLabel}
                          </span>
                        </p>
                      </div>
                      <span className={`font-mono font-extrabold text-xs shrink-0 ${currentMonthExtrasSubtotal > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        +{formatCurrency(currentMonthExtrasSubtotal)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/90 rounded-lg border border-emerald-200/80 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-emerald-950 font-semibold">
                      Tramo único en mes natural ({formatFullDateES(payroll.currentMonthCutoffStartDate)} – {formatFullDateES(payroll.currentMonthCutoffEndDate)})
                    </span>
                    <span className="font-mono font-extrabold text-xs text-emerald-700">
                      +{formatCurrency(currentMonthExtrasSubtotal)}
                    </span>
                  </div>
                )}

                {/* Desglose fiable por día (diferenciando tramo del mes anterior y tramo del mes calculado) */}
                {showExtrasDetails && (
                  <div className="pt-2.5 border-t border-amber-200/70 space-y-3 text-[11px] animate-fadeIn">
                    {hasPrevMonthStretch && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                            Parte Mes Anterior · {prevMonthNameLabel} ({formatFullDateES(payroll.prevMonthCutoffStartDate)} – {formatFullDateES(payroll.prevMonthCutoffEndDate)})
                          </span>
                          <span className="font-mono font-bold text-[11px] text-emerald-800">
                            +{formatCurrency(prevMonthExtrasSubtotal)}
                          </span>
                        </div>
                        {prevMonthDayRows.length > 0 ? (
                          <div className="space-y-1.5">
                            {prevMonthDayRows.map((dayGroup) => (
                              <div
                                key={dayGroup.date}
                                className="bg-white/90 rounded-lg border border-amber-200/70 px-2.5 py-2 space-y-1.5"
                              >
                                <div className="flex items-center justify-between border-b border-amber-100 pb-1 gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                                      {formatShortDateES(dayGroup.date)}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-600 truncate">
                                      {dayGroup.dayLabel}
                                    </span>
                                    {dayGroup.items.length > 1 && (
                                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-1.5 py-0.5 rounded shrink-0">
                                        {dayGroup.items.length} extras
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-mono font-extrabold text-[11px] shrink-0 ${dayGroup.dayTotal > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {dayGroup.dayTotal > 0 ? `Total día: +${formatCurrency(dayGroup.dayTotal)}` : '0,00 € extra'}
                                  </span>
                                </div>
                                {dayGroup.items.length > 0 ? (
                                  <div className="space-y-1">
                                    {dayGroup.items.map((item, idx) => (
                                      <div
                                        key={`${dayGroup.date}-${idx}`}
                                        className="flex items-start justify-between gap-2 text-slate-700"
                                      >
                                        <div className="min-w-0">
                                          <p className="font-medium text-slate-800 leading-snug">{item.name}</p>
                                          {item.notes && (
                                            <p className="text-[10px] text-slate-400 leading-tight">{item.notes}</p>
                                          )}
                                        </div>
                                        <span className="font-mono font-bold text-emerald-700 shrink-0">
                                          +{formatCurrency(item.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400">
                                    Día registrado en calendario sin pluses extra adicionales en este tramo.
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white/85 rounded-lg border border-dashed border-amber-300 px-3 py-2.5 text-[10px] text-slate-600 space-y-2">
                            <p>
                              No hay registros guardados en el calendario entre el{' '}
                              <strong>{formatFullDateES(payroll.prevMonthCutoffStartDate)}</strong> y el{' '}
                              <strong>{formatFullDateES(payroll.prevMonthCutoffEndDate)}</strong>.
                            </p>
                            {loggedMonthsSummary.length > 0 && (
                              <div className="pt-1.5 border-t border-amber-200/60 space-y-1.5">
                                <p className="text-amber-900 font-semibold">
                                  Meses con datos encontrados en tu calendario:{' '}
                                  {loggedMonthsSummary
                                    .map((m) => `${MONTHS_FULL_ES[m.month - 1]} ${m.year} (${m.totalDays}d)`)
                                    .join(', ')}.
                                </p>
                                {(() => {
                                  const candidate = loggedMonthsSummary.find((m) => {
                                    if (m.lateDays <= 0) return false;
                                    const tm = m.month === 12 ? 1 : m.month + 1;
                                    const ty = m.month === 12 ? m.year + 1 : m.year;
                                    return !(ty === payroll.year && tm === payroll.month);
                                  });
                                  if (!candidate || !onSelectMonth) return null;
                                  const targetMonth = candidate.month === 12 ? 1 : candidate.month + 1;
                                  const targetYear = candidate.month === 12 ? candidate.year + 1 : candidate.year;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => onSelectMonth(targetMonth, targetYear)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                                    >
                                      <span>
                                        Ver nómina de {MONTHS_FULL_ES[targetMonth - 1]} {targetYear} (incluye 25–{new Date(candidate.year, candidate.month, 0).getDate()} de {MONTHS_FULL_ES[candidate.month - 1]})
                                      </span>
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                          {hasPrevMonthStretch ? `Parte Mes en Curso · ${monthName}` : `Mes Natural · ${monthName}`} ({formatFullDateES(payroll.currentMonthCutoffStartDate)} – {formatFullDateES(payroll.currentMonthCutoffEndDate)})
                        </span>
                        <span className="font-mono font-bold text-[11px] text-emerald-800">
                          +{formatCurrency(currentMonthExtrasSubtotal)}
                        </span>
                      </div>
                      {currentMonthDayRows.length > 0 ? (
                        <div className="space-y-1.5">
                          {currentMonthDayRows.map((dayGroup) => (
                            <div
                              key={dayGroup.date}
                              className="bg-white/90 rounded-lg border border-amber-200/60 px-2.5 py-2 space-y-1.5"
                            >
                              <div className="flex items-center justify-between border-b border-amber-100 pb-1 gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="font-mono text-[10px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                                    {formatShortDateES(dayGroup.date)}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-600 truncate">
                                    {dayGroup.dayLabel}
                                  </span>
                                  {dayGroup.items.length > 1 && (
                                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-1.5 py-0.5 rounded shrink-0">
                                      {dayGroup.items.length} extras
                                    </span>
                                  )}
                                </div>
                                <span className={`font-mono font-extrabold text-[11px] shrink-0 ${dayGroup.dayTotal > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                                  {dayGroup.dayTotal > 0 ? `Total día: +${formatCurrency(dayGroup.dayTotal)}` : '0,00 € extra'}
                                </span>
                              </div>
                              {dayGroup.items.length > 0 ? (
                                <div className="space-y-1">
                                  {dayGroup.items.map((item, idx) => (
                                    <div
                                      key={`${dayGroup.date}-${idx}`}
                                      className="flex items-start justify-between gap-2 text-slate-700"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-medium text-slate-800 leading-snug">{item.name}</p>
                                        {item.notes && (
                                          <p className="text-[10px] text-slate-400 leading-tight">{item.notes}</p>
                                        )}
                                      </div>
                                      <span className="font-mono font-bold text-emerald-700 shrink-0">
                                        +{formatCurrency(item.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400">
                                  Día registrado en calendario sin pluses extra adicionales en este tramo.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white/75 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[10px] text-slate-600">
                          No hay registros introducidos en el calendario entre el{' '}
                          <strong>{formatFullDateES(payroll.currentMonthCutoffStartDate)}</strong> y el{' '}
                          <strong>{formatFullDateES(payroll.currentMonthCutoffEndDate)}</strong>.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 px-1 text-[10px] text-amber-900 font-bold border-t border-amber-200/60">
                      <span>
                        Suma verificada ({formatFullDateES(payroll.extrasCutoffStartDate)} – {formatFullDateES(payroll.extrasCutoffEndDate)}, incluidos)
                      </span>
                      <span className="font-mono text-xs text-emerald-800">+{formatCurrency(nonZeroExtrasTotal)}</span>
                    </div>
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

      <ConfirmModal
        isOpen={showIncompleteValidateConfirm}
        title={`Validar ${monthName} ${selectedYear}`}
        message={`Es posible que aún queden días sin asignar en ${monthName}.\n\nAl validar, se guardará esta nómina con Jornada del ${currentJornadaPercentage}% e IRPF del ${profile.irpfPercentage}%, y se llevará el saldo de horas resultante a los meses siguientes. ¿Deseas validar el mes ahora?`}
        confirmText="Sí, validar y guardar nómina"
        cancelText="Cancelar"
        isDestructive={false}
        onConfirm={() => {
          setShowIncompleteValidateConfirm(false);
          if (onValidateMonth) {
            void onValidateMonth().then((res) => {
              if (res?.message) {
                setValidationToast(res.message);
                window.setTimeout(() => setValidationToast(null), 6000);
              }
            });
          }
        }}
        onCancel={() => setShowIncompleteValidateConfirm(false)}
      />

      <ConfirmModal
        isOpen={showUnvalidateConfirm}
        title={`¿Reabrir nómina de ${monthName} ${selectedYear}?`}
        message={`Esta nómina estaba validada y congelada con Jornada ${validatedMonth?.jornadaPct ?? 100}% e IRPF ${validatedMonth?.irpfPercentage ?? 0}%.\n\nSi la reabres, volverá a calcularse con los parámetros actuales de tu ficha.`}
        confirmText="Sí, reabrir mes"
        cancelText="Mantener validada"
        isDestructive={true}
        onConfirm={() => {
          setShowUnvalidateConfirm(false);
          if (onUnvalidateMonth) {
            void onUnvalidateMonth();
          }
        }}
        onCancel={() => setShowUnvalidateConfirm(false)}
      />
    </div>
  );
};
