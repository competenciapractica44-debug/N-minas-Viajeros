import * as XLSX from 'xlsx-js-style';
import {
  AnnualEditableParams,
  AnnualExtrasPayMode,
  AnnualMonthEditableFields,
  AnnualYearOverrideData,
  ConvenioInfo,
  DayAssignment,
  ShiftDefinition,
  SickLeaveContingencyType,
  ValidatedMonthsMap,
  WorkerProfile,
} from '../types';
import { getEffectiveYearRate, isFTExtraName } from '../data/convenioZaragoza';
import { ALL_INITIAL_SHIFTS } from '../data/defaultTurnos';
import { getOfficialHolidaysForYear } from '../data/spanishHolidays';
import {
  ANNUAL_VACATION_DAYS_CONVENIO,
  AnnualScheduleMonthInput,
  calculateTotalHours,
  computeAnnualHoursSchedule,
  computeShiftRateFromConvenio,
} from './calculator';

export const ANNUAL_MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export interface AnnualMonthBaseRow extends AnnualMonthEditableFields {
  idx: number;
  mes: string;
  extraMes: boolean;
  extraJulDic: boolean;
  horasDiarioMes: number;
  turnosDiarioCount: number;
  bajaDiasPreviosAnioAnterior?: number;
  bajaContiguaAuto?: boolean;
}

export interface AnnualMonthComputedRow extends AnnualMonthBaseRow {
  diasActivos: number;
  // Bloque teórico (cuadre anual a 0 h según Convenio / Días activos)
  horasTeoricasActivas: number;
  horasJustificadasIT: number;
  horasComputoTeorico: number;
  cuotaMes: number;
  saldoMes: number;
  bolsaAcumulada: number;
  // Bloque real (suma mes natural desde Turnos Día o edición manual) y compensación
  horasRealizadas: number;
  horasComplementariasMes: number;
  isHorasManual: boolean;
  tieneRegistroReal: boolean;
  diferenciaRealMes: number;
  bolsaCompensacionAcumulada: number;
  // Bloque económico
  fijoMes: number;
  plusVacMes: number;
  totalBrutoMes: number;
  detalleIT: string;
  rachaInicioDia: number;
  rachaFinDia: number;
  prevMonthHasBaja: boolean;
  bajaEsContinuacionEfectiva: boolean;
  isValidated: boolean;
  effectiveJornadaPct: number;
  validatedIrpf?: number;
}

export interface AnnualLiquidationResult {
  anio: number;
  p: AnnualEditableParams & {
    anio: number;
    factorJornada: number;
  };
  jornadaAnualEfectiva: number;
  cuotaFijaMes: number;
  baseMensualEfectiva: number;
  compMensualEfectiva: number;
  plusVacDiaEfectivo: number;
  brutoFijoAnual: number;
  valorHoraTabla: number;
  horasPorDiaActivo: number;
  totalHabilesCal: number;
  totalVacNat: number;
  totalVacLab: number;
  totalBajaNat: number;
  totalBajaLab: number;
  totalDiasActivos: number;
  // Totales teóricos (cuadre 0)
  sumaHorasTeoricasActivas: number;
  sumaHorasComputoTeorico: number;
  sumaCuotaFija: number;
  sumaSaldoMes: number;
  bolsaAcumuladaFinal: number;
  // Totales reales desde Turnos Día y compensación
  bolsaInicialAnio: number;
  sumaHorasRealizadas: number;
  sumaComplementariasMes: number;
  mesesConTurnosCount: number;
  sumaDiferenciaReal: number;
  bolsaCompensacionFinal: number;
  // Recálculo del resto del año (meses validados + saldo arrastrado + cambios de % jornada)
  validatedMonthsCount: number;
  unvalidatedMonthsCount: number;
  hasJornadaChangeAcrossMonths: boolean;
  saldoArrastradoValidado: number;
  horasRestantesBase: number;
  horasPendientesAjustadasResto: number;
  diasComputoRestantes: number;
  mediaDiariaAjustadaResto: number;
  cuotaMensualAjustadaResto: number;
  // Límites legales sobre jornada anual:
  // - 100% jornada: tope legal máximo de 80 h extras anuales (art. 35.2 ET)
  // - <100% jornada: 30% base complementarias + 15% voluntarias en bloques de 8h con consentimiento
  esJornadaCompleta: boolean;
  limiteComplementarias30Horas: number;
  topeMaximoHoras30Anual: number;
  horasVoluntarias15Anual: number;
  voluntarias15Activas: boolean;
  horasVoluntarias15Activadas: number;
  topeMaximoConVoluntariasAnual: number;
  superaTopeBase30SinVoluntarias: boolean;
  horasPendientesMesesSinRegistro: number;
  horasEstimadasCierreAnual: number;
  horasEstimadasAlRitmoActual: number;
  superaLimite30ConPendientes: boolean;
  riesgoSuperarLimite30PorRitmo: boolean;
  porcentajeLlenadoTope30: number;
  porcentajeEstimadoTope30: number;
  porcentajeMargen30Consumido: number;
  margenRestante30Horas: number;
  // Totales económicos
  sumaFijo: number;
  sumaPlusVac: number;
  sumaTotalBruto: number;
  filas: AnnualMonthComputedRow[];
}

export function getVoluntary8hBlockOptions(max15Hours: number): number[] {
  const maxRounded = Math.round(Math.max(0, max15Hours) * 100) / 100;
  const options: number[] = [];
  const fullBlocksMax = Math.floor(maxRounded / 8) * 8;
  for (let h = 8; h <= fullBlocksMax; h += 8) {
    options.push(h);
  }
  if (maxRounded > fullBlocksMax + 0.01) {
    options.push(maxRounded);
  }
  return options;
}

