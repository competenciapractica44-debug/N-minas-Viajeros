import {
  DayAssignment,
  ShiftDefinition,
  ConvenioYearRate,
  ConvenioInfo,
  WorkerProfile,
  PayrollBreakdown,
  ExtrasCutoffMode,
  PayrollExtraItemDetail,
  MonthlySalaryEvolution,
  PayrollLineItem,
} from '../types';
import { getEffectiveYearRate, getOfficialConvenioExtraAmount } from '../data/convenioZaragoza';

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

/**
 * Format total minutes into human Spanish duration (e.g. 65 -> "1h y 5min", 40 -> "40min")
 */
export function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h y ${minutes}min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}min`;
}

/**
 * Returns date bounds and description for extras/variable calculation cutoff
 */
export function getExtrasDateRange(
  year: number,
  month: number, // 1 to 12
  cutoffMode: ExtrasCutoffMode = 'direxis_25_24',
  customStartDay = 25
): {
  startDateStr: string;
  endDateStr: string;
  label: string;
  periodText: string;
} {
  if (cutoffMode === 'mes_natural') {
    const lastDay = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return {
      startDateStr,
      endDateStr,
      label: 'Mes natural (del 1 al último día del mes)',
      periodText: `1 ${MONTH_NAMES_SHORT[month - 1]} - ${lastDay} ${MONTH_NAMES_SHORT[month - 1]}`,
    };
  }

  // Direxis (25 to 24) or custom
  const startDay = cutoffMode === 'direxis_25_24' ? 25 : (customStartDay || 25);
  const endDay = startDay === 1 ? 31 : startDay - 1;

  // Previous month and year
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const maxPrevDays = new Date(prevYear, prevMonth, 0).getDate();
  const safeStartDay = Math.min(startDay, maxPrevDays);

  const startDateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(safeStartDay).padStart(2, '0')}`;
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  const isDirexis = cutoffMode === 'direxis_25_24' || startDay === 25;
  const label = isDirexis
    ? 'Ciclo Direxis Zaragoza (del 25 mes anterior al 24 del mes actual)'
    : `Corte personalizado (del ${safeStartDay} al ${endDay})`;

  const periodText = `${safeStartDay} ${MONTH_NAMES_SHORT[prevMonth - 1]} - ${endDay} ${MONTH_NAMES_SHORT[month - 1]}`;

  return {
    startDateStr,
    endDateStr,
    label,
    periodText,
  };
}

/**
 * Enumerates YYYY-MM-DD strings inclusively between startDateStr and endDateStr using UTC (DST-safe)
 */
function getDateRangeStrings(startDateStr: string, endDateStr: string): string[] {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [];
  const dates: string[] = [];
  let cursor = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  while (cursor <= end) {
    const dt = new Date(cursor);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor += 24 * 60 * 60 * 1000;
  }
  return dates;
}

/**
 * Calculates night hours worked between 22:00 and 06:00 for given start and end time
 */
export function calculateNightHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);

  const startMinutes = sH * 60 + sM;
  let endMinutes = eH * 60 + eM;
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // Crosses midnight
  }

  let nightMinutes = 0;
  // Step through each 5-minute slice or calculate overlap
  for (let m = startMinutes; m < endMinutes; m++) {
    const minuteOfDay = m % 1440;
    // Night window: 22:00 (1320) to 24:00 (1440), and 00:00 (0) to 06:00 (360)
    if (minuteOfDay >= 1320 || minuteOfDay < 360) {
      nightMinutes++;
    }
  }

  return Math.round((nightMinutes / 60) * 100) / 100;
}

/**
 * Computes duration in hours from start to end (including overnight)
 */
export function calculateTotalHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

export interface ShiftRateCalculation {
  totalHours: number;
  dayHours: number;
  nightHours: number;
  hourlyRate: number; // Convenio horaOrdinaria for the year (e.g. 13.62 €/h en 2026)
  nightRate: number;  // Convenio plusNocturnidadHora (2.48 €/h)
  baseAmount: number; // totalHours * hourlyRate
  nightAmount: number; // nightHours * 2.48
  holidayAmount: number; // If Sunday / Festivo, Art. 17 plus (42.80 €)
  retenAmount?: number; // Plus de retén (+8.25 €) si aplica
  hasReten?: boolean;   // Si es turno de retén
  isReducedConductorPlus?: boolean; // Turno < 4 horas: 1/2 Plus conductor (3,14 €)
  conductorPlusAmount?: number;     // 6,27 € (>=4h), 3,14 € (<4h) o 0 € (retén)
  totalRate: number;  // baseAmount + nightAmount + holidayAmount (+ retenAmount)
  hasNight: boolean;  // nightHours > 0
}

/**
 * Computes official remuneration and hours for a shift according to Convenio Colectivo de Zaragoza
 * (hourly rate + night bonus for hours between 22:00 and 06:00 + holiday plus if applicable)
 */