export function mapProfileExtrasModeToAnnual(profile: WorkerProfile): AnnualExtrasPayMode {
  const mode =
    profile.prorrateoPagasExtra ||
    (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna');
  if (mode === 'ninguna') return 'integras';
  if (mode === 'una_paga') return 'mixta_marzo_prorr';
  return 'prorrateadas';
}

export function mapAnnualExtrasModeToProfile(
  mode: AnnualExtrasPayMode
): 'tres_pagas' | 'una_paga' | 'ninguna' {
  if (mode === 'integras') return 'ninguna';
  if (mode === 'mixta_marzo_prorr') return 'una_paga';
  return 'tres_pagas';
}

/**
 * Derives default parameters for Calendario Anual automatically from RutaNómina's
 * active WorkerProfile & Convenio table for the chosen year.
 */
export function deriveDefaultAnnualParams(
  profile: WorkerProfile,
  convenio: ConvenioInfo,
  year: number
): AnnualEditableParams {
  const yearRate = getEffectiveYearRate(convenio, year);
  const jornadaPct =
    profile.contractType === 'tiempo_parcial'
      ? Math.min(100, Math.max(1, Number(profile.partTimePercentage) || 50))
      : 100;

  const dailyBase =
    profile.salaryBaseRateMode === 'masats_39_89'
      ? yearRate.salarioBaseDiaMasats ?? 39.89
      : yearRate.salarioBaseDia ?? 53.18;

  const baseMes100 = parseFloat((dailyBase * 30).toFixed(2));
  const plusVacDia100 =
    profile.hasVacationPlus === false ? 0 : (yearRate.plusVacacionesDia ?? 10);

  return {
    horasAnuales100: yearRate.horasJornadaAnual || 1776,
    jornadaPct,
    vacReglamentarias: 31,
    baseMes100,
    compMes100: 0,
    numPagas: 15,
    modoExtras: mapProfileExtrasModeToAnnual(profile),
    plusVacDia100,
    repartoBolsa: 'lineal',
    voluntarias15Activas: Boolean(profile.voluntaryHours15Enabled),
    voluntarias15Horas: profile.voluntaryHours15Hours ?? 0,
  };
}

function normalizeDateKeyForAnnual(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim().split('T')[0];
  const m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return trimmed;
}

function resolveShiftForAnnual(
  asg: DayAssignment,
  shiftsByCode: Map<string, ShiftDefinition>,
  shiftsById: Map<string, ShiftDefinition>
): ShiftDefinition | undefined {
  if (asg.shiftSnapshot) {
    return asg.shiftSnapshot;
  }
  const rawCode = asg.shiftCode ? String(asg.shiftCode).trim().replace(/\/L/gi, '') : '';
  if (rawCode) {
    const found = shiftsByCode.get(rawCode.toUpperCase());
    if (found) return found;
  }
  if (asg.shiftId) {
    const foundById = shiftsById.get(String(asg.shiftId).trim());
    if (foundById) return foundById;
  }
  if (rawCode) {
    const upper = rawCode.toUpperCase();
    const fallback = ALL_INITIAL_SHIFTS.find((s) => s.code.trim().toUpperCase() === upper);
    if (fallback) return fallback;
  }
  if (asg.shiftId) {
    const fallbackById = ALL_INITIAL_SHIFTS.find((s) => s.id === asg.shiftId);
    if (fallbackById) return fallbackById;
  }
  return undefined;
}

/**
 * Estimates working days (Mon–Fri) corresponding to a block of natural days,
 * matching standard calendar weeks (5 working days per 7 natural days) and capped
 * by available working days in the month.
 */
export function estimateWorkingDaysFromNatural(
  naturalDays: number,
  maxWorkingDays = 31
): number {
  const nat = Math.max(0, Math.round(Number(naturalDays) || 0));
  if (nat <= 0) return 0;
  const fullWeeks = Math.floor(nat / 7);
  const rem = nat % 7;
  const estimated = fullWeeks * 5 + Math.min(5, rem);
  return Math.max(0, Math.min(Math.max(0, Math.round(maxWorkingDays)), estimated));
}

function isAssignmentSickLeave(asg?: DayAssignment): boolean {
  if (!asg) return false;
  const upperCode = (asg.shiftCode || '').trim().toUpperCase();
  const upperId = (asg.shiftId || '').trim().toUpperCase();
  return Boolean(asg.isSickLeave || upperCode === 'B' || upperId === 'B');
}

/**
 * Computes default 12-month rows from calendar working days (Mon–Fri minus official holidays)
 * plus Vacation ('V'), Sick Leave ('B'), and exact natural-month worked hours from Turnos Día.
 */
export function deriveDefaultAnnualMonths(
  year: number,
  profile: WorkerProfile,
  assignments: DayAssignment[],
  shifts: ShiftDefinition[] = [],
  convenio?: ConvenioInfo,
  validatedMonths?: ValidatedMonthsMap
): AnnualMonthBaseRow[] {
  const yearRate = getEffectiveYearRate(convenio, year);
  const holidaysMap = getOfficialHolidaysForYear(
    year,
    profile.autonomousCommunity || 'aragon',
    profile.locality
  );

  const shiftsByCode = new Map<string, ShiftDefinition>();
  const shiftsById = new Map<string, ShiftDefinition>();
  shifts.forEach((s) => {
    if (s.code) shiftsByCode.set(s.code.trim().toUpperCase(), s);
    if (s.id) shiftsById.set(s.id, s);
  });

  const assignmentByDate = new Map<string, DayAssignment>();
  const prevYearPrefix = `${year - 1}-`;
  const yearPrefix = `${year}-`;
  for (const a of assignments) {
    const key = normalizeDateKeyForAnnual(a.date);
    if (key && (key.startsWith(yearPrefix) || key.startsWith(prevYearPrefix))) {
      assignmentByDate.set(key, { ...a, date: key });
    }
  }

  // Count consecutive trailing sick-leave days ending Dec 31 of previous year
  let prevYearTrailingSickDays = 0;
  for (let offset = 0; offset < 366; offset++) {
    const d = new Date(year - 1, 11, 31 - offset);
    if (d.getFullYear() !== year - 1) break;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    if (isAssignmentSickLeave(assignmentByDate.get(key))) {
      prevYearTrailingSickDays += 1;
    } else {
      break;
    }
  }

  let prevMonthHadSickInDiary = prevYearTrailingSickDays > 0;
  let prevMonthEndedWithSickInDiary = prevYearTrailingSickDays > 0;

  return ANNUAL_MONTH_NAMES.map((mes, idx) => {
    const monthNum = idx + 1;
    const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
    const vRec = validatedMonths?.[monthKey];
    const effectiveYearRateForMonth = vRec?.yearRateSnapshot || yearRate;

    const monthShiftsByCode = new Map(shiftsByCode);
    const monthShiftsById = new Map(shiftsById);
    if (vRec?.shiftsSnapshot && vRec.shiftsSnapshot.length > 0) {
      monthShiftsByCode.clear();
      monthShiftsById.clear();
      vRec.shiftsSnapshot.forEach((s) => {
        if (s.code) monthShiftsByCode.set(s.code.trim().toUpperCase(), s);
        if (s.id) monthShiftsById.set(s.id, s);
      });
    }

    const monthAssignmentByDate = new Map(assignmentByDate);
    if (vRec?.assignmentsSnapshot && vRec.assignmentsSnapshot.length > 0) {
      const mPrefix = `${monthKey}-`;
      vRec.assignmentsSnapshot.forEach((sa) => {
        const key = normalizeDateKeyForAnnual(sa.date);
        if (key && key.startsWith(mPrefix)) {
          monthAssignmentByDate.set(key, { ...sa, date: key });
        }
      });
    }

    const daysInMonth = new Date(year, monthNum, 0).getDate();
    let habilesCal = 0;
    let vacNat = 0;
    let vacLab = 0;
    let bajaNat = 0;
    let bajaLab = 0;
    let horasDiarioMes = 0;
    let turnosDiarioCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dow = new Date(year, monthNum - 1, day).getDay(); // 0=Sun, 6=Sat
      const isWeekday = dow >= 1 && dow <= 5;
      const isHoliday = holidaysMap.has(dateStr);

      if (isWeekday && !isHoliday) {
        habilesCal += 1;
      }

      const asg = monthAssignmentByDate.get(dateStr);
      if (!asg) continue;

      const upperCode = (asg.shiftCode || '').trim().toUpperCase();
      const upperId = (asg.shiftId || '').trim().toUpperCase();

      const isRest = Boolean(asg.isRest || upperCode === 'D' || upperId === 'D');
      const isVac = Boolean(asg.isVacation || upperCode === 'V' || upperId === 'V');
      const isSick = isAssignmentSickLeave(asg);

      if (isVac) {
        vacNat += 1;
        if (isWeekday && !isHoliday) vacLab += 1;
      }
      if (isSick) {
        bajaNat += 1;
        if (isWeekday && !isHoliday) bajaLab += 1;
      }

      // Sumar horas ordinarias realizadas dentro del mes natural (excluyendo festivos / F/T y hasta 9h por turno)
      const isMarkedHoliday = Boolean(
        asg.isHoliday || asg.extras?.some((e) => e.name.toLowerCase().includes('plus festivo'))
      );
      const isMarkedFT = Boolean(asg.extras?.some((e) => isFTExtraName(e.name)));

      if (!isRest && !isVac && !isSick) {
        let dayHours = 0;
        if (asg.customStartTime && asg.customEndTime) {
          turnosDiarioCount += 1;
          dayHours = calculateTotalHours(asg.customStartTime, asg.customEndTime);
        } else if (asg.shiftCode || asg.shiftId) {
          const shiftDef = resolveShiftForAnnual(asg, monthShiftsByCode, monthShiftsById);
          if (shiftDef && shiftDef.code !== 'D' && shiftDef.code !== 'V' && shiftDef.code !== 'B') {
            turnosDiarioCount += 1;
            dayHours = computeShiftRateFromConvenio(shiftDef, effectiveYearRateForMonth).totalHours;
          }
        }
        if (asg.lateFinishMinutes && asg.lateFinishMinutes > 0) {
          dayHours += asg.lateFinishMinutes / 60;
        }
        if (!isMarkedHoliday && !isMarkedFT && dayHours > 0) {
          horasDiarioMes += Math.min(9, dayHours);
        }
      }
    }

    const firstDayKey = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDayKey = `${year}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(
      2,
      '0'
    )}`;
    const firstDayAsg = monthAssignmentByDate.get(firstDayKey);
    const firstDayIsSick = isAssignmentSickLeave(firstDayAsg);
    const lastDayIsSick = isAssignmentSickLeave(monthAssignmentByDate.get(lastDayKey));

    // Si el empleado rellenó bajas ('B') en Turnos Día en este mes, solo enlaza con el mes anterior
    // cuando la baja termina el último día del mes previo y sigue exactamente en el día 1 de este mes.
    let bajaContiguaAuto = true;
    if (bajaNat > 0) {
      bajaContiguaAuto = Boolean(prevMonthEndedWithSickInDiary && firstDayIsSick);
    } else if (firstDayAsg && !firstDayIsSick) {
      bajaContiguaAuto = false;
    }

    prevMonthHadSickInDiary = bajaNat > 0;
    prevMonthEndedWithSickInDiary = lastDayIsSick;

    return {
      idx,
      mes,
      habilesCal,
      vacNat,
      vacLab,
      bajaNat,
      bajaLab,
      tipoBaja: 'comun' as SickLeaveContingencyType,
      extraMes: idx === 2, // Marzo
      extraJulDic: idx === 6 || idx === 11, // Julio y Diciembre
      horasDiarioMes: Math.round(horasDiarioMes * 100) / 100,
      turnosDiarioCount,
      ...(idx === 0 && prevYearTrailingSickDays > 0
        ? { bajaDiasPreviosAnioAnterior: prevYearTrailingSickDays }
        : {}),
      bajaContiguaAuto,
    };
  });
}

export function resolveAnnualParams(
  defaults: AnnualEditableParams,
  yearOverride?: AnnualYearOverrideData
): AnnualEditableParams {
  return {
    ...defaults,
    ...(yearOverride?.paramOverrides || {}),
  };
}

export function resolveAnnualMonths(
  defaults: AnnualMonthBaseRow[],
  yearOverride?: AnnualYearOverrideData
): AnnualMonthBaseRow[] {
  const monthOverrides = yearOverride?.monthOverrides || {};
  return defaults.map((m) => {
    const ov = monthOverrides[m.idx];
    if (!ov) return m;
    const merged: AnnualMonthBaseRow = {
      ...m,
      ...ov,
    };
    if (ov.vacNat !== undefined) {
      const maxHab = Math.max(0, merged.habilesCal - merged.bajaLab);
      merged.vacLab = estimateWorkingDaysFromNatural(ov.vacNat, maxHab);
    }
    if (ov.bajaNat !== undefined && ov.bajaLab === undefined) {
      const maxHab = Math.max(0, merged.habilesCal - merged.vacLab);
      merged.bajaLab = estimateWorkingDaysFromNatural(ov.bajaNat, maxHab);
    }
    return merged;
  });
}

export function calculateAnnualLiquidation(
  year: number,
  params: AnnualEditableParams,
  months: AnnualMonthBaseRow[],
  validatedMonths?: ValidatedMonthsMap
): AnnualLiquidationResult {
  const anio = Math.max(2020, Math.min(2040, Math.round(year) || 2026));
  const horasAnuales100 = Math.max(1, Number(params.horasAnuales100) || 1776);
  const jornadaPct = Math.min(100, Math.max(1, Number(params.jornadaPct) || 100));
  const factorJornada = jornadaPct / 100;
  const vacReglamentarias = Math.max(0, Math.round(Number(params.vacReglamentarias) || 0));
  const baseMes100 = Math.max(0, Number(params.baseMes100) || 0);
  const compMes100 = Math.max(0, Number(params.compMes100) || 0);
  const numPagas = Math.max(12, Math.round(Number(params.numPagas) || 15));
  const modoExtras = params.modoExtras || 'prorrateadas';
  const plusVacDia100 = Math.max(0, Number(params.plusVacDia100) || 0);
  const repartoBolsa = params.repartoBolsa || 'lineal';

  const p = {
    anio,
    horasAnuales100,
    jornadaPct,
    factorJornada,
    vacReglamentarias,
    baseMes100,
    compMes100,
    numPagas,
    modoExtras,
    plusVacDia100,
    repartoBolsa,
  };

  let totalHabilesCal = 0;
  let totalVacNat = 0;
  let totalVacLab = 0;
  let totalBajaNat = 0;
  let totalBajaLab = 0;
  let totalDiasActivos = 0;

  const prelim = months.map((m) => {
    const habilesCal = Math.max(0, Math.round(Number(m.habilesCal) || 0));
    const vacNat = Math.max(0, Math.round(Number(m.vacNat) || 0));
    const vacLab = Math.max(0, Math.round(Number(m.vacLab) || 0));
    const bajaNat = Math.max(0, Math.round(Number(m.bajaNat) || 0));
    const bajaLab = Math.max(0, Math.round(Number(m.bajaLab) || 0));
    const diasActivos = Math.max(0, habilesCal - vacLab - bajaLab);

    const monthKey = `${anio}-${String(m.idx + 1).padStart(2, '0')}`;
    const vRec = validatedMonths?.[monthKey];
    const isValidated = Boolean(vRec);
    const effectiveJornadaPct = vRec
      ? Math.min(100, Math.max(1, Number(vRec.jornadaPct) || jornadaPct))
      : jornadaPct;

    totalHabilesCal += habilesCal;
    totalVacNat += vacNat;
    totalVacLab += vacLab;
    totalBajaNat += bajaNat;
    totalBajaLab += bajaLab;
    totalDiasActivos += diasActivos;

    return {
      ...m,
      habilesCal,
      vacNat,
      vacLab,
      bajaNat,
      bajaLab,
      diasActivos,
      vRec,
      isValidated,
      effectiveJornadaPct,
    };
  });

  const hasJornadaChangeAcrossMonths = prelim.some(
    (m) => Math.round(m.effectiveJornadaPct) !== Math.round(jornadaPct)
  );

  // Jornada efectiva total ponderada por los meses validados y el % actual en meses pendientes
  const jornadaAnualEfectiva = hasJornadaChangeAcrossMonths
    ? prelim.reduce((sum, m) => sum + (horasAnuales100 * (m.effectiveJornadaPct / 100)) / 12, 0)
    : horasAnuales100 * factorJornada;

  const scheduleInputs: AnnualScheduleMonthInput[] = prelim.map((m) => ({
    month: m.idx + 1,
    daysInMonth: new Date(anio, m.idx + 1, 0).getDate(),
    vacDays: m.vacNat,
    sickDays: m.bajaNat,
    partTimeFactor: m.effectiveJornadaPct / 100,
  }));
  const annualSchedule = computeAnnualHoursSchedule(
    anio,
    horasAnuales100,
    scheduleInputs,
    vacReglamentarias
  );
  const cuotaFijaMes = annualSchedule.cuotaFijaEnteraDefault;

  const baseMensualEfectiva = baseMes100 * factorJornada;
  const compMensualEfectiva = compMes100 * factorJornada;
  const sumaBaseCompMesActual = baseMensualEfectiva + compMensualEfectiva;
  const plusVacDiaEfectivo = plusVacDia100 * factorJornada;

  const brutoFijoAnual = sumaBaseCompMesActual * numPagas;
  const valorHoraTabla =
    horasAnuales100 * factorJornada > 0 ? brutoFijoAnual / (horasAnuales100 * factorJornada) : 0;

  const totalDiasComputo = Math.max(1, totalDiasActivos + totalBajaLab);
  const horasPorDia100 = horasAnuales100 / totalDiasComputo;
  const horasPorDiaActivo = horasPorDia100 * factorJornada;

  // La bolsa siempre inicia en enero a 0,00 h (ni a favor ni en contra de ejercicios previos)
  const bolsaInicialAnio = 0;
  let bolsaAcumulada = bolsaInicialAnio;
  let bolsaCompensacionAcumulada = bolsaInicialAnio;
  let runningDeficitAnual = 0; // <= 0 déficit acumulado vs teóricas antes de generar complementarias
  let sumaHorasTeoricasActivas = 0;
  let sumaHorasComputoTeorico = 0;
  let sumaCuotaFija = 0;
  let sumaSaldoMes = 0;
  let sumaHorasRealizadas = 0;
  let sumaComplementariasMes = 0;
  let mesesConTurnosCount = 0;
  let sumaDiferenciaReal = 0;
  let sumaFijo = 0;
  let sumaPlusVac = 0;
  let sumaTotalBruto = 0;

  let validatedMonthsCount = 0;
  let saldoArrastradoValidado = 0;
  let horasRestantesBase = 0;
  let diasComputoRestantes = 0;

  const prevYearCarry = Math.max(
    0,
    Math.round(Number(prelim[0]?.bajaDiasPreviosAnioAnterior) || 0)
  );
  let rachaBajaDias = prevYearCarry;
  let ultimoTipoBaja: SickLeaveContingencyType | null = prevYearCarry > 0 ? 'comun' : null;
  let prevHadBaja = prevYearCarry > 0;

  const filas: AnnualMonthComputedRow[] = prelim.map((m, idx) => {
    const schedM = annualSchedule.months[idx];

    // 1. Cálculo teórico (cuota fija redondeada al entero superior, bolsa a 0 en último mes de vac., y regularización posterior)
    const horasTeoricasActivas = schedM.horasTeoricas;
    const horasJustificadasIT = schedM.sickCredit;
    const horasComputoTeorico = horasTeoricasActivas + horasJustificadasIT;

    const cuotaMes =
      repartoBolsa === 'equilibrado'
        ? horasComputoTeorico
        : schedM.cuotaForBolsa;

    const saldoMes = horasComputoTeorico - cuotaMes;
    bolsaAcumulada += saldoMes;
    if (Math.abs(bolsaAcumulada) < 1e-9) bolsaAcumulada = 0;

    // 2. Horas realmente realizadas (mes natural desde Turnos Día, validación congelada o edición manual) y compensación
    const isHorasManual =
      typeof m.horasReales === 'number' && Number.isFinite(m.horasReales);
    const horasRealizadas = isHorasManual
      ? Math.max(0, m.horasReales as number)
      : m.vRec
        ? Math.max(0, m.vRec.horasRealizadasMesNatural)
        : m.horasDiarioMes;

    const tieneRegistroReal =
      isHorasManual || m.isValidated || m.turnosDiarioCount > 0 || horasRealizadas > 0;

    // Las horas complementarias cobradas en nómina NO deben ir a la bolsa de horas
    let horasComplementariasMes = 0;
    if (tieneRegistroReal) {
      const horasConIT = horasRealizadas + horasJustificadasIT;
      const diffVsTeorico = horasConIT - horasComputoTeorico;

      if (m.vRec?.payrollSnapshot && !isHorasManual) {
        horasComplementariasMes = Math.max(0, m.vRec.payrollSnapshot.horasExcesoMensual || 0);
        if (diffVsTeorico < 0) {
          runningDeficitAnual += diffVsTeorico;
        } else {
          const absorbedToDeficit = Math.max(0, diffVsTeorico - horasComplementariasMes);
          runningDeficitAnual = Math.min(0, runningDeficitAnual + absorbedToDeficit);
        }
      } else {
        if (diffVsTeorico < 0) {
          runningDeficitAnual += diffVsTeorico;
        } else {
          const deficitOwed = Math.max(0, -runningDeficitAnual);
          const appliedDeficit = Math.min(diffVsTeorico, deficitOwed);
          const surplusAfterDeficit = Math.max(0, diffVsTeorico - appliedDeficit);
          if (m.vacNat > 0) {
            const umbralCompl = Math.max(horasComputoTeorico, cuotaMes);
            const excessOverQuota = Math.max(0, horasConIT - umbralCompl);
            horasComplementariasMes = Math.min(surplusAfterDeficit, excessOverQuota);
          } else {
            horasComplementariasMes = surplusAfterDeficit;
          }
          const absorbedToDeficit = Math.max(0, diffVsTeorico - horasComplementariasMes);
          runningDeficitAnual = Math.min(0, runningDeficitAnual + absorbedToDeficit);
        }
      }
      horasComplementariasMes = Math.round(horasComplementariasMes * 100) / 100 || 0;
    }

    const horasComputablesBolsa = Math.max(0, horasRealizadas - horasComplementariasMes);
    // Comp. (R - T) resta las horas teóricas seleccionadas en cabecera (Cuota Fija Mensual o Equilibradas)
    // excluyendo las horas complementarias cobradas para que no vayan a la bolsa
    const diferenciaRealMes = tieneRegistroReal
      ? horasComputablesBolsa + horasJustificadasIT - cuotaMes
      : 0;

    if (tieneRegistroReal) {
      mesesConTurnosCount += 1;
      bolsaCompensacionAcumulada += diferenciaRealMes;
      sumaDiferenciaReal += diferenciaRealMes;
      sumaComplementariasMes += horasComplementariasMes;
    }

    if (m.isValidated) {
      validatedMonthsCount += 1;
      saldoArrastradoValidado += diferenciaRealMes;
    } else {
      horasRestantesBase += cuotaMes;
      diasComputoRestantes += m.diasActivos + m.bajaLab;
    }

    // 3. Cálculo económico mensual usando la jornada efectiva de ese mes
    const monthFactor = m.effectiveJornadaPct / 100;
    const sumaBaseCompMesM = (baseMes100 + compMes100) * monthFactor;
    const brutoFijoAnualM = sumaBaseCompMesM * numPagas;
    const baseRegDiariaM = brutoFijoAnualM / 360;
    const plusVacDiaEfectivoM = plusVacDia100 * monthFactor;

    const factorAlta = Math.max(0, (30 - m.bajaNat) / 30);
    let fijoMes = 0;

    if (modoExtras === 'prorrateadas') {
      fijoMes = (brutoFijoAnualM / 12) * factorAlta;
    } else if (modoExtras === 'integras') {
      fijoMes = sumaBaseCompMesM * factorAlta;
      if (m.extraMes && numPagas >= 13) {
        fijoMes += (sumaBaseCompMesM / 12) * factorAlta;
      }
      if (m.extraJulDic && numPagas > 13) {
        const extrasRestantes = Math.max(0, numPagas - 13);
        fijoMes += (sumaBaseCompMesM * extrasRestantes) / 2;
      }
    } else if (modoExtras === 'mixta_marzo_prorr') {
      const extraMarzoProrr = numPagas >= 13 ? sumaBaseCompMesM / 12 : 0;
      fijoMes = (sumaBaseCompMesM + extraMarzoProrr) * factorAlta;
      if (m.extraJulDic && numPagas > 13) {
        const extrasRestantes = Math.max(0, numPagas - 13);
        fijoMes += (sumaBaseCompMesM * extrasRestantes) / 2;
      }
    }

    let prestacionIT = 0;
    let detalleIT = '';
    const prevMonthHasBaja = prevHadBaja && ultimoTipoBaja === 'comun';
    let rachaInicioDia = 0;
    let rachaFinDia = 0;
    let bajaEsContinuacionEfectiva = false;

    if (m.bajaNat > 0) {
      if (m.tipoBaja === 'accidente_100') {
        prestacionIT = m.bajaNat * baseRegDiariaM;
        detalleIT = `IT 100% (${m.bajaNat}d)`;
        rachaInicioDia = 0;
        rachaFinDia = m.bajaNat;
        rachaBajaDias = 0;
        ultimoTipoBaja = 'accidente_100';
        prevHadBaja = true;
      } else if (m.tipoBaja === 'accidente_75') {
        prestacionIT = m.bajaNat * baseRegDiariaM * 0.75;
        detalleIT = `IT 75% (${m.bajaNat}d)`;
        rachaInicioDia = 0;
        rachaFinDia = m.bajaNat;
        rachaBajaDias = 0;
        ultimoTipoBaja = 'accidente_75';
        prevHadBaja = true;
      } else {
        const autoCont = m.bajaContiguaAuto ?? true;
        bajaEsContinuacionEfectiva =
          prevMonthHasBaja &&
          (m.bajaEsContinuacion !== undefined ? m.bajaEsContinuacion : autoCont);

        const inicioAcum = bajaEsContinuacionEfectiva ? rachaBajaDias : 0;
        const finAcum = inicioAcum + m.bajaNat;
        rachaInicioDia = inicioAcum;
        rachaFinDia = finAcum;

        let d0 = 0;
        let d60 = 0;
        let d75 = 0;
        for (let d = inicioAcum + 1; d <= finAcum; d++) {
          if (d <= 3) d0++;
          else if (d <= 20) d60++;
          else d75++;
        }
        prestacionIT = baseRegDiariaM * (0.6 * d60 + 0.75 * d75);
        const rangoTxt = `${inicioAcum + 1}–${finAcum}d`;
        const tramos: string[] = [];
        if (d0 > 0) tramos.push(`${d0}d@0%`);
        if (d60 > 0) tramos.push(`${d60}d@60%`);
        if (d75 > 0) tramos.push(`${d75}d@75%`);
        detalleIT = bajaEsContinuacionEfectiva
          ? `Cont. (${rangoTxt}): ${tramos.join(' · ')}`
          : `IT Común (${rangoTxt}): ${tramos.join(' · ')}`;
        rachaBajaDias = finAcum;
        ultimoTipoBaja = 'comun';
        prevHadBaja = true;
      }
    } else {
      rachaBajaDias = 0;
      ultimoTipoBaja = null;
      prevHadBaja = false;
    }

    fijoMes += prestacionIT;
    const plusVacMes = m.vacNat * plusVacDiaEfectivoM;
    const totalBrutoMes = fijoMes + plusVacMes;

    sumaHorasTeoricasActivas += horasTeoricasActivas;
    sumaHorasComputoTeorico += horasComputoTeorico;
    sumaCuotaFija += cuotaMes;
    sumaSaldoMes += saldoMes;
    sumaHorasRealizadas += horasRealizadas;
    sumaFijo += fijoMes;
    sumaPlusVac += plusVacMes;
    sumaTotalBruto += totalBrutoMes;

    const { vRec: _omitVRec, ...restM } = m;

    return {
      ...restM,
      horasTeoricasActivas,
      horasJustificadasIT,
      horasComputoTeorico,
      cuotaMes,
      saldoMes,
      bolsaAcumulada,
      horasRealizadas,
      horasComplementariasMes,
      isHorasManual,
      tieneRegistroReal,
      diferenciaRealMes,
      bolsaCompensacionAcumulada,
      fijoMes,
      plusVacMes,
      totalBrutoMes,
      detalleIT,
      rachaInicioDia,
      rachaFinDia,
      prevMonthHasBaja,
      bajaEsContinuacionEfectiva,
      isValidated: m.isValidated,
      effectiveJornadaPct: m.effectiveJornadaPct,
      validatedIrpf: m.vRec?.irpfPercentage,
    };
  });

  const bolsaAcumuladaFinal =
    filas.length > 0 ? filas[filas.length - 1].bolsaAcumulada : 0;

  const unvalidatedMonthsCount = Math.max(0, 12 - validatedMonthsCount);
  const horasPendientesAjustadasResto = Math.max(
    0,
    horasRestantesBase - saldoArrastradoValidado
  );
  const mediaDiariaAjustadaResto =
    diasComputoRestantes > 0 ? horasPendientesAjustadasResto / diasComputoRestantes : 0;
  const cuotaMensualAjustadaResto =
    unvalidatedMonthsCount > 0 ? horasPendientesAjustadasResto / unvalidatedMonthsCount : 0;

  // Límites legales calculados en base a la jornada anual efectiva:
  // - Jornada completa (100%): límite máximo legal de 80 horas extraordinarias anuales (no aplican complementarias +30% ni +15%)
  // - Jornada parcial (<100%): +30% tope base y hasta +15% voluntarias con consentimiento en bloques de 8h
  const round2 = (n: number) => {
    const r = Math.round(n * 100) / 100;
    return Object.is(r, -0) ? 0 : r;
  };
  const esJornadaCompleta = jornadaPct >= 100 - 0.01;
  const limiteComplementarias30Horas = esJornadaCompleta
    ? 80
    : round2(jornadaAnualEfectiva * 0.3);
  const topeMaximoHoras30Anual = esJornadaCompleta
    ? round2(jornadaAnualEfectiva + 80)
    : round2(jornadaAnualEfectiva * 1.3);
  const horasVoluntarias15Anual = esJornadaCompleta
    ? 0
    : round2(jornadaAnualEfectiva * 0.15);

  const rawVolActive = !esJornadaCompleta && Boolean(params.voluntarias15Activas);
  const rawVolHours =
    params.voluntarias15Horas !== undefined && Number.isFinite(params.voluntarias15Horas)
      ? Math.max(0, Number(params.voluntarias15Horas))
      : rawVolActive
        ? horasVoluntarias15Anual
        : 0;
  const horasVoluntarias15Activadas = rawVolActive
    ? round2(Math.min(horasVoluntarias15Anual, rawVolHours))
    : 0;
  const voluntarias15Activas = rawVolActive && horasVoluntarias15Activadas > 0;
  const topeMaximoConVoluntariasAnual = round2(
    topeMaximoHoras30Anual + horasVoluntarias15Activadas
  );
  const limiteExtraEfectivoAnual = round2(
    limiteComplementarias30Horas + horasVoluntarias15Activadas
  );

  let horasRealizadasMasITRegistradas = 0;
  let horasTeoricasComputoRegistradas = 0;
  let horasPendientesMesesSinRegistro = 0;
  let horasITMesesSinRegistro = 0;

  for (const f of filas) {
    if (f.tieneRegistroReal) {
      horasRealizadasMasITRegistradas += f.horasRealizadas + f.horasJustificadasIT;
      horasTeoricasComputoRegistradas += f.horasComputoTeorico;
    } else {
      horasPendientesMesesSinRegistro += f.horasTeoricasActivas;
      horasITMesesSinRegistro += f.horasJustificadasIT;
    }
  }

  horasPendientesMesesSinRegistro = round2(horasPendientesMesesSinRegistro);
  const horasEstimadasCierreAnual = round2(
    horasRealizadasMasITRegistradas + horasPendientesMesesSinRegistro + horasITMesesSinRegistro
  );

  const horasEstimadasAlRitmoActual =
    mesesConTurnosCount > 0 && horasTeoricasComputoRegistradas > 0
      ? round2((horasRealizadasMasITRegistradas / horasTeoricasComputoRegistradas) * jornadaAnualEfectiva)
      : horasEstimadasCierreAnual;

  const superaTopeBase30SinVoluntarias =
    horasEstimadasCierreAnual > topeMaximoHoras30Anual + 0.004;
  const superaLimite30ConPendientes =
    horasEstimadasCierreAnual > topeMaximoConVoluntariasAnual + 0.004;
  const riesgoSuperarLimite30PorRitmo =
    !superaLimite30ConPendientes &&
    mesesConTurnosCount > 0 &&
    mesesConTurnosCount < 12 &&
    horasEstimadasAlRitmoActual > topeMaximoConVoluntariasAnual + 0.004;

  const porcentajeLlenadoTope30 =
    topeMaximoConVoluntariasAnual > 0
      ? round2((sumaHorasRealizadas / topeMaximoConVoluntariasAnual) * 100)
      : 0;
  const porcentajeEstimadoTope30 =
    topeMaximoConVoluntariasAnual > 0
      ? round2((horasEstimadasCierreAnual / topeMaximoConVoluntariasAnual) * 100)
      : 0;
  const porcentajeMargen30Consumido =
    limiteExtraEfectivoAnual > 0
      ? round2(
          Math.max(
            0,
            ((horasEstimadasCierreAnual - jornadaAnualEfectiva) / limiteExtraEfectivoAnual) * 100
          )
        )
      : 0;
  const margenRestante30Horas = round2(topeMaximoConVoluntariasAnual - horasEstimadasCierreAnual);

  return {
    anio,
    p,
    jornadaAnualEfectiva,
    cuotaFijaMes,
    baseMensualEfectiva,
    compMensualEfectiva,
    plusVacDiaEfectivo,
    brutoFijoAnual,
    valorHoraTabla,
    horasPorDiaActivo,
    totalHabilesCal,
    totalVacNat,
    totalVacLab,
    totalBajaNat,
    totalBajaLab,
    totalDiasActivos,
    sumaHorasTeoricasActivas,
    sumaHorasComputoTeorico,
    sumaCuotaFija,
    sumaSaldoMes,
    bolsaAcumuladaFinal,
    bolsaInicialAnio,
    sumaHorasRealizadas,
    sumaComplementariasMes: Math.round(sumaComplementariasMes * 100) / 100 || 0,
    mesesConTurnosCount,
    sumaDiferenciaReal,
    bolsaCompensacionFinal: bolsaCompensacionAcumulada,
    validatedMonthsCount,
    unvalidatedMonthsCount,
    hasJornadaChangeAcrossMonths,
    saldoArrastradoValidado,
    horasRestantesBase,
    horasPendientesAjustadasResto,
    diasComputoRestantes,
    mediaDiariaAjustadaResto,
    cuotaMensualAjustadaResto,
    esJornadaCompleta,
    limiteComplementarias30Horas,
    topeMaximoHoras30Anual,
    horasVoluntarias15Anual,
    voluntarias15Activas,
    horasVoluntarias15Activadas,
    topeMaximoConVoluntariasAnual,
    superaTopeBase30SinVoluntarias,
    horasPendientesMesesSinRegistro,
    horasEstimadasCierreAnual,
    horasEstimadasAlRitmoActual,
    superaLimite30ConPendientes,
    riesgoSuperarLimite30PorRitmo,
    porcentajeLlenadoTope30,
    porcentajeEstimadoTope30,
    porcentajeMargen30Consumido,
    margenRestante30Horas,
    sumaFijo,
    sumaPlusVac,
    sumaTotalBruto,
    filas,
  };
}