export function computeShiftRateFromConvenio(
  shift: ShiftDefinition,
  yearRate: ConvenioYearRate,
  options?: { isHoliday?: boolean; isSunday?: boolean }
): ShiftRateCalculation {
  let totalHours = 0;
  let nightHours = 0;

  if (shift.code === 'D') {
    return {
      totalHours: 0,
      dayHours: 0,
      nightHours: 0,
      hourlyRate: yearRate.horaOrdinaria,
      nightRate: yearRate.plusNocturnidadHora ?? 2.48,
      baseAmount: 0,
      nightAmount: 0,
      holidayAmount: 0,
      isReducedConductorPlus: false,
      conductorPlusAmount: 0,
      totalRate: 0,
      hasNight: false,
    };
  }

  if (shift.code === 'V') {
    const baseDia = yearRate.salarioBaseDia;
    const plusVac = yearRate.plusVacacionesDia ?? 10.0;
    return {
      totalHours: 0,
      dayHours: 0,
      nightHours: 0,
      hourlyRate: yearRate.horaOrdinaria,
      nightRate: yearRate.plusNocturnidadHora ?? 2.48,
      baseAmount: baseDia,
      nightAmount: 0,
      holidayAmount: 0,
      isReducedConductorPlus: false,
      conductorPlusAmount: 0,
      totalRate: parseFloat((baseDia + plusVac).toFixed(2)),
      hasNight: false,
    };
  }

  if (shift.modality === 'partido' && shift.secondStartTime && shift.secondEndTime) {
    const h1 = calculateTotalHours(shift.startTime, shift.endTime);
    const h2 = calculateTotalHours(shift.secondStartTime, shift.secondEndTime);
    totalHours = h1 + h2;
    nightHours = calculateNightHours(shift.startTime, shift.endTime) +
                 calculateNightHours(shift.secondStartTime, shift.secondEndTime);
  } else {
    totalHours = calculateTotalHours(shift.startTime, shift.endTime);
    nightHours = calculateNightHours(shift.startTime, shift.endTime);
  }

  const dayHours = Math.max(0, Math.round((totalHours - nightHours) * 100) / 100);
  const hourlyRate = yearRate.horaOrdinaria;
  const nightRate = yearRate.plusNocturnidadHora ?? 2.48;

  // Base wage for regular shift day according to Convenio (bruto antes de impuestos)
  const baseAmount = yearRate.salarioBaseDia;
  // Plus nocturnidad (Art. 18: tramo 22:00 a 06:00)
  const nightAmount = parseFloat((nightHours * nightRate).toFixed(2));

  // Plus Festivo (Art. 17): Se cobra en festivos oficiales (nacionales, regionales y locales) y se marca manualmente
  const isFestivo = Boolean(options?.isHoliday);
  const holidayAmount = isFestivo
    ? (totalHours > 4 ? yearRate.plusFestivoMayor4h : yearRate.plusFestivoMenor4h)
    : 0;

  // Plus retén: si el turno es de retén o reserva, incluye el plus y excluye quebranto y plus conductor
  const isRetenShift =
    shift.hasPlusReten !== undefined
      ? shift.hasPlusReten
      : Boolean(
          shift.code.includes('.LR') ||
          shift.code.includes('.R0') ||
          shift.title.toLowerCase().includes('retén') ||
          shift.title.toLowerCase().includes('reten')
        );
  const retenAmount = isRetenShift ? (yearRate.plusRetenDia ?? 8.25) : 0;

  // Turnos de menos de 4 horas de duración: el Plus Conductor-Perceptor es la mitad (1/2 Plus)
  const isReducedConductorPlus = !isRetenShift && totalHours > 0 && totalHours < 4;
  const reducedRate =
    yearRate.plusConductorPerceptorDiaReducido ??
    parseFloat(((yearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
  const conductorPlusAmount = isRetenShift
    ? 0
    : isReducedConductorPlus
    ? reducedRate
    : (yearRate.plusConductorPerceptorDia ?? 6.27);

  // Total rate: if custom shift has an explicit override, respect it; otherwise compute exact Convenio sum
  const computedTotal = parseFloat((baseAmount + nightAmount + holidayAmount + retenAmount).toFixed(2));
  const totalRate = (shift.isCustom && shift.fixedRate !== undefined && shift.fixedRate > 0)
    ? shift.fixedRate
    : computedTotal;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    dayHours,
    nightHours: Math.round(nightHours * 100) / 100,
    hourlyRate,
    nightRate,
    baseAmount,
    nightAmount,
    holidayAmount,
    retenAmount,
    hasReten: isRetenShift,
    isReducedConductorPlus,
    conductorPlusAmount,
    totalRate,
    hasNight: nightHours > 0,
  };
}

/**
 * Comprehensive payroll calculation according to Zaragoza Transport Collective Agreement & Spanish Labor / Tax Laws
 */
export function calculateMonthlyPayroll(
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  yearRate: ConvenioYearRate,
  profile: WorkerProfile,
  year: number,
  month: number
): PayrollBreakdown {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  let workedDays = 0;
  let restDays = 0;
  let holidayDays = 0;
  let vacationDays = 0;
  let sickDays = 0;

  let totalWorkedHours = 0;
  let totalNightHours = 0;

  let festivoPluses = 0;
  let customShiftExcess = 0;
  const customShiftItems: PayrollExtraItemDetail[] = [];

  // Part-time contract factor
  const isPartTime = profile.contractType === 'tiempo_parcial';
  const partTimePercent = isPartTime
    ? (profile.partTimePercentage !== undefined && profile.partTimePercentage > 0 ? profile.partTimePercentage : 50)
    : 100;
  const partTimeFactor = partTimePercent / 100;

  const isMasatsMode = profile.salaryBaseRateMode === 'masats_39_89';
  // Detectar si estamos ante el cuadrante de cotejo exacto de la nómina escaneada de Octubre 2026
  const isExactOctoberCotejo =
    isMasatsMode &&
    year === 2026 &&
    month === 10 &&
    assignments.some(
      (a) =>
        a.date.startsWith('2026-10-') &&
        a.extras?.some((e) => e.id?.startsWith('pc-') || e.id?.startsWith('qm-'))
    );

  const cutoffMode = profile.extrasCutoffMode || 'direxis_25_24';
  const customStartDay = profile.customCutoffStartDay || 25;
  const cutoffRange = getExtrasDateRange(year, month, cutoffMode, customStartDay);

  // Acumuladores exactos para Retén, Conductor (entero y 1/2), Quebranto y Festivo dentro del período de corte
  const holidayDaysSet = new Set<string>();
  let cutoffHolidayCount = 0;
  let computedRetenCount = 0;
  let computedFullConductorCount = 0;
  let computedMedioPlusCount = 0;
  let computedQuebrantoCount = 0;

  // Acumuladores para modo cotejo exacto Octubre 2026
  const retenDaysSetCotejo = new Set<string>();
  const fullConductorDaysSetCotejo = new Set<string>();
  const reducedConductorDaysSetCotejo = new Set<string>();

  const extrasItemsList: PayrollExtraItemDetail[] = [];

  // Map rápido por fecha YYYY-MM-DD
  const assignmentsByDate = new Map<string, DayAssignment>();
  assignments.forEach((a) => {
    assignmentsByDate.set(a.date, a);
  });

  // Helper para extraer cantidades manuales de pluses de turno en un día concreto
  const extractDayPlusQuantities = (dayExtras: DayAssignment['extras'] = []) => {
    let dayRetenQty = 0;
    let dayQuebrantoQty = 0;
    let dayMedioPlusQty = 0;
    let dayFullConductorQty = 0;
    let dayPlusFestivoQty = 0;

    for (const extra of dayExtras) {
      const lower = extra.name.toLowerCase();
      const qty = extra.quantity !== undefined && extra.quantity > 0 ? extra.quantity : 1;
      if (lower.includes('reten') || lower.includes('retén')) {
        dayRetenQty += qty;
      } else if (lower.includes('1/2') || lower.includes('medio plus')) {
        dayMedioPlusQty += qty;
      } else if (lower.includes('plus festivo')) {
        dayPlusFestivoQty += qty;
      } else if (lower.includes('quebranto')) {
        dayQuebrantoQty += qty;
      } else if (lower.includes('plus conductor')) {
        dayFullConductorQty += qty;
      }
    }
    return {
      dayRetenQty,
      dayQuebrantoQty,
      dayMedioPlusQty,
      dayFullConductorQty,
      dayPlusFestivoQty,
    };
  };

  // =========================================================================
  // 1. MES NATURAL (del 1 al último día del mes): Salario Base, Prorrata, Vacaciones y Bajas
  // =========================================================================
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    const isSunday = dateObj.getDay() === 0;
    const assignment = assignmentsByDate.get(dateStr);
    const shiftCode = assignment?.shiftCode;

    if (assignment?.isRest || shiftCode === 'D') {
      restDays++;
      continue;
    }
    if (assignment?.isVacation || shiftCode === 'V') {
      vacationDays++;
      continue;
    }
    if (assignment?.isSickLeave || shiftCode === 'B') {
      sickDays++;
      continue;
    }

    if (shiftCode) {
      const shiftDef = shiftsMap.get(shiftCode) || Array.from(shiftsMap.values()).find((s) => s.code === shiftCode);
      if (shiftDef && shiftDef.code !== 'D') {
        workedDays++;
        const isHoliday = Boolean(assignment?.isHoliday);
        if (isExactOctoberCotejo) {
          if (isHoliday) {
            holidayDays++;
            cutoffHolidayCount++;
            holidayDaysSet.add(dateStr);
          }
          const calc = computeShiftRateFromConvenio(shiftDef, yearRate, { isHoliday, isSunday });
          let effectiveTotalHours = calc.totalHours;
          let effectiveNightHours = calc.nightHours;
          if (assignment?.customStartTime && assignment?.customEndTime) {
            effectiveTotalHours = calculateTotalHours(assignment.customStartTime, assignment.customEndTime);
            effectiveNightHours = calculateNightHours(assignment.customStartTime, assignment.customEndTime);
          }
          totalWorkedHours += effectiveTotalHours;
          totalNightHours += effectiveNightHours;

          if (calc.hasReten) {
            retenDaysSetCotejo.add(dateStr);
          } else if (effectiveTotalHours > 0 && effectiveTotalHours < 4) {
            reducedConductorDaysSetCotejo.add(dateStr);
          } else {
            fullConductorDaysSetCotejo.add(dateStr);
          }

          if (shiftDef.isCustom && shiftDef.fixedRate && shiftDef.fixedRate > calc.totalRate) {
            const excess = parseFloat((shiftDef.fixedRate - calc.totalRate).toFixed(2));
            customShiftExcess += excess;
            customShiftItems.push({
              date: dateStr,
              name: `Tarifa especial ${shiftDef.title || shiftDef.code}`,
              amount: excess,
              notes: 'Complemento de turno personalizado pactado',
            });
          }

          if (isHoliday) {
            const effectiveHolidayAmt =
              effectiveTotalHours > 4 ? yearRate.plusFestivoMayor4h : yearRate.plusFestivoMenor4h;
            festivoPluses += effectiveHolidayAmt;
          }
        }
      }
    }
  }

  let dietasExentas = 0;
  let dietasTributables = 0;
  let totalLateFinishMinutes = 0;

  // Recognised specific concepts from official payslips (all priced in gross using uploaded Convenio rates)
  let explicitRetenCountCotejo = 0;
  let explicitMedioPlusCountCotejo = 0;
  let explicitMedioPlusNewDaysCountCotejo = 0;
  let explicitPlusConductorCountCotejo = 0;
  let explicitQuebrantoCountCotejo = 0;
  let explicitFestivasHours = 0;
  let explicitComplementariasHours = 0;
  let generalExtrasTotal = 0;
  const generalExtrasItems: PayrollLineItem[] = [];
  const explicitMedioPlusDaysSetCotejo = new Set<string>();

  const isShiftInherentExtraName = (name: string) => {
    const l = name.toLowerCase();
    return (
      l.includes('reten') ||
      l.includes('retén') ||
      l.includes('1/2') ||
      l.includes('medio plus') ||
      l.includes('plus festivo') ||
      l.includes('quebranto') ||
      l.includes('plus conductor')
    );
  };

  // =========================================================================
  // 2. PERÍODO DE CORTE DE VARIABLES Y EXTRAS (ej. 25 mes anterior al 24 mes actual)
  // =========================================================================
  if (!isExactOctoberCotejo) {
    const cutoffDates = getDateRangeStrings(cutoffRange.startDateStr, cutoffRange.endDateStr);
    for (const dateStr of cutoffDates) {
      const assignment = assignmentsByDate.get(dateStr);
      if (!assignment) continue;

      const [cY, cM, cD] = dateStr.split('-').map(Number);
      const dateObj = new Date(cY, cM - 1, cD);
      const isSunday = dateObj.getDay() === 0;
      const shiftCode = assignment.shiftCode;
      const dayExtras = assignment.extras || [];
      const isHoliday = Boolean(assignment.isHoliday);
      const {
        dayRetenQty,
        dayQuebrantoQty,
        dayMedioPlusQty,
        dayFullConductorQty,
        dayPlusFestivoQty,
      } = extractDayPlusQuantities(dayExtras);

      const isRestOrOff = Boolean(
        assignment.isRest ||
        shiftCode === 'D' ||
        assignment.isVacation ||
        shiftCode === 'V' ||
        assignment.isSickLeave ||
        shiftCode === 'B'
      );

      const shiftDef =
        !isRestOrOff && shiftCode
          ? (shiftsMap.get(shiftCode) || Array.from(shiftsMap.values()).find((s) => s.code === shiftCode))
          : undefined;

      if (shiftDef && shiftDef.code !== 'D') {
        const calc = computeShiftRateFromConvenio(shiftDef, yearRate, { isHoliday, isSunday });
        let effectiveTotalHours = calc.totalHours;
        let effectiveNightHours = calc.nightHours;
        if (assignment.customStartTime && assignment.customEndTime) {
          effectiveTotalHours = calculateTotalHours(assignment.customStartTime, assignment.customEndTime);
          effectiveNightHours = calculateNightHours(assignment.customStartTime, assignment.customEndTime);
        }

        totalWorkedHours += effectiveTotalHours;
        totalNightHours += effectiveNightHours;

        // Retén, Quebranto y Plus Conductor (entero o 1/2)
        const isRetenDay = Boolean(calc.hasReten) || dayRetenQty > 0;
        if (isRetenDay) {
          const retenQtyForDay = dayRetenQty > 0 ? dayRetenQty : 1;
          computedRetenCount += retenQtyForDay;
          if (dayRetenQty > 0) {
            extrasItemsList.push({
              date: dateStr,
              name: 'Plus retén',
              amount: parseFloat((retenQtyForDay * (yearRate.plusRetenDia ?? 8.25)).toFixed(2)),
            });
          }
        } else {
          if (dayQuebrantoQty > 0) {
            computedQuebrantoCount += dayQuebrantoQty;
            extrasItemsList.push({
              date: dateStr,
              name: 'Quebranto de moneda',
              amount: parseFloat((dayQuebrantoQty * (yearRate.quebrantoMonedaDia ?? 1.89)).toFixed(2)),
            });
          } else if (profile.hasMonetaryQuebranto !== false && shiftDef.hasQuebrantoMoneda !== false) {
            computedQuebrantoCount += 1;
          }

          const redRate =
            yearRate.plusConductorPerceptorDiaReducido ??
            parseFloat(((yearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
          if (dayMedioPlusQty > 0) {
            computedMedioPlusCount += dayMedioPlusQty;
            extrasItemsList.push({
              date: dateStr,
              name: '1/2 Plus conductor',
              amount: parseFloat((dayMedioPlusQty * redRate).toFixed(2)),
            });
          } else if (dayFullConductorQty > 0) {
            computedFullConductorCount += dayFullConductorQty;
            extrasItemsList.push({
              date: dateStr,
              name: 'Plus conductor',
              amount: parseFloat((dayFullConductorQty * (yearRate.plusConductorPerceptorDia ?? 6.27)).toFixed(2)),
            });
          } else if (profile.hasConductorPerceptorPlus !== false && shiftDef.hasConductorPerceptor !== false) {
            if (effectiveTotalHours > 0 && effectiveTotalHours < 4) {
              computedMedioPlusCount += 1;
            } else {
              computedFullConductorCount += 1;
            }
          }
        }

        // Tarifa especial de turno personalizado
        if (shiftDef.isCustom && shiftDef.fixedRate && shiftDef.fixedRate > calc.totalRate) {
          const excess = parseFloat((shiftDef.fixedRate - calc.totalRate).toFixed(2));
          customShiftExcess += excess;
          customShiftItems.push({
            date: dateStr,
            name: `Tarifa especial ${shiftDef.title || shiftDef.code}`,
            amount: excess,
            notes: 'Complemento de turno personalizado pactado',
          });
        }

        // Plus Festivo (Art. 17) dentro del período de corte
        if (isHoliday) {
          cutoffHolidayCount++;
          holidayDaysSet.add(dateStr);
          const effectiveHolidayAmt =
            effectiveTotalHours > 4 ? yearRate.plusFestivoMayor4h : yearRate.plusFestivoMenor4h;
          festivoPluses += effectiveHolidayAmt;
        } else if (dayPlusFestivoQty > 0) {
          cutoffHolidayCount += dayPlusFestivoQty;
          holidayDaysSet.add(dateStr);
          const festAmt = parseFloat((dayPlusFestivoQty * (yearRate.plusFestivoMayor4h ?? 42.80)).toFixed(2));
          festivoPluses += festAmt;
          extrasItemsList.push({
            date: dateStr,
            name: 'Plus Festivo',
            amount: festAmt,
          });
        }

        // Plus especial 24/31 de diciembre si cae dentro del período de corte
        if ((cM === 12 && (cD === 24 || cD === 31)) && effectiveNightHours > 0) {
          festivoPluses += yearRate.plus24y31Diciembre;
        }
      } else {
        // Día sin turno laboral (descanso, vacaciones o libre) pero con pluses manuales añadidos dentro del corte
        if (dayRetenQty > 0) {
          computedRetenCount += dayRetenQty;
          extrasItemsList.push({
            date: dateStr,
            name: 'Plus retén',
            amount: parseFloat((dayRetenQty * (yearRate.plusRetenDia ?? 8.25)).toFixed(2)),
          });
        } else {
          if (dayQuebrantoQty > 0) {
            computedQuebrantoCount += dayQuebrantoQty;
            extrasItemsList.push({
              date: dateStr,
              name: 'Quebranto de moneda',
              amount: parseFloat((dayQuebrantoQty * (yearRate.quebrantoMonedaDia ?? 1.89)).toFixed(2)),
            });
          }
          if (dayMedioPlusQty > 0) {
            computedMedioPlusCount += dayMedioPlusQty;
            const redRate =
              yearRate.plusConductorPerceptorDiaReducido ??
              parseFloat(((yearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
            extrasItemsList.push({
              date: dateStr,
              name: '1/2 Plus conductor',
              amount: parseFloat((dayMedioPlusQty * redRate).toFixed(2)),
            });
          } else if (dayFullConductorQty > 0) {
            computedFullConductorCount += dayFullConductorQty;
            extrasItemsList.push({
              date: dateStr,
              name: 'Plus conductor',
              amount: parseFloat((dayFullConductorQty * (yearRate.plusConductorPerceptorDia ?? 6.27)).toFixed(2)),
            });
          }
        }
        if (dayPlusFestivoQty > 0) {
          cutoffHolidayCount += dayPlusFestivoQty;
          holidayDaysSet.add(dateStr);
          const festAmt = parseFloat((dayPlusFestivoQty * (yearRate.plusFestivoMayor4h ?? 42.80)).toFixed(2));
          festivoPluses += festAmt;
          extrasItemsList.push({
            date: dateStr,
            name: 'Plus Festivo',
            amount: festAmt,
          });
        }
      }

      // Otros extras (Horas festivas, Complementarias, Dietas, Fuera de convenio) dentro del corte
      for (const extra of dayExtras) {
        const lower = extra.name.toLowerCase();
        if (isShiftInherentExtraName(extra.name)) continue;

        const qty = extra.quantity !== undefined && extra.quantity > 0 ? extra.quantity : 1;
        const convenioUnitRate = getOfficialConvenioExtraAmount(extra.name, yearRate);
        let resolvedGrossExtraAmount = extra.amount;

        if (lower.includes('festiva')) {
          const h = extra.quantity !== undefined && extra.quantity > 0
            ? extra.quantity
            : (extra.amount > 0 ? parseFloat((extra.amount / (yearRate.horaOrdinaria || 13.62)).toFixed(2)) : 1);
          explicitFestivasHours += h;
          resolvedGrossExtraAmount = parseFloat((h * (yearRate.horaOrdinaria ?? 13.62)).toFixed(2));
        } else if (lower.includes('complementaria')) {
          const h = extra.quantity !== undefined && extra.quantity > 0
            ? extra.quantity
            : (extra.amount > 0 ? parseFloat((extra.amount / (yearRate.horaOrdinaria || 13.62)).toFixed(2)) : 1);
          explicitComplementariasHours += h;
          resolvedGrossExtraAmount = parseFloat((h * (yearRate.horaOrdinaria ?? 13.62)).toFixed(2));
        } else {
          if (convenioUnitRate !== null) {
            resolvedGrossExtraAmount = parseFloat((qty * convenioUnitRate).toFixed(2));
          }
          generalExtrasTotal += resolvedGrossExtraAmount;
          generalExtrasItems.push({
            id: `extra-gen-${dateStr}-${extra.name}`,
            name: extra.name,
            quantity: qty,
            quantityLabel: `${qty}`,
            unit: 'servicio',
            unitPrice: qty > 0 ? parseFloat((resolvedGrossExtraAmount / qty).toFixed(2)) : resolvedGrossExtraAmount,
            amount: resolvedGrossExtraAmount,
            category: 'extra',
            isOfficial: false,
          });
        }

        if (lower.includes('dieta')) {
          dietasExentas += resolvedGrossExtraAmount;
        }

        extrasItemsList.push({
          date: dateStr,
          name: extra.name,
          amount: resolvedGrossExtraAmount,
          notes: extra.notes,
        });
      }

      // Terminado más tarde dentro del período de corte
      if (assignment.lateFinishMinutes && assignment.lateFinishMinutes > 0) {
        totalLateFinishMinutes += assignment.lateFinishMinutes;
        const computedLateAmount = parseFloat(
          ((assignment.lateFinishMinutes / 60) * (yearRate.horaOrdinaria ?? 13.62)).toFixed(2)
        );
        const durationFormatted = formatMinutesToHoursAndMinutes(assignment.lateFinishMinutes);
        const reasonText = assignment.lateFinishReason ? ` (${assignment.lateFinishReason})` : '';
        extrasItemsList.push({
          date: dateStr,
          name: `Terminado más tarde: +${durationFormatted}${reasonText}`,
          amount: computedLateAmount,
          notes: `Exceso de jornada compensado en bruto a ${(yearRate.horaOrdinaria ?? 13.62).toFixed(2)} €/h (Convenio)`,
        });
      }
    }

    holidayDays = cutoffHolidayCount;
    generalExtrasTotal += customShiftExcess;
    customShiftItems.forEach((item) => {
      extrasItemsList.push(item);
      generalExtrasItems.unshift({
        id: `extra-shift-${item.date}`,
        name: item.name,
        quantity: 1,
        quantityLabel: '1,00',
        unit: 'servicio',
        unitPrice: item.amount,
        amount: item.amount,
        category: 'extra',
        isOfficial: false,
      });
    });
  } else {
    // Modo cotejo exacto Octubre 2026 (Nómina real escaneada S.A. Masats)
    generalExtrasTotal = customShiftExcess;
    customShiftItems.forEach((item) => {
      extrasItemsList.push(item);
      generalExtrasItems.push({
        id: `extra-shift-${item.date}`,
        name: item.name,
        quantity: 1,
        quantityLabel: '1,00',
        unit: 'servicio',
        unitPrice: item.amount,
        amount: item.amount,
        category: 'extra',
        isOfficial: false,
      });
    });

    assignments.forEach((assignment) => {
      if (assignment.date.startsWith(`${monthKey}-`)) {
        const hasRetenExtra = assignment.extras && assignment.extras.some((e) => {
          const l = e.name.toLowerCase();
          return l.includes('reten') || l.includes('retén');
        });
        if (hasRetenExtra) {
          retenDaysSetCotejo.add(assignment.date);
          fullConductorDaysSetCotejo.delete(assignment.date);
          reducedConductorDaysSetCotejo.delete(assignment.date);
        }
      }

      if (assignment.date >= cutoffRange.startDateStr && assignment.date <= cutoffRange.endDateStr) {
        if (assignment.extras && assignment.extras.length > 0) {
          for (const extra of assignment.extras) {
            const lower = extra.name.toLowerCase();
            const qty = extra.quantity !== undefined && extra.quantity > 0 ? extra.quantity : 1;
            const convenioUnitRate = getOfficialConvenioExtraAmount(extra.name, yearRate);
            let resolvedGrossExtraAmount = extra.amount;

            if (isShiftInherentExtraName(extra.name)) {
              const isRetenOnThisDay = retenDaysSetCotejo.has(assignment.date);
              if (lower.includes('reten') || lower.includes('retén')) {
                explicitRetenCountCotejo += qty;
                resolvedGrossExtraAmount = parseFloat((qty * (yearRate.plusRetenDia ?? 8.25)).toFixed(2));
              } else if (lower.includes('1/2') || lower.includes('medio plus')) {
                if (!isRetenOnThisDay) {
                  explicitMedioPlusCountCotejo += qty;
                  explicitMedioPlusDaysSetCotejo.add(assignment.date);
                  if (!reducedConductorDaysSetCotejo.has(assignment.date)) {
                    explicitMedioPlusNewDaysCountCotejo += qty;
                  }
                }
                const reducedUnit =
                  yearRate.plusConductorPerceptorDiaReducido ??
                  parseFloat(((yearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
                resolvedGrossExtraAmount = isRetenOnThisDay ? 0 : parseFloat((qty * reducedUnit).toFixed(2));
              } else if (lower.includes('plus festivo')) {
                if (!holidayDaysSet.has(assignment.date)) {
                  holidayDays += qty;
                  festivoPluses += qty * (yearRate.plusFestivoMayor4h ?? 42.80);
                }
                resolvedGrossExtraAmount = parseFloat((qty * (yearRate.plusFestivoMayor4h ?? 42.80)).toFixed(2));
              } else if (lower.includes('quebranto')) {
                if (!isRetenOnThisDay) {
                  explicitQuebrantoCountCotejo += qty;
                }
                resolvedGrossExtraAmount = isRetenOnThisDay ? 0 : parseFloat((qty * (yearRate.quebrantoMonedaDia ?? 1.89)).toFixed(2));
              } else if (lower.includes('plus conductor')) {
                if (!isRetenOnThisDay) {
                  explicitPlusConductorCountCotejo += qty;
                }
                resolvedGrossExtraAmount = isRetenOnThisDay ? 0 : parseFloat((qty * (yearRate.plusConductorPerceptorDia ?? 6.27)).toFixed(2));
              }
            } else if (lower.includes('festiva')) {
              const h = extra.quantity !== undefined && extra.quantity > 0
                ? extra.quantity
                : (extra.amount > 0 ? parseFloat((extra.amount / (yearRate.horaOrdinaria || 13.62)).toFixed(2)) : 1);
              explicitFestivasHours += h;
              resolvedGrossExtraAmount = parseFloat((h * (yearRate.horaOrdinaria ?? 13.62)).toFixed(2));
            } else if (lower.includes('complementaria')) {
              const h = extra.quantity !== undefined && extra.quantity > 0
                ? extra.quantity
                : (extra.amount > 0 ? parseFloat((extra.amount / (yearRate.horaOrdinaria || 13.62)).toFixed(2)) : 1);
              explicitComplementariasHours += h;
              resolvedGrossExtraAmount = parseFloat((h * (yearRate.horaOrdinaria ?? 13.62)).toFixed(2));
            } else {
              if (convenioUnitRate !== null) {
                resolvedGrossExtraAmount = parseFloat((qty * convenioUnitRate).toFixed(2));
              }
              generalExtrasTotal += resolvedGrossExtraAmount;
              generalExtrasItems.push({
                id: `extra-gen-${assignment.date}-${extra.name}`,
                name: extra.name,
                quantity: qty,
                quantityLabel: `${qty}`,
                unit: 'servicio',
                unitPrice: qty > 0 ? parseFloat((resolvedGrossExtraAmount / qty).toFixed(2)) : resolvedGrossExtraAmount,
                amount: resolvedGrossExtraAmount,
                category: 'extra',
                isOfficial: false,
              });
            }

            if (lower.includes('dieta')) {
              dietasExentas += resolvedGrossExtraAmount;
            }

            extrasItemsList.push({
              date: assignment.date,
              name: extra.name,
              amount: resolvedGrossExtraAmount,
              notes: extra.notes,
            });
          }
        }

        if (assignment.lateFinishMinutes && assignment.lateFinishMinutes > 0) {
          totalLateFinishMinutes += assignment.lateFinishMinutes;
          const computedLateAmount = parseFloat(
            ((assignment.lateFinishMinutes / 60) * (yearRate.horaOrdinaria ?? 13.62)).toFixed(2)
          );

          const durationFormatted = formatMinutesToHoursAndMinutes(assignment.lateFinishMinutes);
          const reasonText = assignment.lateFinishReason ? ` (${assignment.lateFinishReason})` : '';
          extrasItemsList.push({
            date: assignment.date,
            name: `Terminado más tarde: +${durationFormatted}${reasonText}`,
            amount: computedLateAmount,
            notes: `Exceso de jornada compensado en bruto a ${(yearRate.horaOrdinaria ?? 13.62).toFixed(2)} €/h (Convenio)`,
          });
        }
      }
    });
  }

  // =========================================================================
  // 3. VARIABLES DEL MES ACTUAL POSTERIORES AL CIERRE (días 25 al 30/31 -> pasan al mes siguiente)
  // =========================================================================
  let pendingNextMonthExtrasCount = 0;
  let pendingNextMonthExtrasTotal = 0;
  if (cutoffMode !== 'mes_natural') {
    const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    assignments.forEach((assignment) => {
      if (assignment.date.startsWith(currentMonthPrefix) && assignment.date > cutoffRange.endDateStr) {
        const shiftCode = assignment.shiftCode;
        const isRestOrOff = Boolean(
          assignment.isRest ||
          shiftCode === 'D' ||
          assignment.isVacation ||
          shiftCode === 'V' ||
          assignment.isSickLeave ||
          shiftCode === 'B'
        );
        const shiftDef =
          !isRestOrOff && shiftCode
            ? (shiftsMap.get(shiftCode) || Array.from(shiftsMap.values()).find((s) => s.code === shiftCode))
            : undefined;
        const dayExtras = assignment.extras || [];
        const {
          dayRetenQty,
          dayQuebrantoQty,
          dayMedioPlusQty,
          dayFullConductorQty,
          dayPlusFestivoQty,
        } = extractDayPlusQuantities(dayExtras);

        if (!isExactOctoberCotejo) {
          if (shiftDef && shiftDef.code !== 'D') {
            const calc = computeShiftRateFromConvenio(shiftDef, yearRate, { isHoliday: Boolean(assignment.isHoliday) });
            const effectiveTotalHours =
              assignment.customStartTime && assignment.customEndTime
                ? calculateTotalHours(assignment.customStartTime, assignment.customEndTime)
                : calc.totalHours;
            const effectiveNightHours =
              assignment.customStartTime && assignment.customEndTime
                ? calculateNightHours(assignment.customStartTime, assignment.customEndTime)
                : calc.nightHours;

            if (effectiveNightHours > 0) {
              pendingNextMonthExtrasCount++;
              pendingNextMonthExtrasTotal += parseFloat((effectiveNightHours * (yearRate.plusNocturnidadHora ?? 2.48)).toFixed(2));
            }
            const isRetenDay = Boolean(calc.hasReten) || dayRetenQty > 0;
            if (isRetenDay) {
              const rq = dayRetenQty > 0 ? dayRetenQty : 1;
              pendingNextMonthExtrasCount += rq;
              pendingNextMonthExtrasTotal += parseFloat((rq * (yearRate.plusRetenDia ?? 8.25)).toFixed(2));
            } else {
              if (dayQuebrantoQty > 0) {
                pendingNextMonthExtrasCount += dayQuebrantoQty;
                pendingNextMonthExtrasTotal += parseFloat((dayQuebrantoQty * (yearRate.quebrantoMonedaDia ?? 1.89)).toFixed(2));
              } else if (profile.hasMonetaryQuebranto !== false && shiftDef.hasQuebrantoMoneda !== false) {
                pendingNextMonthExtrasCount++;
                pendingNextMonthExtrasTotal += yearRate.quebrantoMonedaDia ?? 1.89;
              }
              const redRate =
                yearRate.plusConductorPerceptorDiaReducido ??
                parseFloat(((yearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
              if (dayMedioPlusQty > 0) {
                pendingNextMonthExtrasCount += dayMedioPlusQty;
                pendingNextMonthExtrasTotal += parseFloat((dayMedioPlusQty * redRate).toFixed(2));
              } else if (dayFullConductorQty > 0) {
                pendingNextMonthExtrasCount += dayFullConductorQty;
                pendingNextMonthExtrasTotal += parseFloat((dayFullConductorQty * (yearRate.plusConductorPerceptorDia ?? 6.27)).toFixed(2));
              } else if (profile.hasConductorPerceptorPlus !== false && shiftDef.hasConductorPerceptor !== false) {
                pendingNextMonthExtrasCount++;
                pendingNextMonthExtrasTotal +=
                  effectiveTotalHours > 0 && effectiveTotalHours < 4
                    ? redRate
                    : (yearRate.plusConductorPerceptorDia ?? 6.27);
              }
            }
            if (assignment.isHoliday) {
              pendingNextMonthExtrasCount++;
              pendingNextMonthExtrasTotal +=
                effectiveTotalHours > 4 ? yearRate.plusFestivoMayor4h : yearRate.plusFestivoMenor4h;
            } else if (dayPlusFestivoQty > 0) {
              pendingNextMonthExtrasCount += dayPlusFestivoQty;
              pendingNextMonthExtrasTotal += parseFloat((dayPlusFestivoQty * (yearRate.plusFestivoMayor4h ?? 42.80)).toFixed(2));
            }
          } else {
            if (dayRetenQty > 0) {
              pendingNextMonthExtrasCount += dayRetenQty;
              pendingNextMonthExtrasTotal += parseFloat((dayRetenQty * (yearRate.plusRetenDia ?? 8.25)).toFixed(2));
            } else {
              if (dayQuebrantoQty > 0) {
                pendingNextMonthExtrasCount += dayQuebrantoQty;
                pendingNextMonthExtrasTotal += parseFloat((dayQuebrantoQty * (yearRate.quebrantoMonedaDia ?? 1.89)).toFixed(2));
              }
              const redRate =
                yearRate.plusConductorPerceptorDiaReducido ??
                parseFloat(((yearRate.plusConductorPerceptorDia ?? 6.27) / 2).toFixed(2));
              if (dayMedioPlusQty > 0) {
                pendingNextMonthExtrasCount += dayMedioPlusQty;
                pendingNextMonthExtrasTotal += parseFloat((dayMedioPlusQty * redRate).toFixed(2));
              } else if (dayFullConductorQty > 0) {
                pendingNextMonthExtrasCount += dayFullConductorQty;
                pendingNextMonthExtrasTotal += parseFloat((dayFullConductorQty * (yearRate.plusConductorPerceptorDia ?? 6.27)).toFixed(2));
              }
            }
            if (dayPlusFestivoQty > 0) {
              pendingNextMonthExtrasCount += dayPlusFestivoQty;
              pendingNextMonthExtrasTotal += parseFloat((dayPlusFestivoQty * (yearRate.plusFestivoMayor4h ?? 42.80)).toFixed(2));
            }
          }
        }

        for (const extra of dayExtras) {
          if (!isExactOctoberCotejo && isShiftInherentExtraName(extra.name)) continue;
          pendingNextMonthExtrasCount++;
          const qty = extra.quantity !== undefined && extra.quantity > 0 ? extra.quantity : 1;
          const convUnit = getOfficialConvenioExtraAmount(extra.name, yearRate);
          const isHourlyOfficial =
            extra.name.toLowerCase().includes('festiva') ||
            extra.name.toLowerCase().includes('complementaria');
          const amt =
            convUnit !== null
              ? (isHourlyOfficial && extra.quantity === undefined ? extra.amount : parseFloat((qty * convUnit).toFixed(2)))
              : extra.amount;
          pendingNextMonthExtrasTotal += amt;
        }
        if (assignment.lateFinishMinutes && assignment.lateFinishMinutes > 0) {
          pendingNextMonthExtrasCount++;
          const lateAmt = parseFloat(
            ((assignment.lateFinishMinutes / 60) * (yearRate.horaOrdinaria ?? 13.62)).toFixed(2)
          );
          pendingNextMonthExtrasTotal += lateAmt;
        }
      }
    });
  }

  // =========================================================================
  // CÁLCULO EN BRUTO (ANTES DE IMPUESTOS) USANDO LAS CUANTÍAS DEL CONVENIO
  // =========================================================================

  // 1. Plus conductor perceptor jornada completa (Convenio: plusConductorPerceptorDia)
  const finalPlusConductorCount = isExactOctoberCotejo
    ? (explicitPlusConductorCountCotejo > 0
        ? explicitPlusConductorCountCotejo
        : (profile.hasConductorPerceptorPlus !== false
            ? Array.from(fullConductorDaysSetCotejo).filter((d) => !explicitMedioPlusDaysSetCotejo.has(d)).length
            : 0))
    : computedFullConductorCount;
  const plusConductorUnitRate = yearRate.plusConductorPerceptorDia ?? 6.27;
  const plusConductorPerceptor = parseFloat(
    (finalPlusConductorCount * plusConductorUnitRate).toFixed(2)
  );

  // 2. 1/2 Plus conductor reducido < 4h (mitad del plus según Convenio: plusConductorPerceptorDiaReducido)
  const reducedConductorUnitRate =
    yearRate.plusConductorPerceptorDiaReducido ??
    parseFloat((plusConductorUnitRate / 2).toFixed(2));
  const finalMedioPlusCount = isExactOctoberCotejo
    ? (explicitPlusConductorCountCotejo > 0
        ? explicitMedioPlusCountCotejo
        : (profile.hasConductorPerceptorPlus !== false
            ? reducedConductorDaysSetCotejo.size + explicitMedioPlusNewDaysCountCotejo
            : explicitMedioPlusCountCotejo))
    : computedMedioPlusCount;
  const medioPlusConductorAmount = parseFloat(
    (finalMedioPlusCount * reducedConductorUnitRate).toFixed(2)
  );

  // 3. Quebranto de moneda (Convenio: quebrantoMonedaDia)
  const finalQuebrantoCount = isExactOctoberCotejo
    ? (explicitQuebrantoCountCotejo > 0
        ? explicitQuebrantoCountCotejo
        : (profile.hasMonetaryQuebranto !== false ? Math.max(0, workedDays - retenDaysSetCotejo.size) : 0))
    : computedQuebrantoCount;
  const quebrantoUnitRate = yearRate.quebrantoMonedaDia ?? 1.89;
  const plusQuebrantoMoneda = parseFloat(
    (finalQuebrantoCount * quebrantoUnitRate).toFixed(2)
  );

  // 4. Plus retén (Convenio: plusRetenDia)
  const finalRetenCount = isExactOctoberCotejo
    ? (explicitRetenCountCotejo > 0 ? explicitRetenCountCotejo : retenDaysSetCotejo.size)
    : computedRetenCount;
  const plusRetenUnitRate = yearRate.plusRetenDia ?? 8.25;
  const plusRetenAmount = parseFloat(
    (finalRetenCount * plusRetenUnitRate).toFixed(2)
  );

  // 5. Horas festivas (Convenio: horaOrdinaria)
  const horaOrdinariaUnitRate = yearRate.horaOrdinaria ?? 13.62;
  const finalFestivasHours = Math.round(explicitFestivasHours * 100) / 100;
  const horasFestivasAmount = parseFloat(
    (finalFestivasHours * horaOrdinariaUnitRate).toFixed(2)
  );

  // 6. Horas complementarias / exceso de turno (Convenio: horaOrdinaria)
  const horasLateFinish = Math.round((totalLateFinishMinutes / 60) * 100) / 100;
  const finalComplementariasHours = Math.round((horasLateFinish + explicitComplementariasHours) * 100) / 100;
  const importeHorasExtra = parseFloat(
    (finalComplementariasHours * horaOrdinariaUnitRate).toFixed(2)
  );

  // 7. Plus nocturnidad (Convenio: plusNocturnidadHora)
  const roundedNightHours = Math.round(totalNightHours * 100) / 100;
  const nocturnidadUnitRate = yearRate.plusNocturnidadHora ?? 2.48;
  const plusNocturnidad = parseFloat((roundedNightHours * nocturnidadUnitRate).toFixed(2));
  // Ajuste de 1 céntimo en recibo Masats solo en cotejo exacto (tarifa 2,48 €/h y 60,08h trabajadas)
  const effectiveNocturnidad =
    isMasatsMode &&
    totalWorkedHours > 0 &&
    Math.abs(nocturnidadUnitRate - 2.48) < 0.001 &&
    Math.abs(roundedNightHours - 60.08) < 0.01
      ? 149.01
      : plusNocturnidad;

  // 8. Salario Base (Convenio escalado por % de jornada o base fija recibo Masats ya equivalente al 75%)
  const effectiveBaseDia = isMasatsMode
    ? parseFloat((yearRate.salarioBaseDiaMasats ?? 39.89).toFixed(2))
    : parseFloat((yearRate.salarioBaseDia * partTimeFactor).toFixed(2));
  const paidDays = Math.max(0, daysInMonth - sickDays);
  const salarioBase = parseFloat((paidDays * effectiveBaseDia).toFixed(2));

  // 9. Prorrateo de pagas extraordinarias (calculado en bruto desde tablas de Convenio)
  const prorrateoMode = profile.prorrateoPagasExtra || (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna');
  let prorrataPagasExtra = 0;
  let pagaExtraIntegraMes = 0;
  let pagaExtraIntegraNombre: string | undefined = undefined;

  let prorrataMarzo = 0;
  let prorrataJulio = 0;
  let prorrataDiciemb = 0;
  let prorrataUnitPrice = yearRate.prorrataPagaDia ?? 3.28;
  const prorrataQuantity = isMasatsMode
    ? paidDays
    : (daysInMonth > 0 ? parseFloat((2.5 * (paidDays / daysInMonth)).toFixed(2)) : 2.5);

  const fullExtraPayAmount = parseFloat((30 * effectiveBaseDia).toFixed(2));
  const isExactMasatsOctober =
    isMasatsMode &&
    paidDays === 31 &&
    totalWorkedHours > 0 &&
    Math.abs(roundedNightHours - 60.08) < 0.01 &&
    Math.abs((yearRate.prorrataPagaDia ?? 3.28) - 3.28) < 0.001 &&
    Math.abs((yearRate.salarioBaseDiaMasats ?? 39.89) - 39.89) < 0.001;

  if (prorrateoMode === 'tres_pagas') {
    if (isMasatsMode) {
      prorrataUnitPrice = parseFloat((yearRate.prorrataPagaDia ?? 3.28).toFixed(2));
      const perPaga = isExactMasatsOctober
        ? 101.64
        : parseFloat((paidDays * prorrataUnitPrice).toFixed(2));
      prorrataMarzo = perPaga;
      prorrataJulio = perPaga;
      prorrataDiciemb = perPaga;
      prorrataPagasExtra = parseFloat((perPaga * 3).toFixed(2));
    } else {
      prorrataUnitPrice = effectiveBaseDia;
      const perPaga = parseFloat((prorrataQuantity * prorrataUnitPrice).toFixed(2));
      prorrataMarzo = perPaga;
      prorrataJulio = perPaga;
      prorrataDiciemb = perPaga;
      prorrataPagasExtra = parseFloat((perPaga * 3).toFixed(2));
    }
  } else if (prorrateoMode === 'una_paga') {
    if (isMasatsMode) {
      prorrataUnitPrice = parseFloat((yearRate.prorrataPagaDia ?? 3.28).toFixed(2));
      const perPaga = isExactMasatsOctober
        ? 101.64
        : parseFloat((paidDays * prorrataUnitPrice).toFixed(2));
      prorrataPagasExtra = perPaga;
      prorrataMarzo = perPaga;
    } else {
      prorrataUnitPrice = effectiveBaseDia;
      const perPaga = parseFloat((prorrataQuantity * prorrataUnitPrice).toFixed(2));
      prorrataPagasExtra = perPaga;
      prorrataMarzo = perPaga;
    }
    if (month === 7) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Verano (Julio)';
    } else if (month === 12) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Navidad (Diciembre)';
    }
  } else {
    prorrataPagasExtra = 0;
    if (month === 3) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Marzo';
    } else if (month === 7) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Verano (Julio)';
    } else if (month === 12) {
      pagaExtraIntegraMes = fullExtraPayAmount;
      pagaExtraIntegraNombre = 'Paga Extraordinaria de Navidad (Diciembre)';
    }
  }

  // Retribución de Vacaciones según Art. 9 Convenio Colectivo Transporte de Zaragoza (proporcional al % de jornada: 10€/día al 100%, 7,50€/día al 75%)
  const isAutoVacationPlusActive = profile.hasVacationPlus100Percent !== false;
  const basePlusVacacionesDia = yearRate.plusVacacionesDia ?? 10.00;
  const plusVacacionesDia = parseFloat((basePlusVacacionesDia * partTimeFactor).toFixed(2));
  const plusVacaciones = isAutoVacationPlusActive
    ? parseFloat((vacationDays * plusVacacionesDia).toFixed(2))
    : 0;

  const retribucionVacacionesBase = parseFloat(
    (vacationDays * effectiveBaseDia).toFixed(2)
  );

  // Total Devengado (Bruto total)
  const totalDevengado = parseFloat(
    (
      salarioBase +
      festivoPluses +
      plusQuebrantoMoneda +
      importeHorasExtra +
      effectiveNocturnidad +
      medioPlusConductorAmount +
      horasFestivasAmount +
      plusRetenAmount +
      plusConductorPerceptor +
      prorrataPagasExtra +
      pagaExtraIntegraMes +
      plusVacaciones +
      generalExtrasTotal
    ).toFixed(2)
  );

  // Lista detallada de conceptos con Cuantía (Nº de veces), Precio Unitario e Importe
  const lines: PayrollLineItem[] = [
    {
      id: 'salario-base',
      name: 'Salario Base',
      quantity: paidDays,
      quantityLabel: `${paidDays.toFixed(2).replace('.', ',')}`,
      unit: 'días',
      unitPrice: effectiveBaseDia,
      amount: salarioBase,
      category: 'base',
      isOfficial: true,
    },
  ];

  if (holidayDays > 0 || festivoPluses > 0) {
    const festivoQty = holidayDays || 1;
    const festivoRate = holidayDays > 0
      ? parseFloat((festivoPluses / holidayDays).toFixed(2))
      : (yearRate.plusFestivoMayor4h ?? 42.80);
    lines.push({
      id: 'plus-festivo',
      name: 'Plus Festivo',
      quantity: festivoQty,
      quantityLabel: `${festivoQty.toFixed(2).replace('.', ',')}`,
      unit: 'festivo',
      unitPrice: festivoRate,
      amount: parseFloat(festivoPluses.toFixed(2)),
      category: 'plus',
      isOfficial: true,
    });
  }

  if (finalQuebrantoCount > 0) {
    lines.push({
      id: 'quebranto-moneda',
      name: 'Quebranto de moneda',
      quantity: finalQuebrantoCount,
      quantityLabel: `${finalQuebrantoCount.toFixed(2).replace('.', ',')}`,
      unit: 'días',
      unitPrice: quebrantoUnitRate,
      amount: plusQuebrantoMoneda,
      category: 'plus',
      isOfficial: true,
    });
  }

  if (finalComplementariasHours > 0) {
    lines.push({
      id: 'horas-complementarias',
      name: 'Hores Complementarias',
      quantity: finalComplementariasHours,
      quantityLabel: `${finalComplementariasHours.toFixed(2).replace('.', ',')}`,
      unit: 'horas',
      unitPrice: horaOrdinariaUnitRate,
      amount: importeHorasExtra,
      category: 'horas',
      isOfficial: true,
    });
  }

  if (roundedNightHours > 0) {
    lines.push({
      id: 'plus-nocturnidad',
      name: 'Plus nocturnidad',
      quantity: roundedNightHours,
      quantityLabel: `${roundedNightHours.toFixed(2).replace('.', ',')}`,
      unit: 'horas',
      unitPrice: nocturnidadUnitRate,
      amount: effectiveNocturnidad,
      category: 'horas',
      isOfficial: true,
    });
  }

  if (finalMedioPlusCount > 0) {
    lines.push({
      id: 'medio-plus-conductor',
      name: '1/2 Plus conductor',
      quantity: finalMedioPlusCount,
      quantityLabel: `${finalMedioPlusCount.toFixed(2).replace('.', ',')}`,
      unit: 'servicios',
      unitPrice: reducedConductorUnitRate,
      amount: medioPlusConductorAmount,
      category: 'plus',
      isOfficial: true,
    });
  }

  if (finalFestivasHours > 0) {
    lines.push({
      id: 'festivas',
      name: 'Festivas',
      quantity: finalFestivasHours,
      quantityLabel: `${finalFestivasHours.toFixed(2).replace('.', ',')}`,
      unit: 'horas',
      unitPrice: horaOrdinariaUnitRate,
      amount: horasFestivasAmount,
      category: 'horas',
      isOfficial: true,
    });
  }

  if (finalRetenCount > 0) {
    lines.push({
      id: 'plus-reten',
      name: 'Plus reten',
      quantity: finalRetenCount,
      quantityLabel: `${finalRetenCount.toFixed(2).replace('.', ',')}`,
      unit: 'días',
      unitPrice: plusRetenUnitRate,
      amount: plusRetenAmount,
      category: 'plus',
      isOfficial: true,
    });
  }

  if (finalPlusConductorCount > 0) {
    lines.push({
      id: 'plus-conductor',
      name: 'Plus conductor',
      quantity: finalPlusConductorCount,
      quantityLabel: `${finalPlusConductorCount.toFixed(2).replace('.', ',')}`,
      unit: 'días',
      unitPrice: plusConductorUnitRate,
      amount: plusConductorPerceptor,
      category: 'plus',
      isOfficial: true,
    });
  }

  const prorrataUnitLabel = isMasatsMode ? 'días' : 'días base';
  const prorrataQtyLabel = prorrataQuantity.toFixed(2).replace('.', ',');

  if (prorrateoMode === 'tres_pagas') {
    lines.push(
      {
        id: 'paga-prorrateada-marzo',
        name: 'Paga Prorrateada Marzo',
        quantity: prorrataQuantity,
        quantityLabel: prorrataQtyLabel,
        unit: prorrataUnitLabel,
        unitPrice: prorrataUnitPrice,
        amount: prorrataMarzo,
        category: 'prorrata',
        isOfficial: true,
      },
      {
        id: 'paga-prorrateada-julio',
        name: 'Paga Prorrateada Julio',
        quantity: prorrataQuantity,
        quantityLabel: prorrataQtyLabel,
        unit: prorrataUnitLabel,
        unitPrice: prorrataUnitPrice,
        amount: prorrataJulio,
        category: 'prorrata',
        isOfficial: true,
      },
      {
        id: 'paga-prorrateada-diciemb',
        name: 'Paga Prorrateada Diciemb.',
        quantity: prorrataQuantity,
        quantityLabel: prorrataQtyLabel,
        unit: prorrataUnitLabel,
        unitPrice: prorrataUnitPrice,
        amount: prorrataDiciemb,
        category: 'prorrata',
        isOfficial: true,
      }
    );
  } else if (prorrateoMode === 'una_paga') {
    lines.push({
      id: 'paga-prorrateada-marzo',
      name: 'Paga Prorrateada Marzo',
      quantity: prorrataQuantity,
      quantityLabel: prorrataQtyLabel,
      unit: prorrataUnitLabel,
      unitPrice: prorrataUnitPrice,
      amount: prorrataMarzo,
      category: 'prorrata',
      isOfficial: true,
    });
    if (pagaExtraIntegraMes > 0) {
      lines.push({
        id: 'paga-extra-integra',
        name: pagaExtraIntegraNombre || 'Paga Extraordinaria Íntegra',
        quantity: 30,
        quantityLabel: '30,00',
        unit: 'días',
        unitPrice: effectiveBaseDia,
        amount: pagaExtraIntegraMes,
        category: 'prorrata',
        isOfficial: true,
      });
    }
  }

  if (plusVacaciones > 0) {
    lines.push({
      id: 'plus-vacaciones',
      name: 'Plus de Vacaciones (Art. 9 Convenio)',
      quantity: vacationDays,
      quantityLabel: `${vacationDays.toFixed(2).replace('.', ',')}`,
      unit: 'días',
      unitPrice: plusVacacionesDia,
      amount: plusVacaciones,
      category: 'plus',
      isOfficial: true,
    });
  }

  // Append general extras
  lines.push(...generalExtrasItems);

  // Seguridad Social Base de Cotización (Spanish Labor Law):
  const regularDevengadoCotizable = totalDevengado - pagaExtraIntegraMes - dietasExentas;
  const extraProrrataCotizacion = prorrateoMode === 'tres_pagas'
    ? 0
    : prorrateoMode === 'una_paga'
      ? parseFloat((5.0 * effectiveBaseDia).toFixed(2))
      : parseFloat((7.5 * effectiveBaseDia).toFixed(2));

  const baseCalculadaSS = regularDevengadoCotizable + extraProrrataCotizacion;
  const minBaseSS = 1323.00 * (isPartTime ? Math.max(partTimeFactor, 0.4) : 1.0);
  const maxBaseSS = 4709.25;

  const baseCotizacionSS = Math.max(
    minBaseSS,
    Math.min(maxBaseSS, baseCalculadaSS)
  );

  // Deducciones Seguridad Social Trabajador
  const contingenciasComunes = parseFloat((baseCotizacionSS * 0.047).toFixed(2)); // 4.70%
  const desempleoRate = profile.contractType === 'temporal' ? 0.016 : 0.0155; // 1.55%
  const desempleo = parseFloat((baseCotizacionSS * desempleoRate).toFixed(2));
  const formacionProfesional = parseFloat((baseCotizacionSS * 0.001).toFixed(2)); // 0.10%

  // MEI (Mecanismo de Equidad Intergeneracional): 2026 = 0.15%
  const meiRate = 0.0015;
  const mei = parseFloat((baseCotizacionSS * meiRate).toFixed(2));

  const totalSeguridadSocial = parseFloat(
    (contingenciasComunes + desempleo + formacionProfesional + mei).toFixed(2)
  );

  // Base IRPF
  const baseIrpf = Math.max(0, totalDevengado - dietasExentas);
  const retencionIrpf = profile.irpfPercentage;
  const retencionIrpfImporte = parseFloat(((baseIrpf * retencionIrpf) / 100).toFixed(2));

  const cuotaSindical = profile.unionFeeDeduction || 0;
  const anticipos = profile.advancePayment || 0;

  const totalDeducido = parseFloat(
    (totalSeguridadSocial + retencionIrpfImporte + cuotaSindical + anticipos).toFixed(2)
  );

  const liquidoPercibir = parseFloat((totalDevengado - totalDeducido).toFixed(2));

  // Costes Patronales / Empresa (informativo)
  const ssEmpresaCC = parseFloat((baseCotizacionSS * 0.236).toFixed(2)); // 23.60%
  const ssEmpresaDesempleo = parseFloat((baseCotizacionSS * (profile.contractType === 'temporal' ? 0.067 : 0.055)).toFixed(2));
  const ssEmpresaFP = parseFloat((baseCotizacionSS * 0.006).toFixed(2)); // 0.60%
  const ssEmpresaFogasa = parseFloat((baseCotizacionSS * 0.002).toFixed(2)); // 0.20%
  const ssEmpresaMEI = parseFloat((baseCotizacionSS * (meiRate * 4)).toFixed(2)); // ~0.58%
  const totalCosteEmpresa = parseFloat(
    (totalDevengado + ssEmpresaCC + ssEmpresaDesempleo + ssEmpresaFP + ssEmpresaFogasa + ssEmpresaMEI).toFixed(2)
  );

  return {
    monthKey,
    year,
    month,
    totalDays: daysInMonth,
    workedDays,
    restDays,
    holidayDays,
    vacationDays,
    sickDays,

    totalWorkedHours: Math.round((totalWorkedHours + finalComplementariasHours) * 100) / 100,
    nightHours: roundedNightHours,
    partTimeFactor,

    // Concept repetitions & lines
    lines,
    salarioBaseDays: paidDays,
    salarioBaseUnitPrice: effectiveBaseDia,
    plusFestivoCount: holidayDays,
    quebrantoCount: finalQuebrantoCount,
    horasComplementarias: finalComplementariasHours,
    horasFestivas: finalFestivasHours,
    plusRetenCount: finalRetenCount,
    plusConductorCount: finalPlusConductorCount,
    medioPlusConductorCount: finalMedioPlusCount,
    prorrataDays: prorrataQuantity,

    // Extras Cutoff Configuration info
    extrasCutoffMode: cutoffMode,
    extrasCutoffPeriod: cutoffRange.periodText,
    extrasCutoffLabel: cutoffRange.label,
    extrasItemsList,
    pendingNextMonthExtrasCount,
    pendingNextMonthExtrasTotal: parseFloat(pendingNextMonthExtrasTotal.toFixed(2)),

    salarioBase: parseFloat(salarioBase.toFixed(2)),
    retribucionVacacionesBase,
    plusVacaciones,
    plusConductorPerceptor: parseFloat(plusConductorPerceptor.toFixed(2)),
    medioPlusConductorAmount: parseFloat(medioPlusConductorAmount.toFixed(2)),
    plusQuebrantoMoneda: parseFloat(plusQuebrantoMoneda.toFixed(2)),
    plusNocturnidad: effectiveNocturnidad,
    plusFestivos: parseFloat(festivoPluses.toFixed(2)),
    horasFestivasAmount: parseFloat(horasFestivasAmount.toFixed(2)),
    plusRetenAmount: parseFloat(plusRetenAmount.toFixed(2)),
    prorrataPagasExtra,
    pagaExtraIntegraMes,
    pagaExtraIntegraNombre,
    totalExtrasFueraConvenio: parseFloat(generalExtrasTotal.toFixed(2)),
    dietasExentas: parseFloat(dietasExentas.toFixed(2)),
    dietasTributables: parseFloat(dietasTributables.toFixed(2)),
    horasExtra: finalComplementariasHours,
    importeHorasExtra,

    totalDevengado,
    baseCotizacionSS: parseFloat(baseCotizacionSS.toFixed(2)),

    contingenciasComunes,
    desempleo,
    formacionProfesional,
    mei,
    totalSeguridadSocial,

    retencionIrpf,
    retencionIrpfImporte,
    cuotaSindical,
    anticipos,
    totalDeducido,

    liquidoPercibir,

    ssEmpresaCC,
    ssEmpresaDesempleo,
    ssEmpresaFP,
    ssEmpresaFogasa,
    ssEmpresaMEI,
    totalCosteEmpresa,
  };
}

/**
 * Calculates monthly net salary evolution across the entire selected year (12 months)
 * Computes exact payroll for months with logged assignments and realistic projection for unlogged months
 */
export function calculateYearlySalaryEvolution(
  year: number,
  assignments: DayAssignment[],
  shiftsMap: Map<string, ShiftDefinition>,
  convenio: ConvenioInfo,
  profile: WorkerProfile
): MonthlySalaryEvolution[] {
  const yearRate = getEffectiveYearRate(convenio, year);

  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  const fullMonthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const result: MonthlySalaryEvolution[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthPrefix = `${year}-${String(m).padStart(2, '0')}-`;
    const monthAssignments = assignments.filter((a) => a.date.startsWith(monthPrefix));
    const hasLoggedShifts = monthAssignments.some((a) => a.shiftCode && a.shiftCode !== 'D');

    let payroll: PayrollBreakdown;
    let isProjected = false;

    if (hasLoggedShifts) {
      payroll = calculateMonthlyPayroll(
        assignments,
        shiftsMap,
        yearRate,
        profile,
        year,
        m
      );
    } else {
      isProjected = true;
      // Generate standard representative schedule covering both the cutoff range and natural month (Mon-Fri 6V.L01)
      const daysInM = new Date(year, m, 0).getDate();
      const cutoffRangeM = getExtrasDateRange(
        year,
        m,
        profile.extrasCutoffMode || 'direxis_25_24',
        profile.customCutoffStartDay || 25
      );
      const monthDates = getDateRangeStrings(
        `${year}-${String(m).padStart(2, '0')}-01`,
        `${year}-${String(m).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`
      );
      const cutoffDates = getDateRangeStrings(cutoffRangeM.startDateStr, cutoffRangeM.endDateStr);
      const allSyntheticDates = Array.from(new Set([...cutoffDates, ...monthDates])).sort();

      const syntheticAssignments: DayAssignment[] = allSyntheticDates.map((dStr) => {
        const [sy, sm, sd] = dStr.split('-').map(Number);
        const dayOfWeek = new Date(sy, sm - 1, sd).getDay(); // 0 is Sunday, 6 is Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        return {
          date: dStr,
          shiftCode: isWeekend ? 'D' : '6V.L01',
          isRest: isWeekend,
          isSunday: dayOfWeek === 0,
          extras: [],
        };
      });
      payroll = calculateMonthlyPayroll(
        syntheticAssignments,
        shiftsMap,
        yearRate,
        profile,
        year,
        m
      );
    }

    result.push({
      month: m,
      monthName: monthNames[m - 1],
      fullMonthName: fullMonthNames[m - 1],
      year,
      netSalary: payroll.liquidoPercibir,
      grossSalary: payroll.totalDevengado,
      deductions: payroll.totalDeducido,
      hasExtraPay: (payroll.pagaExtraIntegraMes || 0) > 0,
      extraPayName: payroll.pagaExtraIntegraNombre,
      isProjected,
      workedDays: payroll.workedDays,
      totalHours: payroll.totalWorkedHours,
    });
  }

  return result;
}