export function formatEuro(valor: number): string {
  const num = Number.isFinite(valor) ? valor : 0;
  return (
    num.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  );
}

export function formatHoras(valor: number, conSigno = false): string {
  const num = Number.isFinite(valor) ? valor : 0;
  const absStr =
    Math.abs(num).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' h';
  if (conSigno) {
    if (num > 0.004) return '+' + absStr;
    if (num < -0.004) return '−' + absStr;
    return '0,00 h';
  }
  return (num < 0 ? '−' : '') + absStr;
}

/**
 * Generates styled Excel workbook (.xlsx) preserving theoretical 0-balance formulas
 * alongside real hours from Turnos Día and monthly/cumulative compensation differences.
 */
export function exportAnnualCalendarToExcel(
  res: AnnualLiquidationResult,
  profile?: WorkerProfile
): string {
  const { p } = res;
  const wb = XLSX.utils.book_new();
  const wsData: unknown[][] = [];

  const workerLabel = profile?.name?.trim()
    ? `Conductor/a: ${profile.name.trim()}${profile.companyName?.trim() ? ` · ${profile.companyName.trim()}` : ''}`
    : `Convenio de Transporte de Viajeros por Carretera · Jornada pactada ${p.horasAnuales100} h/año al 100%`;

  wsData.push([
    `CUADRO DE LIQUIDACIÓN DE NÓMINA Y BOLSA DE HORAS — EJERCICIO ${p.anio}`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  wsData.push([workerLabel, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  wsData.push([]);
  wsData.push(['PARÁMETRO DE CONVENIO', 'CÓDIGO', 'VALOR CONFIGURADO', 'OBSERVACIÓN ADMINISTRATIVA']);
  wsData.push(['Año Ejercicio', 'ANIO', p.anio, 'Año natural de cálculo y calendario laboral']);
  wsData.push(['Horas 100% Año', 'HORAS_100', p.horasAnuales100, 'Jornada anual completa fijada por convenio']);
  wsData.push(['% Jornada', 'PCT_JORN', p.jornadaPct, 'Porcentaje de contratación (100 = jornada completa)']);
  wsData.push(['Días Vac. Convenio', 'VAC_CONV', p.vacReglamentarias, 'Días naturales reglamentarios anuales con plus (31 en año completo)']);
  wsData.push(['Base 100% (€/Mes)', 'BASE_100', p.baseMes100, 'Salario base mensual a jornada completa (100%)']);
  wsData.push(['Comp. 100% (€)', 'COMP_100', p.compMes100, 'Complemento personal o antigüedad mensual (100%)']);
  wsData.push(['Nº Pagas Anuales', 'NUM_PAGAS', p.numPagas, 'Número de mensualidades + pagas extraordinarias']);
  wsData.push([
    'Abono Pagas Extras',
    'MODO_EXTRAS',
    p.modoExtras === 'prorrateadas' ? 1 : p.modoExtras === 'integras' ? 2 : 3,
    '1=Prorrateadas (12m), 2=Íntegras, 3=2 Íntegras + Marzo Prorr.',
  ]);
  wsData.push(['Plus Vac. 100% (€/Día)', 'PLUS_VAC', p.plusVacDia100, 'Plus diario de vacaciones por cada día natural disfrutado (31 días/año completo)']);
  wsData.push([]);

  wsData.push([
    `MES ${p.anio}`,
    'HÁB. CAL.',
    'VACACIONES (NAT.)',
    'VAC. L-V (CÓMP.)',
    'BAJA NAT.',
    'BAJA L-V',
    'TIPO BAJA',
    'DÍAS ACTIVOS',
    'HORAS TEÓR. (CUADRE 0)',
    p.repartoBolsa === 'equilibrado' ? 'HORAS EQUIL.' : 'CUOTA FIJA',
    'SALDO TEÓR.',
    'BOLSA TEÓR.',
    'HORAS REAL. (DIARIO)',
    'DIF. COMP. (R−T)',
    'FIJO PRORR.',
    'PLUS VAC.',
    'TOTAL BRUTO',
    'TRAMO EXTRA',
  ]);

  const buildEndAcumFormula = (j: number): string => {
    const rowJ = res.filas[j];
    const rJ = 16 + j;
    if (j === 0) {
      const carry0 =
        rowJ.bajaEsContinuacionEfectiva && rowJ.rachaInicioDia > 0
          ? String(rowJ.rachaInicioDia)
          : '';
      return carry0 ? `${carry0}+E16` : 'E16';
    }
    if (!rowJ.bajaEsContinuacionEfectiva) {
      return `E${rJ}`;
    }
    const prevR = 16 + j - 1;
    const prevEnd = buildEndAcumFormula(j - 1);
    return `IF(AND(E${prevR}>0,G${prevR}=0),${prevEnd},0)+E${rJ}`;
  };

  const buildPrevAcumFormula = (idx: number): string => {
    const m = res.filas[idx];
    if (idx === 0) {
      return m.bajaEsContinuacionEfectiva && m.rachaInicioDia > 0
        ? String(m.rachaInicioDia)
        : '0';
    }
    if (!m.bajaEsContinuacionEfectiva) {
      return '0';
    }
    const prevR = 16 + idx - 1;
    const prevEnd = buildEndAcumFormula(idx - 1);
    return `IF(AND(E${prevR}>0,G${prevR}=0),${prevEnd},0)`;
  };

  res.filas.forEach((m, idx) => {
    const r = 16 + idx;
    const prevR = r - 1;
    const bolsaFormula = idx === 0 ? `K${r}` : `L${prevR}+K${r}`;

    const isMixedMonth = m.isValidated && Math.round(m.effectiveJornadaPct) !== Math.round(p.jornadaPct);
    const pctExpr = isMixedMonth ? `(${m.effectiveJornadaPct}/100)` : '($C$7/100)';

    const prevAcumExpr = buildPrevAcumFormula(idx);
    const acumBajaExpr = prevAcumExpr === '0' ? `E${r}` : `(${prevAcumExpr})+E${r}`;

    const brDiariaExpr = `(((($C$9+$C$10)*${pctExpr})*$C$11)/360)`;
    const prestacionComunExpr = `(${brDiariaExpr}*(0.6*MAX(0,MIN(20,${acumBajaExpr})-MAX(3,${prevAcumExpr}))+0.75*MAX(0,${acumBajaExpr}-MAX(20,${prevAcumExpr}))))`;
    const prestacionITExpr = `IF(E${r}=0,0,IF(G${r}=1,E${r}*${brDiariaExpr},IF(G${r}=2,E${r}*${brDiariaExpr}*0.75,${prestacionComunExpr})))`;

    const factorAltaExpr = `(MAX(0,30-E${r})/30)`;
    const baseMensualExpr = `(($C$9+$C$10)*${pctExpr})`;
    const fijoAltaExpr = `IF($C$12=1,((${baseMensualExpr}*$C$11)/12)*${factorAltaExpr},IF($C$12=2,(${baseMensualExpr}*${factorAltaExpr})+(IF($C$11>=13,(${baseMensualExpr}/12)*${factorAltaExpr},0))+IF(R${r}=2,(${baseMensualExpr}*MAX(0,$C$11-13))/2,0),((${baseMensualExpr}+IF($C$11>=13,${baseMensualExpr}/12,0))*${factorAltaExpr})+IF(R${r}=2,(${baseMensualExpr}*MAX(0,$C$11-13))/2,0)))`;

    const itHoursVal = Number((m.horasJustificadasIT || 0).toFixed(4));
    const paidComplVal = Number((m.horasComplementariasMes || 0).toFixed(2));
    const difFormula = m.tieneRegistroReal
      ? `(M${r}${itHoursVal > 0 ? `+${itHoursVal}` : ''}${paidComplVal > 0 ? `-${paidComplVal}` : ''})-J${r}`
      : '0';

    wsData.push([
      m.isValidated ? `${m.mes} (${m.effectiveJornadaPct}%)` : m.mes,
      m.habilesCal,
      m.vacNat,
      m.vacLab,
      m.bajaNat,
      m.bajaLab,
      m.tipoBaja === 'accidente_100' ? 1 : m.tipoBaja === 'accidente_75' ? 2 : 0,
      { t: 'n', v: m.diasActivos, f: `MAX(0,B${r}-D${r}-F${r})` },
      Number(m.horasComputoTeorico.toFixed(4)),
      p.repartoBolsa === 'equilibrado'
        ? { t: 'n', v: Number(m.cuotaMes.toFixed(4)), f: `I${r}` }
        : Number(m.cuotaMes.toFixed(4)),
      { t: 'n', v: Number(m.saldoMes.toFixed(4)), f: `I${r}-J${r}` },
      { t: 'n', v: Number(m.bolsaAcumulada.toFixed(4)), f: bolsaFormula },
      Number(m.horasRealizadas.toFixed(2)),
      { t: 'n', v: Number(m.diferenciaRealMes.toFixed(2)), f: difFormula },
      { t: 'n', v: Number(m.fijoMes.toFixed(2)), f: `${fijoAltaExpr}+${prestacionITExpr}` },
      { t: 'n', v: Number(m.plusVacMes.toFixed(2)), f: `C${r}*($C$13*${pctExpr})` },
      { t: 'n', v: Number(m.totalBrutoMes.toFixed(2)), f: `O${r}+P${r}` },
      m.extraJulDic ? 2 : m.extraMes ? 1 : 0,
    ]);
  });

  wsData.push([
    `TOTAL ${p.anio}`,
    { t: 'n', v: res.totalHabilesCal, f: 'SUM(B16:B27)' },
    { t: 'n', v: res.totalVacNat, f: 'SUM(C16:C27)' },
    { t: 'n', v: res.totalVacLab, f: 'SUM(D16:D27)' },
    { t: 'n', v: res.totalBajaNat, f: 'SUM(E16:E27)' },
    { t: 'n', v: res.totalBajaLab, f: 'SUM(F16:F27)' },
    '—',
    { t: 'n', v: res.totalDiasActivos, f: 'SUM(H16:H27)' },
    { t: 'n', v: Number(res.sumaHorasComputoTeorico.toFixed(2)), f: 'SUM(I16:I27)' },
    { t: 'n', v: Number(res.sumaCuotaFija.toFixed(2)), f: 'SUM(J16:J27)' },
    { t: 'n', v: Number(res.sumaSaldoMes.toFixed(2)), f: 'SUM(K16:K27)' },
    { t: 'n', v: Number(res.bolsaAcumuladaFinal.toFixed(2)), f: 'L27' },
    { t: 'n', v: Number(res.sumaHorasRealizadas.toFixed(2)), f: 'SUM(M16:M27)' },
    { t: 'n', v: Number(res.sumaDiferenciaReal.toFixed(2)), f: 'SUM(N16:N27)' },
    { t: 'n', v: Number(res.sumaFijo.toFixed(2)), f: 'SUM(O16:O27)' },
    { t: 'n', v: Number(res.sumaPlusVac.toFixed(2)), f: 'SUM(P16:P27)' },
    { t: 'n', v: Number(res.sumaTotalBruto.toFixed(2)), f: 'SUM(Q16:Q27)' },
    {
      t: 'n',
      v: res.filas.reduce((acc, m) => acc + (m.extraJulDic ? 2 : m.extraMes ? 1 : 0), 0),
      f: 'SUM(R16:R27)',
    },
  ]);

  wsData.push([]);
  wsData.push(['RESUMEN E INDICADORES CLAVE', 'CÓDIGO', 'RESULTADO', 'INTERPRETACIÓN ADMINISTRATIVA']);
  wsData.push([
    'Jornada Anual Efectiva Contrato (h)',
    'JORN_EFEC',
    { t: 'n', v: Number(res.jornadaAnualEfectiva.toFixed(2)), f: res.hasJornadaChangeAcrossMonths ? 'SUM(J16:J27)' : 'C6*(C7/100)' },
    'Total horas anuales ajustadas al porcentaje de jornada de cada mes',
  ]);
  wsData.push([
    'Valor Hora Tabla Convenio (€/h)',
    'VAL_HORA',
    { t: 'n', v: Number(res.valorHoraTabla.toFixed(2)), f: '((($C$9+$C$10)*($C$7/100))*$C$11)/C31' },
    'Retribución fija anual dividida entre la jornada anual efectiva',
  ]);
  wsData.push([
    'Media Diaria Cómputo (h/día)',
    'MEDIA_DIA',
    { t: 'n', v: Number(res.horasPorDiaActivo.toFixed(4)), f: 'C31/MAX(1,H28+F28)' },
    'Horas teóricas equivalentes por día laborable para cuadrar el año a 0',
  ]);
  wsData.push([
    'Desviación Vacaciones Naturales',
    'DESV_VAC',
    { t: 'n', v: p.vacReglamentarias - res.totalVacNat, f: 'C8-C28' },
    'Días naturales pendientes de cuadrar respecto al convenio',
  ]);
  wsData.push([
    'Saldo Real a Compensar (Meses con Turnos)',
    'COMP_REAL',
    { t: 'n', v: Number(res.bolsaCompensacionFinal.toFixed(2)), f: 'N28' },
    'Diferencia acumulada entre Horas Realizadas (Turnos Día) y Horas Teóricas',
  ]);
  wsData.push([
    'Bolsa Inicial a 1 de Enero (h)',
    'BOLSA_INI',
    { t: 'n', v: res.bolsaInicialAnio },
    'La bolsa inicia en enero a 0,00 h (ni a favor ni en contra)',
  ]);
  wsData.push([
    res.esJornadaCompleta ? 'Tope Máx. Anual (+80 h extras) (h)' : 'Tope Máx. Anual +30% (h)',
    res.esJornadaCompleta ? 'TOPE_80H' : 'TOPE_30',
    { t: 'n', v: res.topeMaximoConVoluntariasAnual },
    res.esJornadaCompleta
      ? `Jornada completa (100%): Jornada anual (${res.jornadaAnualEfectiva.toFixed(2)} h) + 80,00 h extraordinarias máx. anuales`
      : res.voluntarias15Activas
        ? `Tope base +30% (${res.topeMaximoHoras30Anual.toFixed(2)} h) + Voluntarias activadas (${res.horasVoluntarias15Activadas.toFixed(2)} h)`
        : `Jornada anual (${res.jornadaAnualEfectiva.toFixed(2)} h) + 30% máximo (${res.limiteComplementarias30Horas.toFixed(2)} h)`,
  ]);
  wsData.push([
    'Horas Voluntarias 15% (h)',
    'VOL_15',
    { t: 'n', v: res.horasVoluntarias15Activadas },
    res.esJornadaCompleta
      ? 'No aplica en jornada completa (100%); rige el límite anual de 80,00 h extraordinarias'
      : res.voluntarias15Activas
        ? `Activadas con consentimiento (${res.horasVoluntarias15Activadas.toFixed(2)} h de ${res.horasVoluntarias15Anual.toFixed(2)} h máx.)`
        : `Sin consentimiento del empleado (0,00 h activadas de ${res.horasVoluntarias15Anual.toFixed(2)} h posibles al 15%)`,
  ]);
  wsData.push([
    'Estimación Cierre Anual (h)',
    'EST_30',
    { t: 'n', v: res.horasEstimadasCierreAnual },
    res.superaLimite30ConPendientes
      ? `ALERTA: Supera tope vigente en ${Math.abs(res.margenRestante30Horas).toFixed(2)} h`
      : `Margen disponible dentro del tope vigente: ${res.margenRestante30Horas.toFixed(2)} h`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const borderThin = {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
    right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  };

  const estiloBanner = {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '071530' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const estiloSubBanner = {
    font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: 'CBD5E1' } },
    fill: { fgColor: { rgb: '0F2347' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const estiloCabeceraSeccion = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '071530' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    border: borderThin,
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const estiloCabeceraTabla = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '071530' } },
    border: borderThin,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };

  const estiloTotal = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '071530' } },
    border: borderThin,
    alignment: { horizontal: 'right', vertical: 'center' },
  };

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } },
  ];

  for (let c = 0; c <= 17; c++) {
    const c0 = XLSX.utils.encode_cell({ r: 0, c });
    const c1 = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[c0]) ws[c0].s = estiloBanner;
    if (ws[c1]) ws[c1].s = estiloSubBanner;
  }

  for (let c = 0; c <= 3; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 3, c })];
    if (cell) cell.s = estiloCabeceraSeccion;
  }

  for (let r = 4; r <= 12; r++) {
    const cLabel = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const cCode = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    const cVal = ws[XLSX.utils.encode_cell({ r, c: 2 })];
    const cObs = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (cLabel) {
      cLabel.s = {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: 'F8FAFC' } },
        border: borderThin,
      };
    }
    if (cCode) {
      cCode.s = {
        font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '64748B' } },
        fill: { fgColor: { rgb: 'F8FAFC' } },
        border: borderThin,
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
    if (cVal) {
      cVal.s = {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: 'EFF6FF' } },
        border: borderThin,
        alignment: { horizontal: 'right', vertical: 'center' },
      };
    }
    if (cObs) {
      cObs.s = {
        font: { name: 'Calibri', sz: 9, color: { rgb: '475569' } },
        fill: { fgColor: { rgb: 'FFFFFF' } },
        border: borderThin,
      };
    }
  }

  for (let c = 0; c <= 17; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 14, c })];
    if (cell) cell.s = estiloCabeceraTabla;
  }

  for (let r = 15; r <= 26; r++) {
    const zebra = r % 2 === 1 ? 'FFFFFF' : 'F8FAFC';
    for (let c = 0; c <= 17; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      let bg = zebra;
      let bold = c === 0 || c === 16;
      let color = '1E293B';
      if (c === 2 || c === 3 || c === 15) {
        bg = 'FFFBEB';
        color = '92400E';
        bold = true;
      }
      if (c === 4 || c === 5 || c === 6) {
        bg = 'FFF1F2';
        color = '9F1239';
      }
      if (c === 12 || c === 13) {
        bg = 'ECFDF5';
        color = '065F46';
        bold = true;
      }
      if (c === 16) {
        bg = 'EFF6FF';
        color = '0F172A';
      }
      cell.s = {
        font: { name: 'Calibri', sz: 10, bold, color: { rgb: color } },
        fill: { fgColor: { rgb: bg } },
        border: borderThin,
        alignment: {
          horizontal: c === 0 ? 'left' : c <= 7 || c === 17 ? 'center' : 'right',
          vertical: 'center',
        },
      };
    }
  }

  for (let c = 0; c <= 17; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 27, c })];
    if (cell) {
      cell.s = {
        ...estiloTotal,
        alignment: {
          horizontal: c === 0 ? 'left' : c <= 7 || c === 17 ? 'center' : 'right',
          vertical: 'center',
        },
      };
    }
  }

  for (let c = 0; c <= 3; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 29, c })];
    if (cell) cell.s = estiloCabeceraSeccion;
  }
  for (let r = 30; r <= 38; r++) {
    for (let c = 0; c <= 3; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      cell.s = {
        font: {
          name: 'Calibri',
          sz: 10,
          bold: c === 0 || c === 2,
          color: { rgb: c === 2 ? '065F46' : '1E293B' },
        },
        fill: { fgColor: { rgb: c === 2 ? 'ECFDF5' : 'FFFFFF' } },
        border: borderThin,
        alignment: { horizontal: c === 2 ? 'right' : 'left', vertical: 'center' },
      };
    }
  }

  for (let r = 16; r <= 28; r++) {
    if (ws[`I${r}`]) ws[`I${r}`].z = '#,##0.00" h"';
    if (ws[`J${r}`]) ws[`J${r}`].z = '#,##0.00" h"';
    if (ws[`K${r}`]) ws[`K${r}`].z = '+#,##0.00" h";-#,##0.00" h";0.00" h"';
    if (ws[`L${r}`]) ws[`L${r}`].z = '+#,##0.00" h";-#,##0.00" h";0.00" h"';
    if (ws[`M${r}`]) ws[`M${r}`].z = '#,##0.00" h"';
    if (ws[`N${r}`]) ws[`N${r}`].z = '+#,##0.00" h";-#,##0.00" h";0.00" h"';
    if (ws[`O${r}`]) ws[`O${r}`].z = '#,##0.00" €"';
    if (ws[`P${r}`]) ws[`P${r}`].z = '#,##0.00" €"';
    if (ws[`Q${r}`]) ws[`Q${r}`].z = '#,##0.00" €"';
  }
  if (ws['C5']) ws['C5'].z = '0';
  if (ws['C6']) ws['C6'].z = '#,##0" h"';
  if (ws['C7']) ws['C7'].z = '0"%"';
  if (ws['C8']) ws['C8'].z = '0" días"';
  if (ws['C9']) ws['C9'].z = '#,##0.00" €"';
  if (ws['C10']) ws['C10'].z = '#,##0.00" €"';
  if (ws['C11']) ws['C11'].z = '0';
  if (ws['C12']) ws['C12'].z = '0';
  if (ws['C13']) ws['C13'].z = '#,##0.00" €"';
  if (ws['C31']) ws['C31'].z = '#,##0.00" h"';
  if (ws['C32']) ws['C32'].z = '#,##0.00" €/h"';
  if (ws['C33']) ws['C33'].z = '0.0000" h/día"';
  if (ws['C34']) ws['C34'].z = '0" días"';
  if (ws['C35']) ws['C35'].z = '+#,##0.00" h";-#,##0.00" h";0.00" h"';
  if (ws['C36']) ws['C36'].z = '#,##0.00" h"';
  if (ws['C37']) ws['C37'].z = '#,##0.00" h"';
  if (ws['C38']) ws['C38'].z = '#,##0.00" h"';
  if (ws['C39']) ws['C39'].z = '#,##0.00" h"';

  ws['!cols'] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 13 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 15 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ];

  ws['!rows'] = Array.from({ length: 39 }, (_, idx) => {
    if (idx === 0) return { hpt: 28 };
    if (idx === 1) return { hpt: 20 };
    if (idx === 14) return { hpt: 30 };
    if (idx >= 15 && idx <= 27) return { hpt: 22 };
    return { hpt: 20 };
  });

  const fileName = `Nomina_Bolsa_Horas_${p.anio}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, `Liquidacion_${p.anio}`);
  XLSX.writeFile(wb, fileName);
  return fileName;
}
