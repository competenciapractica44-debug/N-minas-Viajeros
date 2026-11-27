import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Layers,
  Sparkles,
  Edit3,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  Moon,
  ShieldCheck,
  Check,
  Coins,
  Award,
  Search,
  X,
  MapPin,
  Lock,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import {
  DayAssignment,
  ShiftDefinition,
  ExtraConcept,
  ConvenioInfo,
  WorkerProfile,
  ValidatedMonthRecord,
  ValidatedMonthsMap,
} from '../types';
import { formatCurrency } from '../utils/exporter';
import {
  formatMinutesToHoursAndMinutes,
  computeShiftRateFromConvenio,
  calculateTotalHours,
  calculateMonthlyConvenioHoursTarget,
  getDateRangeStrings,
  getExtrasDateRange,
  roundCurrency,
} from '../utils/calculator';
import { AnnualLiquidationResult, formatHoras } from '../utils/annualCalendar';
import {
  getEffectiveYearRate,
  getExplicitFestivasHoursFromExtras,
  getOfficialConvenioExtraAmount,
  isFTExtraName,
} from '../data/convenioZaragoza';
import { ALL_INITIAL_SHIFTS } from '../data/defaultTurnos';
import { getOfficialHolidaysForYear, DetectedHolidayInfo } from '../data/spanishHolidays';
import { ConfirmModal } from './ConfirmModal';

interface CalendarioViewProps {
  selectedYear: number;
  selectedMonth: number;
  onChangeMonth: (year: number, month: number) => void;
  assignments: DayAssignment[];
  onUpdateAssignment: (date: string, partial: Partial<DayAssignment>) => void;
  shifts: ShiftDefinition[];
  extrasList: ExtraConcept[];
  convenio: ConvenioInfo;
  profile?: WorkerProfile;
  onEditShift?: (shift: ShiftDefinition) => void;
  onOpenProfile?: () => void;
  validatedMonth?: ValidatedMonthRecord;
  validatedMonths?: ValidatedMonthsMap;
  annualSummary?: AnnualLiquidationResult;
  isValidatingMonth?: boolean;
  isRecalculating?: boolean;
  onRecalculate?: () => void;
  onValidateMonth?: () => Promise<{ success: boolean; driveSaved: boolean; message: string }>;
  onUnvalidateMonth?: () => Promise<void> | void;
  onGoToNomina?: () => void;
  hasUnsavedChanges?: boolean;
  isUpdatingDrive?: boolean;
  onActualizarDrive?: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const CalendarioView: React.FC<CalendarioViewProps> = ({
  selectedYear,
  selectedMonth,
  onChangeMonth,
  assignments,
  onUpdateAssignment,
  shifts,
  extrasList,
  convenio,
  profile,
  onEditShift,
  onOpenProfile,
  validatedMonth,
  validatedMonths,
  annualSummary,
  isValidatingMonth,
  isRecalculating,
  onRecalculate,
  onValidateMonth,
  onUnvalidateMonth,
  onGoToNomina,
  hasUnsavedChanges = false,
  isUpdatingDrive = false,
  onActualizarDrive,
}) => {
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [isAddingExtraModal, setIsAddingExtraModal] = useState(false);
  const [selectedExtraConceptId, setSelectedExtraConceptId] = useState('');
  const [customExtraName, setCustomExtraName] = useState('');
  const [customExtraAmount, setCustomExtraAmount] = useState(25.00);
  const [customExtraQuantity, setCustomExtraQuantity] = useState<number | undefined>(undefined);
  const [showRemoveShiftConfirm, setShowRemoveShiftConfirm] = useState(false);
  const [extraToRemove, setExtraToRemove] = useState<{ id: string; name: string } | null>(null);
  const [showIncompleteValidateConfirm, setShowIncompleteValidateConfirm] = useState(false);
  const [showUnvalidateConfirm, setShowUnvalidateConfirm] = useState(false);
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null);

  // Terminado más tarde del turno (horas y minutos sin pasos mínimos)
  const [isLateSectionOpen, setIsLateSectionOpen] = useState(false);
  const [lateHoursInput, setLateHoursInput] = useState(0);
  const [lateMinsInput, setLateMinsInput] = useState(0);
  const [lateReasonInput, setLateReasonInput] = useState('');

  // Modal tab selector (Concepto vs Terminado más tarde)
  const [modalExtraTab, setModalExtraTab] = useState<'concepto' | 'tiempo'>('concepto');
  const [modalLateHours, setModalLateHours] = useState(0);
  const [modalLateMins, setModalLateMins] = useState(40);
  const [modalLateReason, setModalLateReason] = useState('');

  // Buscador rápido e intuitivo de turnos
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerDayFilter, setPickerDayFilter] = useState<'todos' | 'laborable' | 'sabado' | 'festivo'>('laborable');
  const [pickerTimeFilter, setPickerTimeFilter] = useState<'todos' | 'mañana' | 'tarde' | 'noche' | 'reten' | 'reducido'>('todos');

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      onChangeMonth(selectedYear - 1, 12);
    } else {
      onChangeMonth(selectedYear, selectedMonth - 1);
    }
    setSelectedDayNumber(1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      onChangeMonth(selectedYear + 1, 1);
    } else {
      onChangeMonth(selectedYear, selectedMonth + 1);
    }
    setSelectedDayNumber(1);
  };

  // Calendar Math
  const isMonthLocked = Boolean(validatedMonth);
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0 is Sun, 1 is Mon
  const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // 0 = Mon, 6 = Sun

  const shiftsMap = useMemo(() => {
    const map = new Map<string, ShiftDefinition>();
    shifts.forEach((s) => map.set(s.code, s));
    return map;
  }, [shifts]);

  // Selected date string
  const selectedDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
    selectedDayNumber
  ).padStart(2, '0')}`;

  const currentAssignment = useMemo(() => {
    return (
      assignments.find((a) => a.date === selectedDateStr) || {
        date: selectedDateStr,
        shiftCode: undefined,
        extras: [],
      }
    );
  }, [assignments, selectedDateStr]);

  const currentShift = useMemo(() => {
    if (currentAssignment.shiftSnapshot) {
      return currentAssignment.shiftSnapshot;
    }
    if (!currentAssignment.shiftCode) return null;
    return (
      shiftsMap.get(currentAssignment.shiftCode) ||
      shifts.find((s) => s.code === currentAssignment.shiftCode)
    );
  }, [shiftsMap, shifts, currentAssignment.shiftCode, currentAssignment.shiftSnapshot]);

  const activeYearRate = useMemo(
    () => getEffectiveYearRate(convenio, selectedYear),
    [convenio, selectedYear]
  );
  const horaOrdinariaRate = activeYearRate.horaOrdinaria ?? 13.62;
  const plusRetenRate = activeYearRate.plusRetenDia ?? 8.25;
  const plusFestivoRate = activeYearRate.plusFestivoMayor4h ?? 40.80;
  const quebrantoRate = activeYearRate.quebrantoMonedaDia ?? 1.89;
  const plusConductorRate = activeYearRate.plusConductorPerceptorDia ?? 6.27;
  const medioPlusConductorRate =
    activeYearRate.plusConductorPerceptorDiaReducido ??
    parseFloat((plusConductorRate / 2).toFixed(2));
  const plusPuntualidadRate = activeYearRate.plusPuntualidadDia ?? 12.00;
  const isPuntualidadEnabledInProfile = profile?.hasPunctualityEarlyStartPlus === true;

  // Mapa anual de festivos oficiales (Nacionales, Regionales y Locales según ficha del chófer)
  const officialHolidaysMap = useMemo(
    () => getOfficialHolidaysForYear(selectedYear, profile?.autonomousCommunity || 'aragon', profile?.locality),
    [selectedYear, profile?.autonomousCommunity, profile?.locality]
  );

  const selectedDayOfficialHoliday: DetectedHolidayInfo | null =
    officialHolidaysMap.get(selectedDateStr) || null;

  // El Plus Festivo es siempre MANUAL (se activa vía isHoliday o extra heredado, sin duplicar)
  const hasManualPlusFestivo = Boolean(
    currentAssignment.isHoliday ||
    currentAssignment.extras?.some((e) => e.name.toLowerCase().includes('plus festivo'))
  );

  // Extra F/T (Fiesta / Trabajo) activo en el día seleccionado
  const hasManualFT = Boolean(
    currentAssignment.extras?.some((e) => isFTExtraName(e.name))
  );

  // Horas trabajadas del día seleccionado (turno + prolongación)
  const selectedDayShiftTotalHours = useMemo(() => {
    const isWorkingShift = Boolean(
      currentShift &&
      currentShift.code !== 'D' &&
      currentShift.code !== 'V' &&
      currentShift.code !== 'B' &&
      !currentAssignment.isRest &&
      !currentAssignment.isVacation &&
      !currentAssignment.isSickLeave
    );
    let shiftH = 0;
    if (isWorkingShift && currentShift) {
      if (currentAssignment.customStartTime && currentAssignment.customEndTime) {
        shiftH = calculateTotalHours(currentAssignment.customStartTime, currentAssignment.customEndTime);
      } else {
        shiftH = computeShiftRateFromConvenio(currentShift, activeYearRate).totalHours;
      }
    }
    const lateH = (currentAssignment.lateFinishMinutes || 0) / 60;
    return Math.round((shiftH + lateH) * 100) / 100;
  }, [currentShift, currentAssignment, activeYearRate]);

  // Extras visibles debajo del panel sin duplicar el Plus Festivo
  const visibleDayExtras = useMemo(
    () => (currentAssignment.extras || []).filter((e) => !e.name.toLowerCase().includes('plus festivo')),
    [currentAssignment.extras]
  );

  // Helper: vacation plus (10€/day at 100%, proportional to part-time % e.g. 7.50€/day at 75%)
  const isJornada100 = !profile || profile.contractType !== 'tiempo_parcial' || (profile.partTimePercentage || 100) >= 100;
  const partTimeFactorCal = !isJornada100 && profile?.partTimePercentage ? profile.partTimePercentage / 100 : 1;
  const isAutoVacationPlusActive = profile?.hasVacationPlus !== false;
  const appliesVacationPlus = isAutoVacationPlusActive;
  const effectiveVacationPlusDia = roundCurrency(((activeYearRate.plusVacacionesDia && activeYearRate.plusVacacionesDia > 0 ? activeYearRate.plusVacacionesDia : 10.00)) * partTimeFactorCal);

  // Tipo de jornada sugerido según el día seleccionado en el calendario
  const selectedDayTypeSuggested = useMemo<'laborable' | 'sabado' | 'festivo'>(() => {
    if (hasManualPlusFestivo || selectedDayOfficialHoliday) return 'festivo';
    const dObj = new Date(selectedYear, selectedMonth - 1, selectedDayNumber);
    const dow = dObj.getDay();
    if (dow === 0) return 'festivo';
    if (dow === 6) return 'sabado';
    return 'laborable';
  }, [selectedYear, selectedMonth, selectedDayNumber, hasManualPlusFestivo, selectedDayOfficialHoliday]);

  // Al cambiar de día, preseleccionar automáticamente el filtro acorde al día (L-V / Sáb / Dom-Fest)
  useEffect(() => {
    setPickerDayFilter(selectedDayTypeSuggested);
  }, [selectedDateStr, selectedDayTypeSuggested]);

  // Helper para comprobar si un turno coincide con una categoría de día
  const matchesDayCategory = (s: ShiftDefinition, filter: 'todos' | 'laborable' | 'sabado' | 'festivo') => {
    if (filter === 'todos') return true;
    if (s.dayType === 'todos') return true;
    if (s.dayType) return s.dayType === filter;
    if (filter === 'sabado') {
      return (
        s.title.toLowerCase().includes('sábado') ||
        (s.badges && s.badges.some((b) => b.toLowerCase().includes('sábado')))
      );
    }
    if (filter === 'festivo') {
      return (
        s.title.toLowerCase().includes('festivo') ||
        s.title.toLowerCase().includes('domingo') ||
        (s.badges && s.badges.some((b) => b.toLowerCase().includes('festivo') || b.toLowerCase().includes('domingo')))
      );
    }
    return false;
  };

  // Botones de acceso rápido contextuales (D, V + 4 turnos frecuentes/acordes al día)
  const quickShiftItems = useMemo(() => {
    const fallbackByDayType: Record<'laborable' | 'sabado' | 'festivo', string[]> = {
      laborable: ['6V.L01', '6V.L02', '6V.LR1', '6V.L40'],
      sabado: ['6.S02', '6.S07', '6.R01S', '6.S01'],
      festivo: ['6.D03', '6.D12', '6.R01F', '6.D01'],
    };

    // Contabilizar turnos más usados por el conductor para el tipo de día seleccionado
    const usageCount = new Map<string, number>();
    assignments.forEach((a) => {
      if (!a.shiftCode || a.shiftCode === 'D' || a.shiftCode === 'V' || a.shiftCode === 'B') return;
      const def = a.shiftSnapshot || shiftsMap.get(a.shiftCode);
      if (def && matchesDayCategory(def, selectedDayTypeSuggested)) {
        usageCount.set(a.shiftCode, (usageCount.get(a.shiftCode) || 0) + 1);
      }
    });

    const mostUsedCodes = Array.from(usageCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code);

    const chosenCodes: string[] = [];
    for (const c of [...mostUsedCodes, ...fallbackByDayType[selectedDayTypeSuggested]]) {
      if (chosenCodes.length >= 4) break;
      if (!chosenCodes.includes(c) && (shiftsMap.has(c) || shifts.some((s) => s.code === c))) {
        chosenCodes.push(c);
      }
    }

    const workCards = chosenCodes.map((code) => {
      const shiftDef = shiftsMap.get(code) || shifts.find((s) => s.code === code)!;
      const calc = computeShiftRateFromConvenio(shiftDef, activeYearRate);
      const isReten = Boolean(calc.hasReten);
      const typeLabel = isReten
        ? 'Retén'
        : calc.isReducedConductorPlus
        ? '<4h · 1/2 Plus'
        : shiftDef.category === 'mañana'
        ? 'Mañana'
        : shiftDef.category === 'tarde'
        ? 'Tarde'
        : 'Noche';
      return {
        code: shiftDef.code,
        label: `${typeLabel} · ${shiftDef.drivingDuration || `${calc.totalHours}h`}`,
        rate: calc.totalRate,
        color: shiftDef.color,
        subtitle: `${shiftDef.startTime}-${shiftDef.endTime}`,
        isUsedRecently: usageCount.has(code),
      };
    });

    return [
      {
        code: 'D',
        label: 'Fiesta / Descanso',
        rate: 0,
        color: '#10b981',
        subtitle: 'Libre',
        isUsedRecently: false,
      },
      {
        code: 'V',
        label: 'Vacaciones',
        rate: roundCurrency(activeYearRate.salarioBaseDia * partTimeFactorCal) + (appliesVacationPlus ? effectiveVacationPlusDia : 0),
        color: '#06b6d4',
        subtitle: appliesVacationPlus ? `+${formatCurrency(effectiveVacationPlusDia)}` : 'Base',
        isUsedRecently: false,
      },
      {
        code: 'B',
        label: 'Baja Médica',
        rate: 0,
        color: '#e11d48',
        subtitle: 'IT',
        isUsedRecently: false,
      },
      ...workCards,
    ];
  }, [
    assignments,
    shifts,
    shiftsMap,
    selectedDayTypeSuggested,
    activeYearRate,
    appliesVacationPlus,
    partTimeFactorCal,
    effectiveVacationPlusDia,
  ]);

  // Turnos filtrados y contadores para el buscador visual de turnos
  const { pickerDayCounts, pickerFilteredShifts, pickerUsedFallbackAllDays } = useMemo(() => {
    const workShifts = shifts.filter((s) => s.code !== 'D' && s.code !== 'V' && s.code !== 'B');
    const counts = {
      todos: workShifts.length,
      laborable: 0,
      sabado: 0,
      festivo: 0,
    };

    workShifts.forEach((s) => {
      if (matchesDayCategory(s, 'laborable')) counts.laborable++;
      if (matchesDayCategory(s, 'sabado')) counts.sabado++;
      if (matchesDayCategory(s, 'festivo')) counts.festivo++;
    });

    const query = pickerSearch.trim().toLowerCase();

    const filterList = (dayFilter: 'todos' | 'laborable' | 'sabado' | 'festivo') => {
      return workShifts.filter((s) => {
        if (!matchesDayCategory(s, dayFilter)) return false;

        const isReten = Boolean(
          s.hasPlusReten ||
          s.code.includes('.LR') ||
          s.code.includes('.R0') ||
          s.title.toLowerCase().includes('retén') ||
          s.title.toLowerCase().includes('reten')
        );
        const calc = computeShiftRateFromConvenio(s, activeYearRate);

        if (pickerTimeFilter === 'mañana' && s.category !== 'mañana') return false;
        if (pickerTimeFilter === 'tarde' && s.category !== 'tarde') return false;
        if (pickerTimeFilter === 'noche' && s.category !== 'noche') return false;
        if (pickerTimeFilter === 'reten' && !isReten) return false;
        if (pickerTimeFilter === 'reducido' && !(calc.totalHours > 0 && calc.totalHours < 4 && !isReten)) return false;

        if (!query) return true;

        const shortCode = s.code.replace(/^6V\./i, '').replace(/^6\./i, '').toLowerCase();
        const searchable = [
          s.code,
          shortCode,
          s.startTime,
          s.endTime,
          `${s.startTime}-${s.endTime}`,
          s.drivingDuration,
          s.category,
          s.title,
          isReten ? 'reten retén' : '',
          calc.isReducedConductorPlus ? 'medio 1/2 reducido <4h' : '',
          ...(s.badges || []),
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(query);
      });
    };

    let matched = filterList(pickerDayFilter);
    let usedFallback = false;

    // Si el usuario escribe un código específico (ej. "S05" estando en L-V) y no aparece en el filtro de día, buscar en todos
    if (query && matched.length === 0 && pickerDayFilter !== 'todos') {
      const globalMatched = filterList('todos');
      if (globalMatched.length > 0) {
        matched = globalMatched;
        usedFallback = true;
      }
    }

    return {
      pickerDayCounts: counts,
      pickerFilteredShifts: matched,
      pickerUsedFallbackAllDays: usedFallback,
    };
  }, [shifts, pickerSearch, pickerDayFilter, pickerTimeFilter, activeYearRate]);

  // Sync late finish inputs when selected day or assignment changes
  useEffect(() => {
    const mins = currentAssignment.lateFinishMinutes || 0;
    const h = currentAssignment.lateFinishHours !== undefined
      ? currentAssignment.lateFinishHours
      : Math.floor(mins / 60);
    const m = currentAssignment.lateFinishMins !== undefined
      ? currentAssignment.lateFinishMins
      : mins % 60;
    setLateHoursInput(h);
    setLateMinsInput(m);
    setLateReasonInput(currentAssignment.lateFinishReason || '');
    if (mins > 0) {
      setIsLateSectionOpen(true);
    }
  }, [
    selectedDateStr,
    currentAssignment.lateFinishMinutes,
    currentAssignment.lateFinishHours,
    currentAssignment.lateFinishMins,
    currentAssignment.lateFinishReason,
  ]);

  // Save / Update late finish
  const handleSaveLateFinish = (hours: number, minutes: number, reason: string) => {
    if (isMonthLocked) {
      setShowUnvalidateConfirm(true);
      return;
    }
    const safeH = Math.max(0, isNaN(hours) ? 0 : Math.floor(hours));
    const safeM = Math.max(0, isNaN(minutes) ? 0 : Math.round(minutes));
    const totalMinutes = safeH * 60 + safeM;
    const amount = totalMinutes > 0 ? parseFloat(((totalMinutes / 60) * horaOrdinariaRate).toFixed(2)) : 0;

    onUpdateAssignment(selectedDateStr, {
      lateFinishMinutes: totalMinutes,
      lateFinishHours: safeH,
      lateFinishMins: safeM,
      lateFinishAmount: amount,
      lateFinishReason: reason.trim() || undefined,
    });
  };

  const handleClearLateFinish = () => {
    if (isMonthLocked) {
      setShowUnvalidateConfirm(true);
      return;
    }
    setLateHoursInput(0);
    setLateMinsInput(0);
    setLateReasonInput('');
    setIsLateSectionOpen(false);
    onUpdateAssignment(selectedDateStr, {
      lateFinishMinutes: 0,
      lateFinishHours: 0,
      lateFinishMins: 0,
      lateFinishAmount: 0,
      lateFinishReason: undefined,
    });
  };

  // Counters
  const counters = useMemo(() => {
    const normDate = (raw?: string): string => {
      if (!raw) return '';
      const trimmed = String(raw).trim().split('T')[0];
      const m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return trimmed;
    };

    const asgByDate = new Map<string, DayAssignment>();
    for (const a of assignments) {
      const k = normDate(a.date);
      if (!k) continue;
      const existing = asgByDate.get(k);
      const hasContent = Boolean(
        (a.shiftCode && a.shiftCode.trim() !== '') ||
          (a.shiftId && a.shiftId.trim() !== '') ||
          a.isRest ||
          a.isVacation ||
          a.isSickLeave ||
          a.isHoliday ||
          (a.extras && a.extras.length > 0) ||
          (a.lateFinishMinutes && a.lateFinishMinutes > 0)
      );
      if (!existing || hasContent) {
        asgByDate.set(k, { ...a, date: k });
      }
    }

    const resolveShiftCal = (asg: DayAssignment): ShiftDefinition | undefined => {
      if (asg.shiftSnapshot) return asg.shiftSnapshot;
      const cleanCode = asg.shiftCode ? String(asg.shiftCode).trim().replace(/\/L/gi, '') : '';
      if (cleanCode) {
        const direct = shiftsMap.get(cleanCode);
        if (direct) return direct;
        const upper = cleanCode.toUpperCase();
        const byCode =
          shifts.find((s) => s.code.trim().toUpperCase() === upper) ||
          ALL_INITIAL_SHIFTS.find((s) => s.code.trim().toUpperCase() === upper);
        if (byCode) return byCode;
      }
      if (asg.shiftId) {
        const byId =
          shifts.find((s) => s.id === asg.shiftId) ||
          ALL_INITIAL_SHIFTS.find((s) => s.id === asg.shiftId);
        if (byId) return byId;
      }
      return undefined;
    };

    let turnosCount = 0;
    let descansosCount = 0;
    let vacacionesCount = 0;
    let bajasCount = 0;
    let festivosCount = 0;
    let extrasTotal = 0;
    let monthWorkedHours = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const asg = asgByDate.get(dStr);
      if (asg) {
        const dayHasPlusFestivoExtra = Boolean(asg.extras?.some((e) => e.name.toLowerCase().includes('plus festivo')));
        if (asg.isHoliday || dayHasPlusFestivoExtra) {
          festivosCount++;
        }
        let dayShiftWorkedH = 0;
        const uc = asg.shiftCode?.trim().toUpperCase();
        if (asg.isRest || uc === 'D' || asg.shiftId === 'D') {
          descansosCount++;
        } else if (asg.isVacation || uc === 'V' || asg.shiftId === 'V') {
          vacacionesCount++;
        } else if (asg.isSickLeave || uc === 'B' || asg.shiftId === 'B') {
          bajasCount++;
        } else if (asg.shiftCode || asg.shiftId || (asg.customStartTime && asg.customEndTime)) {
          turnosCount++;
          const shiftDef = resolveShiftCal(asg);
          if (asg.customStartTime && asg.customEndTime) {
            dayShiftWorkedH = calculateTotalHours(asg.customStartTime, asg.customEndTime);
            monthWorkedHours += dayShiftWorkedH;
          } else if (shiftDef) {
            dayShiftWorkedH = computeShiftRateFromConvenio(shiftDef, activeYearRate).totalHours;
            monthWorkedHours += dayShiftWorkedH;
          }
        }
        const dayLateH = (asg.lateFinishMinutes || 0) / 60;
        const dayTotalWithLate = dayShiftWorkedH + dayLateH;
        if (asg.extras) {
          asg.extras.forEach((e) => {
            const lowerName = e.name.toLowerCase();
            if (asg.isHoliday && lowerName.includes('plus festivo')) return;
            if (!isPuntualidadEnabledInProfile && (lowerName.includes('puntualidad') || lowerName.includes('inicio temprano'))) return;
            if (isFTExtraName(e.name)) {
              const ftHrs = dayTotalWithLate > 0
                ? dayTotalWithLate
                : (e.quantity && e.quantity > 0 ? e.quantity : (e.amount > 0 ? e.amount / horaOrdinariaRate : 0));
              extrasTotal += parseFloat((ftHrs * horaOrdinariaRate).toFixed(2));
              return;
            }
            const convAmt = getOfficialConvenioExtraAmount(e.name, activeYearRate);
            const qty = e.quantity && e.quantity > 0 ? e.quantity : 1;
            const isHourlyOfficial =
              lowerName.includes('festiva') ||
              lowerName.includes('complementaria');
            const effectiveAmt =
              convAmt !== null
                ? (isHourlyOfficial && e.quantity === undefined ? e.amount : parseFloat((qty * convAmt).toFixed(2)))
                : e.amount;
            extrasTotal += effectiveAmt;
          });
        }
        if (asg.lateFinishMinutes && asg.lateFinishMinutes > 0) {
          const lateAmt = parseFloat(((asg.lateFinishMinutes / 60) * horaOrdinariaRate).toFixed(2));
          extrasTotal += lateAmt;
          monthWorkedHours += asg.lateFinishMinutes / 60;
        }
      }
    }
    const cutoffModeCal = profile?.extrasCutoffMode || 'direxis_25_24';
    const customStartDayCal = profile?.customCutoffStartDay || 25;
    const cutoffRangeCal = getExtrasDateRange(
      selectedYear,
      selectedMonth,
      cutoffModeCal,
      customStartDayCal
    );
    const cutoffDatesCal = getDateRangeStrings(
      cutoffRangeCal.startDateStr,
      cutoffRangeCal.endDateStr
    );
    let cutoffTurnosCount = 0;
    let cutoffWorkedHours = 0;
    let cutoffOrdinaryHours = 0;
    for (const cDateStr of cutoffDatesCal) {
      const asg = asgByDate.get(cDateStr);
      if (!asg) continue;
      const uc = asg.shiftCode?.trim().toUpperCase();
      if (
        asg.isRest ||
        uc === 'D' ||
        asg.shiftId === 'D' ||
        asg.isVacation ||
        uc === 'V' ||
        asg.shiftId === 'V' ||
        asg.isSickLeave ||
        uc === 'B' ||
        asg.shiftId === 'B'
      ) {
        continue;
      }
      const isMarkedHoliday = Boolean(
        asg.isHoliday || asg.extras?.some((e) => e.name.toLowerCase().includes('plus festivo'))
      );
      const isMarkedFT = Boolean(asg.extras?.some((e) => isFTExtraName(e.name)));
      const dayExplicitFestivaHours = getExplicitFestivasHoursFromExtras(
        asg.extras,
        horaOrdinariaRate
      );

      let dayTotalHours = 0;
      const hasCustomTimes = Boolean(asg.customStartTime && asg.customEndTime);
      const shiftDef = resolveShiftCal(asg);
      const hasWorkedShift = Boolean(
        (shiftDef && shiftDef.code !== 'D' && shiftDef.code !== 'V' && shiftDef.code !== 'B') ||
          (!shiftDef && (asg.shiftCode || asg.shiftId || hasCustomTimes))
      );
      if (hasWorkedShift) {
        cutoffTurnosCount++;
        if (hasCustomTimes && asg.customStartTime && asg.customEndTime) {
          dayTotalHours = calculateTotalHours(asg.customStartTime, asg.customEndTime);
        } else if (shiftDef) {
          dayTotalHours = computeShiftRateFromConvenio(shiftDef, activeYearRate).totalHours;
        }
      }
      if (asg.lateFinishMinutes && asg.lateFinishMinutes > 0) {
        dayTotalHours += asg.lateFinishMinutes / 60;
      }
      if (dayTotalHours > 0) {
        cutoffWorkedHours += dayTotalHours;
        if (!isMarkedHoliday && !isMarkedFT) {
          const nonFestivaH = Math.max(0, dayTotalHours - dayExplicitFestivaHours);
          cutoffOrdinaryHours += Math.min(9, nonFestivaH);
        }
      }
    }

    return {
      turnosCount,
      cutoffTurnosCount,
      descansosCount,
      vacacionesCount,
      bajasCount,
      festivosCount,
      extrasTotal,
      monthWorkedHours: Math.round(monthWorkedHours * 100) / 100,
      cutoffWorkedHours: Math.round(cutoffWorkedHours * 100) / 100,
      cutoffOrdinaryHours: Math.round(cutoffOrdinaryHours * 100) / 100,
      cutoffPeriodText: cutoffRangeCal.periodText,
      isNaturalCutoff: cutoffModeCal === 'mes_natural',
    };
  }, [assignments, daysInMonth, selectedYear, selectedMonth, horaOrdinariaRate, activeYearRate, shiftsMap, shifts, isPuntualidadEnabledInProfile, profile?.extrasCutoffMode, profile?.customCutoffStartDay]);

  const convenioAnnualTargetCal = parseFloat(
    (((activeYearRate.horasJornadaAnual && activeYearRate.horasJornadaAnual > 0 ? activeYearRate.horasJornadaAnual : 1776)) * partTimeFactorCal).toFixed(2)
  );
  const monthPrefixCal = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-`;
  const vacationDaysCal = assignments.filter(
    (a) => a.date?.startsWith(monthPrefixCal) && (a.isVacation || a.shiftCode?.trim().toUpperCase() === 'V' || a.shiftId === 'V')
  ).length;
  const sickDaysCal = assignments.filter(
    (a) => a.date?.startsWith(monthPrefixCal) && (a.isSickLeave || a.shiftCode?.trim().toUpperCase() === 'B' || a.shiftId === 'B')
  ).length;
  const monthlyTargetInfoCal = calculateMonthlyConvenioHoursTarget(
    convenioAnnualTargetCal,
    selectedYear,
    selectedMonth,
    vacationDaysCal,
    sickDaysCal
  );
  const convenioMonthlyTargetCal = monthlyTargetInfoCal.monthlyTargetHours;

  // Estado de Retén, Quebranto de Moneda y Plus Conductor (entero o mitad) para el día seleccionado
  const dayPlusStatus = useMemo(() => {
    const dayExtras = currentAssignment.extras || [];
    const isWorkingShift = Boolean(
      currentShift &&
      currentShift.code !== 'D' &&
      currentShift.code !== 'V' &&
      currentShift.code !== 'B' &&
      !currentAssignment.isRest &&
      !currentAssignment.isVacation &&
      !currentAssignment.isSickLeave
    );

    const hasRetenShift = Boolean(
      currentShift &&
      (currentShift.hasPlusReten !== undefined
        ? currentShift.hasPlusReten
        : (currentShift.code.includes('.LR') ||
          currentShift.code.includes('.R0') ||
          currentShift.title.toLowerCase().includes('retén') ||
          currentShift.title.toLowerCase().includes('reten')))
    );
    const hasRetenExtra = dayExtras.some((e) => {
      const l = e.name.toLowerCase();
      return l.includes('reten') || l.includes('retén');
    });
    const isRetenOnDay = hasRetenShift || hasRetenExtra;

    let effectiveShiftHours = 0;
    if (isWorkingShift && currentShift) {
      if (currentAssignment.customStartTime && currentAssignment.customEndTime) {
        effectiveShiftHours = calculateTotalHours(
          currentAssignment.customStartTime,
          currentAssignment.customEndTime
        );
      } else {
        effectiveShiftHours = computeShiftRateFromConvenio(currentShift, activeYearRate).totalHours;
      }
    }

    const hasExplicitQuebranto = dayExtras.some((e) => e.name.toLowerCase().includes('quebranto'));
    const hasExplicitMedioPlus = dayExtras.some((e) => {
      const l = e.name.toLowerCase();
      return l.includes('1/2') || l.includes('medio plus');
    });
    const hasExplicitFullConductor = dayExtras.some((e) => {
      const l = e.name.toLowerCase();
      return l.includes('plus conductor') && !l.includes('1/2') && !l.includes('medio plus');
    });

    const hasQuebranto =
      !isRetenOnDay &&
      ((isWorkingShift &&
        profile?.hasMonetaryQuebranto !== false &&
        currentShift?.hasQuebrantoMoneda !== false) ||
        hasExplicitQuebranto);

    const hasHalfConductorPlus =
      !isRetenOnDay &&
      !hasExplicitFullConductor &&
      (hasExplicitMedioPlus ||
        (isWorkingShift &&
          profile?.hasConductorPerceptorPlus !== false &&
          currentShift?.hasConductorPerceptor !== false &&
          effectiveShiftHours > 0 &&
          effectiveShiftHours < 4));

    const hasFullConductorPlus =
      !isRetenOnDay &&
      !hasHalfConductorPlus &&
      (hasExplicitFullConductor ||
        (isWorkingShift &&
          profile?.hasConductorPerceptorPlus !== false &&
          currentShift?.hasConductorPerceptor !== false &&
          (effectiveShiftHours >= 4 || effectiveShiftHours === 0)));

    return {
      hasRetenShift,
      isRetenOnDay,
      hasQuebranto,
      hasHalfConductorPlus,
      hasFullConductorPlus,
      hasExplicitQuebranto,
      hasExplicitMedioPlus,
      hasExplicitFullConductor,
    };
  }, [
    currentShift,
    currentAssignment.extras,
    currentAssignment.isRest,
    currentAssignment.isVacation,
    currentAssignment.isSickLeave,
    currentAssignment.customStartTime,
    currentAssignment.customEndTime,
    activeYearRate,
    profile?.hasMonetaryQuebranto,
    profile?.hasConductorPerceptorPlus,
  ]);

  // Day subtotal devengado (en bruto según Convenio)
  const selectedDayTotal = useMemo(() => {
    let base = 0;
    const yearRate = activeYearRate;
    const isHoliday = hasManualPlusFestivo;

    if (currentShift) {
      if (currentShift.code === 'D' || currentShift.code === 'B') {
        base = isHoliday ? plusFestivoRate : 0;
      } else if (currentShift.code === 'V') {
        const baseDia = roundCurrency(yearRate.salarioBaseDia * partTimeFactorCal);
        const plusVac = appliesVacationPlus ? effectiveVacationPlusDia : 0;
        base = baseDia + plusVac + (isHoliday ? plusFestivoRate : 0);
      } else {
        const shiftCalc = computeShiftRateFromConvenio(currentShift, yearRate, { isHoliday });
        base = shiftCalc.totalRate;
      }
    } else if (isHoliday) {
      base = plusFestivoRate;
    }

    const autoQuebranto =
      dayPlusStatus.hasQuebranto && !dayPlusStatus.hasExplicitQuebranto ? quebrantoRate : 0;
    const autoConductorPlus =
      dayPlusStatus.hasHalfConductorPlus && !dayPlusStatus.hasExplicitMedioPlus
        ? medioPlusConductorRate
        : dayPlusStatus.hasFullConductorPlus && !dayPlusStatus.hasExplicitFullConductor
        ? plusConductorRate
        : 0;

    const extrasSum =
      currentAssignment.extras?.reduce((sum, e) => {
        const lower = e.name.toLowerCase();
        // Evitar doble cómputo de Plus Festivo, Retén, Quebranto, Conductor o F/T sobre turno ya valorado en base
        if (lower.includes('plus festivo')) {
          return sum;
        }
        if (isFTExtraName(e.name)) {
          if (currentShift && currentShift.code !== 'D' && currentShift.code !== 'V' && currentShift.code !== 'B') {
            return sum;
          }
          const ftHrs = e.quantity && e.quantity > 0 ? e.quantity : (e.amount > 0 ? e.amount / horaOrdinariaRate : 0);
          return sum + parseFloat((ftHrs * horaOrdinariaRate).toFixed(2));
        }
        if ((lower.includes('reten') || lower.includes('retén')) && dayPlusStatus.hasRetenShift) {
          return sum;
        }
        if (
          !isPuntualidadEnabledInProfile &&
          (lower.includes('puntualidad') || lower.includes('inicio temprano'))
        ) {
          return sum;
        }
        if (
          dayPlusStatus.isRetenOnDay &&
          (lower.includes('quebranto') || lower.includes('plus conductor') || lower.includes('1/2') || lower.includes('medio plus'))
        ) {
          return sum;
        }
        const convAmt = getOfficialConvenioExtraAmount(e.name, yearRate);
        const qty = e.quantity && e.quantity > 0 ? e.quantity : 1;
        const isHourlyOfficial = lower.includes('festiva') || lower.includes('complementaria');
        const effectiveAmt =
          convAmt !== null
            ? (isHourlyOfficial && e.quantity === undefined ? e.amount : parseFloat((qty * convAmt).toFixed(2)))
            : e.amount;
        return sum + effectiveAmt;
      }, 0) || 0;
    const lateAmt = currentAssignment.lateFinishMinutes
      ? parseFloat(((currentAssignment.lateFinishMinutes / 60) * horaOrdinariaRate).toFixed(2))
      : 0;
    return base + autoQuebranto + autoConductorPlus + extrasSum + lateAmt;
  }, [
    currentShift,
    currentAssignment.extras,
    currentAssignment.lateFinishMinutes,
    hasManualPlusFestivo,
    plusFestivoRate,
    activeYearRate,
    partTimeFactorCal,
    effectiveVacationPlusDia,
    appliesVacationPlus,
    horaOrdinariaRate,
    dayPlusStatus,
    quebrantoRate,
    plusConductorRate,
    medioPlusConductorRate,
    isPuntualidadEnabledInProfile,
  ]);

  // Date formatted in human Spanish
  const formattedDayTitle = useMemo(() => {
    const dObj = new Date(selectedYear, selectedMonth - 1, selectedDayNumber);
    const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(dObj);
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${selectedDayNumber} de ${
      MONTH_NAMES[selectedMonth - 1]
    }`;
  }, [selectedYear, selectedMonth, selectedDayNumber]);

  // Assign shift quickly
  const handleAssignShift = (code: string) => {
    if (isMonthLocked) {
      setShowUnvalidateConfirm(true);
      return;
    }
    const shift = shiftsMap.get(code) || shifts.find((s) => s.code === code);
    const isReten = Boolean(
      shift?.hasPlusReten !== undefined
        ? shift.hasPlusReten
        : (code.includes('.LR') ||
          code.includes('.R0') ||
          shift?.title.toLowerCase().includes('retén') ||
          shift?.title.toLowerCase().includes('reten'))
    );

    let updatedExtras = currentAssignment.extras || [];
    // Si el turno asignado es de retén, quitar el quebranto de moneda y el plus conductor perceptor (y retén manual duplicado)
    if (isReten) {
      updatedExtras = updatedExtras.filter((e) => {
        const l = e.name.toLowerCase();
        return !l.includes('quebranto') && !l.includes('plus conductor') && !l.includes('medio plus') && !l.includes('reten') && !l.includes('retén');
      });
    }

    onUpdateAssignment(selectedDateStr, {
      shiftCode: code,
      shiftId: shift?.id,
      shiftSnapshot: undefined,
      isRest: code === 'D',
      isVacation: code === 'V',
      isSickLeave: code === 'B',
      extras: updatedExtras,
    });
  };

  // Add extra to selected day
  const handleAddExtraToDay = () => {
    if (isMonthLocked) {
      setShowUnvalidateConfirm(true);
      return;
    }
    let name = customExtraName;
    let amount = customExtraAmount;

    if (selectedExtraConceptId) {
      const concept = extrasList.find((e) => e.id === selectedExtraConceptId);
      if (concept) {
        name = concept.name;
        const convAmt = getOfficialConvenioExtraAmount(concept.name, activeYearRate);
        amount = convAmt ?? concept.amount;
      }
    }

    if (!name) return;

    const lowerName = name.toLowerCase();
    // Si añaden Plus Festivo desde el modal, activamos isHoliday sin duplicar ítem en extras
    if (lowerName.includes('plus festivo')) {
      const cleaned = (currentAssignment.extras || []).filter((e) => !e.name.toLowerCase().includes('plus festivo'));
      onUpdateAssignment(selectedDateStr, {
        isHoliday: true,
        extras: cleaned,
      });
      setIsAddingExtraModal(false);
      setSelectedExtraConceptId('');
      setCustomExtraName('');
      return;
    }

    const isAddingReten = lowerName.includes('reten') || lowerName.includes('retén');
    const isAddingQuebrantoOrConductor =
      lowerName.includes('quebranto') ||
      lowerName.includes('plus conductor') ||
      lowerName.includes('medio plus');

    const currentExtras = currentAssignment.extras || [];
    const dayHasRetenShift = Boolean(
      currentShift &&
      (currentShift.hasPlusReten !== undefined
        ? currentShift.hasPlusReten
        : (currentShift.code.includes('.LR') ||
          currentShift.code.includes('.R0') ||
          currentShift.title.toLowerCase().includes('retén') ||
          currentShift.title.toLowerCase().includes('reten')))
    );
    const dayHasRetenExtra = currentExtras.some(
      (e) => e.name.toLowerCase().includes('reten') || e.name.toLowerCase().includes('retén')
    );

    // En turnos con retén no aplica quebranto ni conductor perceptor
    if ((dayHasRetenShift || dayHasRetenExtra) && isAddingQuebrantoOrConductor) {
      alert(
        'En los turnos con Plus de Retén no aplica el Quebranto de moneda ni el Plus Conductor-Perceptor al tratarse de un servicio de disponibilidad sin venta de billetes.'
      );
      return;
    }

    let updatedExtras = [...currentExtras];

    // Si se añade como extra el plus de retén, usa la cuantía del convenio
    // y hay que quitar de ese turno el quebranto de moneda y el plus de conductor perceptor
    if (isAddingReten) {
      amount = plusRetenRate;
      updatedExtras = updatedExtras.filter((e) => {
        const l = e.name.toLowerCase();
        return !l.includes('quebranto') && !l.includes('plus conductor') && !l.includes('medio plus');
      });
    }

    const newExtra = {
      id: `dayextra-${Date.now()}`,
      conceptId: selectedExtraConceptId || undefined,
      name,
      amount: isAddingReten ? plusRetenRate : amount,
      ...(customExtraQuantity !== undefined && customExtraQuantity > 0 ? { quantity: customExtraQuantity } : {}),
    };

    updatedExtras.push(newExtra);

    onUpdateAssignment(selectedDateStr, {
      extras: updatedExtras,
    });

    setIsAddingExtraModal(false);
    setSelectedExtraConceptId('');
    setCustomExtraName('');
    setCustomExtraQuantity(undefined);
  };

  const handleRemoveExtra = (extraId: string) => {
    if (isMonthLocked) {
      setShowUnvalidateConfirm(true);
      return;
    }
    const currentExtras = currentAssignment.extras || [];
    onUpdateAssignment(selectedDateStr, {
      extras: currentExtras.filter((e) => e.id !== extraId),
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-3 pb-24 space-y-4">
      {/* Month Navigation & Title */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          title="Mes anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </h2>
          <p className="text-xs text-blue-600 font-medium">Convenio Transporte Zaragoza</p>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          title="Mes siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* KPI Counters Banner matching screenshot 3 */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-semibold py-1">
        <span className="flex items-center gap-1.5 text-slate-700">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          {!counters.isNaturalCutoff ? (
            <>
              <strong>{counters.cutoffTurnosCount}</strong> Turnos ({counters.cutoffPeriodText}){' '}
              <span className="text-[11px] text-slate-500 font-normal">({counters.turnosCount} mes)</span>
            </>
          ) : (
            <>
              <strong>{counters.turnosCount}</strong> Turnos
            </>
          )}
        </span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5 text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          <strong>{counters.descansosCount}</strong> Descansos
        </span>
        {counters.vacacionesCount > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5 text-cyan-800">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              <strong>{counters.vacacionesCount}</strong> Vacaciones
            </span>
          </>
        )}
        {counters.bajasCount > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5 text-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              <strong>{counters.bajasCount}</strong> {counters.bajasCount === 1 ? 'Baja IT' : 'Bajas IT'}
            </span>
          </>
        )}
        {counters.festivosCount > 0 && (
          <>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5 text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <span className="text-xs">🎉</span>
              <strong>{counters.festivosCount}</strong> Festivo{counters.festivosCount > 1 ? 's' : ''}
            </span>
          </>
        )}
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5 text-slate-700">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <strong>{counters.extrasTotal > 0 ? `+${formatCurrency(counters.extrasTotal)}` : '0€'}</strong> Extras
        </span>
      </div>

      {/* Convenio Art. 14 Target Hours Indicator */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-blue-950">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>
            <strong>Jornada Convenio ({Math.round(partTimeFactorCal * 100)}%):</strong>{' '}
            <strong className="font-mono">{convenioAnnualTargetCal.toLocaleString('es-ES')} h/año</strong>{' '}
            <span className="text-blue-700">
              (Obj. {MONTH_NAMES[selectedMonth - 1]} {monthlyTargetInfoCal.activeDaysInMonth}d/{monthlyTargetInfoCal.daysInMonth}d: {convenioMonthlyTargetCal.toLocaleString('es-ES')} h · base {monthlyTargetInfoCal.activeDaysInYear}d/año)
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono font-bold text-blue-800">
          {!counters.isNaturalCutoff && (
            <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-900 border border-blue-200">
              Ciclo {counters.cutoffPeriodText} ({counters.cutoffTurnosCount}t):{' '}
              {counters.cutoffOrdinaryHours.toLocaleString('es-ES')} h ord.
              {counters.cutoffWorkedHours > counters.cutoffOrdinaryHours + 0.004
                ? ` (${counters.cutoffWorkedHours.toLocaleString('es-ES')} h tot.)`
                : ''}
            </span>
          )}
          <span className="text-blue-700">
            Mes nat. ({counters.turnosCount}t): {counters.monthWorkedHours.toLocaleString('es-ES')} h
          </span>
          {onActualizarDrive && (
            <button
              type="button"
              onClick={onActualizarDrive}
              disabled={!hasUnsavedChanges || isUpdatingDrive}
              className={`font-sans inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
                isUpdatingDrive
                  ? 'bg-amber-500 text-white border-amber-600 cursor-wait'
                  : hasUnsavedChanges
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-300/70 cursor-pointer'
                  : 'bg-white/80 text-slate-400 border-slate-200 cursor-default'
              }`}
            >
              {isUpdatingDrive ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : hasUnsavedChanges ? (
                <RefreshCw className="w-3 h-3" />
              ) : (
                <Check className="w-3 h-3 text-emerald-500" />
              )}
              <span>{isUpdatingDrive ? 'Actualizando...' : hasUnsavedChanges ? 'Actualizar Drive' : 'Actualizado'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Validación Mensual (congela % jornada, % IRPF, nómina y arrastra saldo de horas al resto del año) */}
      {onValidateMonth && (() => {
        const filledDaysCount =
          counters.turnosCount + counters.descansosCount + counters.vacacionesCount + counters.bajasCount;
        const isMonthComplete = filledDaysCount >= daysInMonth;
        const currentJornadaPctCal = Math.round(partTimeFactorCal * 100);
        const currentIrpfCal = profile?.irpfPercentage ?? 0;

        const triggerValidation = async () => {
          const res = await onValidateMonth();
          if (res?.message) {
            setValidationFeedback(res.message);
            window.setTimeout(() => setValidationFeedback(null), 6000);
          }
        };

        return (
          <div
            className={`rounded-2xl border p-3.5 space-y-2 text-xs transition-colors ${
              validatedMonth
                ? 'bg-emerald-50/85 border-emerald-300 text-emerald-950'
                : isMonthComplete
                ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {validatedMonth ? (
                    <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                  <span className="font-extrabold text-xs">
                    {validatedMonth
                      ? `Mes validado · ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                      : `Validar mes completo (${filledDaysCount}/${daysInMonth} días rellenados)`}
                  </span>
                  {validatedMonth ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 font-bold text-[10px]">
                      Jornada {validatedMonth.jornadaPct}% · IRPF {validatedMonth.irpfPercentage}%
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px]">
                      BD actual: Jornada {currentJornadaPctCal}% · IRPF {currentIrpfCal}%
                    </span>
                  )}
                </div>
                {validatedMonth ? (
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    Nómina cerrada en{' '}
                    <strong className="font-mono">
                      {formatCurrency(validatedMonth.payrollSnapshot.liquidoPercibir)}
                    </strong>{' '}
                    (Saldo mes:{' '}
                    <strong className="font-mono">
                      {formatHoras(validatedMonth.saldoMesHoras, true)}
                    </strong>{' '}
                    · Bolsa al cierre:{' '}
                    <strong className="font-mono">
                      {formatHoras(validatedMonth.bolsaAcumuladaAlCierre, true)}
                    </strong>
                    ). Los cambios posteriores de IRPF, Jornada o Turnos no alteran este mes.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {isMonthComplete
                      ? 'Todo el mes tiene turnos/descansos asignados. Al validar se congelan estos porcentajes junto con la nómina exacta y se recalcula el resto del año.'
                      : `Faltan ${Math.max(0, daysInMonth - filledDaysCount)} días por asignar en ${MONTH_NAMES[selectedMonth - 1]}. Al validar, se guarda la nómina con la jornada e IRPF actuales.`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {validatedMonth ? (
                  <>
                    {onRecalculate && (
                      <button
                        type="button"
                        onClick={onRecalculate}
                        disabled={isRecalculating || isValidatingMonth}
                        title="Recalcular suma de horas del ciclo y actualizar nómina validada"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating || isValidatingMonth ? 'animate-spin' : ''}`} />
                        <span>Recalcular</span>
                      </button>
                    )}
                    {onGoToNomina && (
                      <button
                        type="button"
                        onClick={onGoToNomina}
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        Ver Nómina
                      </button>
                    )}
                    {onUnvalidateMonth && (
                      <button
                        type="button"
                        onClick={() => setShowUnvalidateConfirm(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Reabrir</span>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isValidatingMonth || filledDaysCount === 0}
                    onClick={() => {
                      if (isMonthComplete) {
                        void triggerValidation();
                      } else {
                        setShowIncompleteValidateConfirm(true);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-[11px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${
                      isMonthComplete
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isValidatingMonth ? 'Validando...' : 'Validar Mes y Guardar'}</span>
                  </button>
                )}
              </div>
            </div>

            {annualSummary && annualSummary.validatedMonthsCount > 0 && (
              <div className="pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold">
                <span>
                  Meses validados {selectedYear}: <strong>{annualSummary.validatedMonthsCount}/12</strong> · Saldo arrastrado:{' '}
                  <strong className="font-mono">{formatHoras(annualSummary.saldoArrastradoValidado, true)}</strong>
                </span>
                {annualSummary.unvalidatedMonthsCount > 0 && (
                  <span>
                    Pendiente resto del año ({currentJornadaPctCal}%):{' '}
                    <strong className="font-mono">
                      {formatHoras(annualSummary.horasPendientesAjustadasResto)}
                    </strong>{' '}
                    ({formatHoras(annualSummary.cuotaMensualAjustadaResto)}/mes)
                  </span>
                )}
              </div>
            )}

            {validationFeedback && (
              <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold">
                {validationFeedback}
              </div>
            )}
          </div>
        );
      })()}

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-3xl p-3 sm:p-4 border border-slate-200 shadow-xs">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 text-center font-bold text-[11px] sm:text-xs text-slate-400 pb-2 border-b border-slate-100">
          <span>L</span>
          <span>M</span>
          <span>X</span>
          <span>J</span>
          <span>V</span>
          <span className="text-blue-600">S</span>
          <span className="text-rose-600">D</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-2">
          {/* Empty cells before month start */}
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-14 sm:h-16 rounded-xl bg-slate-50/50"></div>
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`;
            const asg = assignments.find((a) => a.date === dStr);
            const shiftCode = asg?.shiftCode;
            const shiftDef =
              asg?.shiftSnapshot ||
              (shiftCode ? shiftsMap.get(shiftCode) || shifts.find((s) => s.code === shiftCode) : null);
            const isSelected = selectedDayNumber === dayNum;
            const visibleCellExtrasCount = (asg?.extras || []).filter(
              (e) => !e.name.toLowerCase().includes('plus festivo')
            ).length;
            const hasExtras = visibleCellExtrasCount > 0 || Boolean(asg?.lateFinishMinutes && asg.lateFinishMinutes > 0);
            const dayHasManualHolidayPlus = Boolean(
              asg?.isHoliday || asg?.extras?.some((e) => e.name.toLowerCase().includes('plus festivo'))
            );
            const dayHasFT = Boolean(
              asg?.extras?.some((e) => isFTExtraName(e.name))
            );
            const detectedHoliday = officialHolidaysMap.get(dStr);

            const isRest = shiftCode === 'D' || asg?.isRest;
            const isVacation = shiftCode === 'V' || asg?.isVacation;
            const isSick = shiftCode === 'B' || asg?.isSickLeave;

            // Determine badge appearance
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';
            if (isRest) {
              badgeBg = '#dcfce7'; // green
              badgeColor = '#15803d';
            } else if (isVacation) {
              badgeBg = '#cffafe'; // cyan-100
              badgeColor = '#0891b2'; // cyan-600
            } else if (isSick) {
              badgeBg = '#ffe4e6'; // rose-100
              badgeColor = '#be123c'; // rose-700
            } else if (shiftDef) {
              badgeBg = `${shiftDef.color}18`;
              badgeColor = shiftDef.color;
            }

            const holidayCellClass = detectedHoliday
              ? detectedHoliday.scope === 'nacional'
                ? 'bg-rose-50/90 border border-rose-300'
                : detectedHoliday.scope === 'regional'
                ? 'bg-purple-50/90 border border-purple-300'
                : 'bg-orange-50/90 border border-orange-300'
              : '';

            const holidayNumClass = detectedHoliday
              ? detectedHoliday.scope === 'nacional'
                ? 'text-rose-700'
                : detectedHoliday.scope === 'regional'
                ? 'text-purple-700'
                : 'text-orange-700'
              : 'text-slate-700';

            const holidayTagLabel =
              detectedHoliday?.scope === 'nacional'
                ? 'NAC'
                : detectedHoliday?.scope === 'regional'
                ? 'REG'
                : detectedHoliday?.scope === 'local'
                ? 'LOC'
                : null;

            const holidayTagClass =
              detectedHoliday?.scope === 'nacional'
                ? 'bg-rose-600 text-white'
                : detectedHoliday?.scope === 'regional'
                ? 'bg-purple-600 text-white'
                : 'bg-orange-500 text-white';

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDayNumber(dayNum)}
                title={
                  detectedHoliday
                    ? `${
                        detectedHoliday.scope === 'nacional'
                          ? 'Festivo Nacional'
                          : detectedHoliday.scope === 'regional'
                          ? 'Festivo Regional'
                          : 'Festivo Local'
                      }: ${detectedHoliday.name}${dayHasManualHolidayPlus ? ` · Plus Festivo manual activo (+${formatCurrency(plusFestivoRate)})` : ''}`
                    : undefined
                }
                className={`h-14 sm:h-16 p-1 rounded-xl flex flex-col justify-between items-center transition-all relative ${
                  isSelected
                    ? `ring-2 ring-blue-600 shadow-xs z-10 ${detectedHoliday ? holidayCellClass : 'bg-blue-50/40'}`
                    : `${holidayCellClass || 'hover:bg-slate-50'}`
                }`}
              >
                {/* Day number & indicators */}
                <div className="w-full flex items-center justify-between px-1">
                  <div className="flex items-center gap-0.5">
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-700' : holidayNumClass}`}>
                      {dayNum}
                    </span>
                    {holidayTagLabel && (
                      <span className={`text-[7px] font-black px-1 py-0.2 rounded leading-tight ${holidayTagClass}`}>
                        {holidayTagLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {dayHasManualHolidayPlus && (
                      <span className="text-[10px] leading-none" title={`Plus Festivo manual (+${formatCurrency(plusFestivoRate)})`}>
                        🎉
                      </span>
                    )}
                    {dayHasFT && (
                      <span
                        className="text-[7px] font-black px-1 py-0.2 rounded bg-teal-600 text-white leading-tight"
                        title="Día F/T (Fiesta / Trabajo): horas abonadas aparte del salario base"
                      >
                        F/T
                      </span>
                    )}
                    {hasExtras && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Contiene extras"></span>
                    )}
                  </div>
                </div>

                {/* Shift badge */}
                {shiftCode ? (
                  <div
                    className="w-full py-0.5 rounded-md text-center font-bold text-[10px] sm:text-xs truncate px-0.5"
                    style={{ backgroundColor: badgeBg, color: badgeColor }}
                  >
                    {shiftCode}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-300 font-medium pb-1">-</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda de Festivos (Nacional / Regional / Local) y localidad configurada */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-100 border border-rose-400"></span>
              Festivo Nacional
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-purple-100 border border-purple-400"></span>
              Regional
            </span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <span className="w-2.5 h-2.5 rounded-xs bg-orange-100 border border-orange-400"></span>
              Local{profile?.locality?.trim() ? ` (${profile.locality.trim()})` : ''}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
              🎉 Plus Festivo manual (+{formatCurrency(plusFestivoRate)})
            </span>
          </div>

          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg border transition-colors ${
                profile?.locality?.trim()
                  ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  : 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100'
              }`}
              title="Configurar localidad y comunidad autónoma en la ficha del chófer para identificar festivos locales y regionales"
            >
              <MapPin className="w-3 h-3" />
              <span>
                {profile?.locality?.trim()
                  ? profile.locality.trim()
                  : 'Indicar localidad en ficha'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Day Details Panel matching screenshot 3 */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {formattedDayTitle}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <p className="text-xs text-slate-500">
                {currentAssignment.customLine || 'Sin línea/coche indicado'}
              </p>
              {selectedDayOfficialHoliday && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    selectedDayOfficialHoliday.scope === 'nacional'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : selectedDayOfficialHoliday.scope === 'regional'
                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                      : 'bg-orange-50 text-orange-800 border-orange-200'
                  }`}
                >
                  {selectedDayOfficialHoliday.scope === 'nacional'
                    ? 'Festivo Nacional'
                    : selectedDayOfficialHoliday.scope === 'regional'
                    ? `Festivo Regional`
                    : `Festivo Local`}
                  : {selectedDayOfficialHoliday.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {currentAssignment.shiftCode && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isMonthLocked) {
                      setShowUnvalidateConfirm(true);
                      return;
                    }
                    if (currentShift && onEditShift) {
                      onEditShift(currentShift);
                    }
                  }}
                  title={isMonthLocked ? 'Mes validado: reabre el mes para editar manualmente' : 'Ver o editar ficha de este turno'}
                  className="px-2.5 py-1 rounded-lg text-xs font-black transition-transform hover:scale-105"
                  style={{
                    backgroundColor: currentShift ? `${currentShift.color}20` : '#e2e8f0',
                    color: currentShift ? currentShift.color : '#334155',
                  }}
                >
                  {currentAssignment.shiftCode}
                </button>

                {!isMonthLocked && currentShift && onEditShift && (
                  <button
                    type="button"
                    onClick={() => onEditShift(currentShift)}
                    title="Editar ficha del turno en la base de datos"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                {!isMonthLocked && (
                  <button
                    type="button"
                    onClick={() => setShowRemoveShiftConfirm(true)}
                    title="Eliminar este turno del día (dejar libre)"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {!isMonthLocked && (
              <button
                onClick={() => {
                  const line = prompt('Indica la línea o coche para este día:', currentAssignment.customLine || 'Línea 421 · Coche 304');
                  if (line !== null) {
                    onUpdateAssignment(selectedDateStr, { customLine: line });
                  }
                }}
                title="Modificar línea o coche"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-xs"
              >
                <span className="text-[11px] font-medium text-slate-500">Coche</span>
              </button>
            )}
          </div>
        </div>

        {isMonthLocked && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-950">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <p className="text-[11px] leading-snug">
                <strong>Mes validado y congelado:</strong> los turnos, duraciones, pluses e importes de este día quedan fijados. Cualquier cambio deberá ser manual reabriendo el mes.
              </p>
            </div>
            {onUnvalidateMonth && (
              <button
                type="button"
                onClick={() => setShowUnvalidateConfirm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
              >
                <Unlock className="w-3 h-3" />
                <span>Reabrir</span>
              </button>
            )}
          </div>
        )}

        {/* Shift Details Box */}
        {currentShift ? (
          currentShift.code === 'B' || currentAssignment.isSickLeave ? (
            <div className="bg-rose-50/90 rounded-2xl p-3.5 border border-rose-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-950">
                <span className="flex items-center gap-1.5 font-bold">
                  <CalendarIcon className="w-4 h-4 text-rose-600" />
                  Baja Médica / Incapacidad Temporal (IT)
                </span>
                <span className="text-xs font-bold font-mono text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                  Turno B
                </span>
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed">
                Día registrado como <strong>baja médica (IT)</strong>. Si la misma baja continúa entre un mes y el siguiente en <strong>Turnos Día</strong>, el Calendario Anual enlaza automáticamente los días consecutivos sin reiniciar los tramos iniciales sin cobro.
              </p>
            </div>
          ) : currentShift.code === 'V' ? (
            <div className="bg-cyan-50/90 rounded-2xl p-3.5 border border-cyan-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-cyan-950">
                <span className="flex items-center gap-1.5 font-bold">
                  <CalendarIcon className="w-4 h-4 text-cyan-600" />
                  Vacaciones Anuales Retribuidas
                </span>
                <span className="text-sm font-bold font-mono text-cyan-800">
                  {formatCurrency(
                    roundCurrency(activeYearRate.salarioBaseDia * partTimeFactorCal) +
                    (appliesVacationPlus ? effectiveVacationPlusDia : 0)
                  )}
                </span>
              </div>
              {appliesVacationPlus ? (
                <p className="text-[11px] text-cyan-800 leading-relaxed">
                  Jornada {isJornada100 ? 'completa (100%)' : `parcial al ${Math.round(partTimeFactorCal * 100)}%`}: Salario Base diario ({formatCurrency(roundCurrency(activeYearRate.salarioBaseDia * partTimeFactorCal))}) + <strong>Plus de Vacaciones de {formatCurrency(effectiveVacationPlusDia)}/día</strong>{!isJornada100 ? ` (${Math.round(partTimeFactorCal * 100)}% de ${formatCurrency(activeYearRate.plusVacacionesDia ?? 10.00)})` : ''} según el Art. 9 del Convenio Colectivo de Zaragoza.
                </p>
              ) : (
                <p className="text-[11px] text-cyan-900 leading-relaxed">
                  Jornada de vacaciones retribuida con Salario Base diario ({formatCurrency(roundCurrency(activeYearRate.salarioBaseDia * partTimeFactorCal))}). El <strong>Plus de Vacaciones</strong> se encuentra desactivado en tu Perfil de trabajador.
                </p>
              )}
              <div className="flex items-center justify-between text-[11px] text-cyan-700 pt-1 border-t border-cyan-200/60">
                <span className="flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
                  {appliesVacationPlus
                    ? `Plus de ${formatCurrency(effectiveVacationPlusDia)}/día activo (${isJornada100 ? '100%' : `proporcional al ${Math.round(partTimeFactorCal * 100)}%`})`
                    : 'Retribución Salario Base diaria'}
                </span>
                <span className="text-[10px] font-bold text-cyan-700 uppercase bg-cyan-100 px-2 py-0.5 rounded-md">Art. 9 Convenio</span>
              </div>
            </div>
          ) : (
            (() => {
              const activeRate = activeYearRate;
              const isHoliday = hasManualPlusFestivo;
              const shiftRateCalc = computeShiftRateFromConvenio(currentShift, activeRate, { isHoliday });

              return (
                <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {currentShift.modality === 'partido' && currentShift.secondStartTime
                        ? `Horario Partido (${currentShift.startTime}-${currentShift.endTime} / ${currentShift.secondStartTime}-${currentShift.secondEndTime})`
                        : `Horario Continuo (${currentShift.startTime} - ${currentShift.endTime})`}
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-800">
                      {formatCurrency(shiftRateCalc.totalRate)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {shiftRateCalc.totalHours}h ({formatCurrency(shiftRateCalc.hourlyRate)}/h)
                      </span>
                      {shiftRateCalc.hasReten && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          <ShieldCheck className="w-3 h-3 text-amber-600" />
                          Plus Retén (+{formatCurrency(shiftRateCalc.retenAmount ?? plusRetenRate)}) · Sin Quebranto / Sin Plus Conductor
                        </span>
                      )}
                      {shiftRateCalc.isReducedConductorPlus && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold text-[10px]">
                          1/2 Plus Conductor (&lt;4h · {formatCurrency(shiftRateCalc.conductorPlusAmount ?? 3.14)} en vez de {formatCurrency(activeRate.plusConductorPerceptorDia ?? 6.27)})
                        </span>
                      )}
                      {shiftRateCalc.hasNight && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                          <Moon className="w-3 h-3 text-purple-600" />
                          {shiftRateCalc.nightHours}h nocturnas (+{formatCurrency(shiftRateCalc.nightAmount)})
                        </span>
                      )}
                      {shiftRateCalc.holidayAmount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                          Plus festivo (+{formatCurrency(shiftRateCalc.holidayAmount)})
                        </span>
                      )}
                      {hasManualFT && !isHoliday && (
                        <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 font-bold text-[10px]">
                          F/T · {selectedDayShiftTotalHours.toLocaleString('es-ES')} h aparte de Salario Base
                        </span>
                      )}
                      {!isHoliday && !hasManualFT && selectedDayShiftTotalHours > 9 && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold text-[10px]">
                          +{parseFloat((selectedDayShiftTotalHours - 9).toFixed(2)).toLocaleString('es-ES')} h (&gt;9h) a Complementarias
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200/70 px-1.5 py-0.5 rounded">
                      Convenio {selectedYear}
                    </span>
                  </div>

                  {!isMonthLocked && currentAssignment.shiftSnapshot && (() => {
                    const liveCatalogMatch = shiftsMap.get(currentAssignment.shiftSnapshot.code);
                    const hasCatalogChanged =
                      !liveCatalogMatch ||
                      liveCatalogMatch.startTime !== currentAssignment.shiftSnapshot.startTime ||
                      liveCatalogMatch.endTime !== currentAssignment.shiftSnapshot.endTime ||
                      liveCatalogMatch.fixedRate !== currentAssignment.shiftSnapshot.fixedRate ||
                      Boolean(liveCatalogMatch.hasPlusReten) !== Boolean(currentAssignment.shiftSnapshot.hasPlusReten);
                    if (!hasCatalogChanged) return null;
                    return (
                      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                        <span className="text-amber-800 font-semibold">
                          Turno histórico conservado (no se modificó automáticamente tras cambiar la BD).
                        </span>
                        {liveCatalogMatch && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAssignment(selectedDateStr, {
                                shiftCode: liveCatalogMatch.code,
                                shiftId: liveCatalogMatch.id,
                                shiftSnapshot: undefined,
                              })
                            }
                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-bold transition-colors cursor-pointer"
                          >
                            Aplicar turno actual ({liveCatalogMatch.startTime}-{liveCatalogMatch.endTime})
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()
          )
        ) : (
          <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-dashed border-slate-200">
            Ningún turno asignado para este día. Elige uno abajo en el teclado rápido.
          </div>
        )}

        {/* PARTICULARIDADES / EXTRAS DEL DÍA matching screenshot 3 & User Request */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Particularidades / Extras del Día
              </span>
              {!isMonthLocked && (
                <button
                  type="button"
                  onClick={() => {
                    setModalExtraTab('concepto');
                    setIsAddingExtraModal(true);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline px-1 py-0.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              )}
            </div>
            <div className={`flex flex-wrap items-center gap-1.5 ${isMonthLocked ? 'opacity-65 pointer-events-none select-none' : ''}`}>
              {/* Botón único y manual para aplicar o quitar Plus Festivo (40,80 €), sin duplicar en extras */}
              <button
                type="button"
                onClick={() => {
                  const nextActive = !hasManualPlusFestivo;
                  const cleanedExtras = (currentAssignment.extras || []).filter(
                    (e) => !e.name.toLowerCase().includes('plus festivo')
                  );
                  onUpdateAssignment(selectedDateStr, {
                    isHoliday: nextActive,
                    extras: cleanedExtras,
                  });
                }}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                  hasManualPlusFestivo
                    ? 'bg-amber-100 border-amber-400 text-amber-900 ring-1 ring-amber-300 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800'
                }`}
                title={`Aplicar o quitar manualmente el Plus Festivo (+${formatCurrency(plusFestivoRate)}) cuando trabajes en festivo`}
              >
                <span>🎉</span>
                <span>
                  {hasManualPlusFestivo
                    ? `Plus Festivo (+${formatCurrency(plusFestivoRate)})`
                    : `Plus Festivo (+${formatCurrency(plusFestivoRate)})`}
                </span>
                {hasManualPlusFestivo && (
                  <Check className="w-3 h-3 text-amber-800 stroke-[3]" />
                )}
              </button>

              {/* Botón manual para marcar el día como F/T (Fiesta / Trabajo) */}
              <button
                type="button"
                onClick={() => {
                  const currentExtras = currentAssignment.extras || [];
                  if (hasManualFT) {
                    const filtered = currentExtras.filter((e) => !isFTExtraName(e.name));
                    onUpdateAssignment(selectedDateStr, { extras: filtered });
                  } else {
                    const h = selectedDayShiftTotalHours > 0 ? selectedDayShiftTotalHours : undefined;
                    const amt = h ? parseFloat((h * horaOrdinariaRate).toFixed(2)) : horaOrdinariaRate;
                    onUpdateAssignment(selectedDateStr, {
                      extras: [
                        ...currentExtras,
                        {
                          id: `dayextra-ft-${Date.now()}`,
                          conceptId: 'extra-ft',
                          name: 'F/T (Fiesta / Trabajo)',
                          amount: amt,
                          ...(h ? { quantity: h } : {}),
                          notes: 'Trabajo en día F/T: horas aparte del salario base',
                        },
                      ],
                    });
                  }
                }}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                  hasManualFT
                    ? 'bg-teal-100 border-teal-400 text-teal-900 ring-1 ring-teal-300 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-800'
                }`}
                title={`Marcar o quitar extra F/T (Fiesta / Trabajo). Las horas trabajadas ese día van aparte del salario base a ${formatCurrency(horaOrdinariaRate)}/h`}
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  {hasManualFT && selectedDayShiftTotalHours > 0
                    ? `F/T (${selectedDayShiftTotalHours.toLocaleString('es-ES')} h)`
                    : 'F/T (Fiesta / Trabajo)'}
                </span>
                {hasManualFT && (
                  <Check className="w-3 h-3 text-teal-800 stroke-[3]" />
                )}
              </button>

              {/* Botón manual para añadir o quitar Plus de Retén */}
              <button
                type="button"
                onClick={() => {
                  const currentExtras = currentAssignment.extras || [];
                  const hasRetenExtra = currentExtras.some(
                    (e) => e.name.toLowerCase().includes('reten') || e.name.toLowerCase().includes('retén')
                  );
                  if (hasRetenExtra) {
                    const filtered = currentExtras.filter(
                      (e) => !e.name.toLowerCase().includes('reten') && !e.name.toLowerCase().includes('retén')
                    );
                    onUpdateAssignment(selectedDateStr, { extras: filtered });
                  } else if (!dayPlusStatus.hasRetenShift) {
                    // Quitar quebranto y plus conductor al añadir retén
                    const filtered = currentExtras.filter((e) => {
                      const l = e.name.toLowerCase();
                      return !l.includes('quebranto') && !l.includes('plus conductor') && !l.includes('medio plus');
                    });
                    filtered.push({
                      id: `dayextra-reten-${Date.now()}`,
                      name: 'Plus retén',
                      amount: plusRetenRate,
                    });
                    onUpdateAssignment(selectedDateStr, { extras: filtered });
                  }
                }}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                  dayPlusStatus.isRetenOnDay
                    ? 'bg-amber-100 border-amber-400 text-amber-900 ring-1 ring-amber-300 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800'
                }`}
                title={`Añadir Plus de Retén (${formatCurrency(plusRetenRate)}). Quita automáticamente quebranto de moneda y plus conductor`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  {dayPlusStatus.isRetenOnDay
                    ? `Retén (+${formatCurrency(plusRetenRate)})`
                    : `Plus Retén (+${formatCurrency(plusRetenRate)})`}
                </span>
                {dayPlusStatus.isRetenOnDay && (
                  <Check className="w-3 h-3 text-amber-800 stroke-[3]" />
                )}
              </button>

              {/* Botón opcional diario para Plus de Puntualidad e Inicio Temprano (solo visible si se habilitó en ficha) */}
              {isPuntualidadEnabledInProfile && (() => {
                const hasPunctualityOnDay = (currentAssignment.extras || []).some((e) => {
                  const l = e.name.toLowerCase();
                  return l.includes('puntualidad') || l.includes('inicio temprano');
                });
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const currentExtras = currentAssignment.extras || [];
                      if (hasPunctualityOnDay) {
                        const filtered = currentExtras.filter((e) => {
                          const l = e.name.toLowerCase();
                          return !l.includes('puntualidad') && !l.includes('inicio temprano');
                        });
                        onUpdateAssignment(selectedDateStr, { extras: filtered });
                      } else {
                        onUpdateAssignment(selectedDateStr, {
                          extras: [
                            ...currentExtras,
                            {
                              id: `dayextra-puntualidad-${Date.now()}`,
                              name: 'Plus puntualidad e inicio temprano',
                              amount: plusPuntualidadRate,
                            },
                          ],
                        });
                      }
                    }}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                      hasPunctualityOnDay
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-900 ring-1 ring-emerald-300 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800'
                    }`}
                    title={`Aplicar o quitar Plus de Puntualidad e Inicio Temprano (+${formatCurrency(plusPuntualidadRate)}) en este día`}
                  >
                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Plus Puntualidad (+{formatCurrency(plusPuntualidadRate)})</span>
                    {hasPunctualityOnDay && (
                      <Check className="w-3 h-3 text-emerald-800 stroke-[3]" />
                    )}
                  </button>
                );
              })()}

              {/* Reflejo de Quebranto de Moneda cuando el turno lo lleva aparejado */}
              {dayPlusStatus.hasQuebranto && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 bg-emerald-100 border-emerald-400 text-emerald-900 ring-1 ring-emerald-300 shadow-2xs"
                  title={`Quebranto de moneda incluido con este turno (+${formatCurrency(quebrantoRate)} bruto/día según Convenio)`}
                >
                  <Coins className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Quebranto (+{formatCurrency(quebrantoRate)})</span>
                  <Check className="w-3 h-3 text-emerald-800 stroke-[3]" />
                </span>
              )}

              {/* Reflejo de Plus Conductor (entero o 1/2 en turnos < 4h) cuando el turno lo lleva aparejado */}
              {(dayPlusStatus.hasFullConductorPlus || dayPlusStatus.hasHalfConductorPlus) && (
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ring-1 shadow-2xs ${
                    dayPlusStatus.hasHalfConductorPlus
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-900 ring-indigo-300'
                      : 'bg-blue-100 border-blue-400 text-blue-900 ring-blue-300'
                  }`}
                  title={
                    dayPlusStatus.hasHalfConductorPlus
                      ? `1/2 Plus Conductor-Perceptor (< 4h) incluido con este turno (+${formatCurrency(medioPlusConductorRate)} bruto/día según Convenio)`
                      : `Plus Conductor-Perceptor completo incluido con este turno (+${formatCurrency(plusConductorRate)} bruto/día según Convenio)`
                  }
                >
                  <Award
                    className={`w-3.5 h-3.5 ${
                      dayPlusStatus.hasHalfConductorPlus ? 'text-indigo-700' : 'text-blue-700'
                    }`}
                  />
                  <span>
                    {dayPlusStatus.hasHalfConductorPlus
                      ? `1/2 Plus Conductor (+${formatCurrency(medioPlusConductorRate)})`
                      : `Plus Conductor (+${formatCurrency(plusConductorRate)})`}
                  </span>
                  <Check
                    className={`w-3 h-3 stroke-[3] ${
                      dayPlusStatus.hasHalfConductorPlus ? 'text-indigo-800' : 'text-blue-800'
                    }`}
                  />
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsLateSectionOpen(!isLateSectionOpen)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                  isLateSectionOpen || (currentAssignment.lateFinishMinutes || 0) > 0
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-200'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="Desplegar opciones para indicar si se ha terminado más tarde de lo que marca el turno"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Terminado más tarde</span>
                {(currentAssignment.lateFinishMinutes || 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                )}
                {isLateSectionOpen ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* APARTADO DESPLEGABLE: Terminado más tarde de lo que marca el turno */}
          {isLateSectionOpen && !isMonthLocked ? (
            <div className="bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-indigo-50/80 rounded-2xl p-3.5 border border-indigo-200/90 shadow-2xs space-y-3 transition-all animate-in fade-in duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      Terminado más tarde de lo que marca el turno
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Indica el exceso horario (horas y minutos libres sin pasos mínimos).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLateSectionOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                  title="Plegar apartado"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>

              {/* Dual Time inputs: Horas y Minutos libres sin pasos mínimos */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Horas (h)
                    </label>
                    <span className="text-[10px] text-slate-400">Paso libre</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="1"
                      value={lateHoursInput === 0 ? '' : lateHoursInput}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        setLateHoursInput(val);
                        handleSaveLateFinish(val, lateMinsInput, lateReasonInput);
                      }}
                      placeholder="0"
                      className="w-full py-2 px-3 pr-8 text-center text-lg font-black font-mono rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">h</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      Minutos (min)
                    </label>
                    <span className="text-[10px] text-indigo-600 font-medium">Sin mínimo</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={lateMinsInput === 0 ? '' : lateMinsInput}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        setLateMinsInput(val);
                        handleSaveLateFinish(lateHoursInput, val, lateReasonInput);
                      }}
                      placeholder="0"
                      className="w-full py-2 px-3 pr-10 text-center text-lg font-black font-mono rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">min</span>
                  </div>
                </div>
              </div>

              {/* Botones de sugerencia / atajos rápidos */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-500 block">Atajos rápidos (puedes pulsar o teclear cualquier minuto arriba):</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '+5 min', addH: 0, addM: 5 },
                    { label: '+10 min', addH: 0, addM: 10 },
                    { label: '+15 min', addH: 0, addM: 15 },
                    { label: '+30 min', addH: 0, addM: 30 },
                    { label: '40 min', setH: 0, setM: 40 },
                    { label: '1h y 5m', setH: 1, setM: 5 },
                    { label: '+1 hora', addH: 1, addM: 0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        let newH = lateHoursInput;
                        let newM = lateMinsInput;
                        if (preset.setH !== undefined) {
                          newH = preset.setH;
                          newM = preset.setM || 0;
                        } else {
                          const total = newH * 60 + newM + (preset.addH || 0) * 60 + (preset.addM || 0);
                          newH = Math.floor(total / 60);
                          newM = total % 60;
                        }
                        setLateHoursInput(newH);
                        setLateMinsInput(newM);
                        handleSaveLateFinish(newH, newM, lateReasonInput);
                      }}
                      className="text-[10px] font-bold px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200/90 transition-colors shadow-2xs"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {(lateHoursInput > 0 || lateMinsInput > 0) && (
                    <button
                      type="button"
                      onClick={handleClearLateFinish}
                      className="text-[10px] font-semibold px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors ml-auto flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Limpiar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Motivo opcional */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Motivo / Incidencia del retraso (opcional)
                </label>
                <input
                  type="text"
                  value={lateReasonInput}
                  onChange={(e) => {
                    setLateReasonInput(e.target.value);
                    handleSaveLateFinish(lateHoursInput, lateMinsInput, e.target.value);
                  }}
                  placeholder="ej. Retraso por atasco en entrada, espera relevo, avería..."
                  className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Live Preview Box */}
              {lateHoursInput > 0 || lateMinsInput > 0 ? (
                <div className="flex items-center justify-between p-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-200 shrink-0" />
                    <div>
                      <p className="font-bold">
                        +{formatMinutesToHoursAndMinutes(lateHoursInput * 60 + lateMinsInput)} de exceso
                      </p>
                      <p className="text-[10px] text-indigo-200">
                        {lateHoursInput * 60 + lateMinsInput} min totales a {formatCurrency(horaOrdinariaRate)}/h
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black font-mono">
                    +{formatCurrency(parseFloat((((lateHoursInput * 60 + lateMinsInput) / 60) * horaOrdinariaRate).toFixed(2)))}
                  </span>
                </div>
              ) : (
                <div className="p-2 bg-white/70 rounded-xl text-center text-[11px] text-slate-500 italic border border-indigo-100">
                  Introduce arriba horas o minutos para computar el exceso en la nómina.
                </div>
              )}
            </div>
          ) : (currentAssignment.lateFinishMinutes || 0) > 0 ? (
            /* Card cuando está plegado pero hay minutos guardados */
            <div className="flex items-center justify-between p-2.5 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-indigo-600 text-white rounded-lg">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="font-bold text-indigo-950">
                    Terminado más tarde: +{formatMinutesToHoursAndMinutes(currentAssignment.lateFinishMinutes || 0)}
                  </p>
                  {currentAssignment.lateFinishReason ? (
                    <p className="text-[10px] text-indigo-700">{currentAssignment.lateFinishReason}</p>
                  ) : (
                    <p className="text-[10px] text-indigo-600">Exceso compensado según Art. 16/12 Convenio</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold font-mono text-indigo-900">
                  +{formatCurrency(((currentAssignment.lateFinishMinutes || 0) / 60) * horaOrdinariaRate)}
                </span>
                {!isMonthLocked && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsLateSectionOpen(true)}
                      className="px-2 py-0.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-md transition-colors text-[10px] font-bold"
                      title="Modificar exceso de tiempo"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={handleClearLateFinish}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Eliminar exceso de jornada"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Lista de otros extras asignados (sin duplicar el Plus Festivo manual) */}
          {visibleDayExtras.length > 0 ? (
            <div className="space-y-2">
              {visibleDayExtras.map((extra) => {
                const isFT = isFTExtraName(extra.name);
                const convAmt = getOfficialConvenioExtraAmount(extra.name, activeYearRate);
                const qty = isFT
                  ? (selectedDayShiftTotalHours > 0
                      ? selectedDayShiftTotalHours
                      : (extra.quantity && extra.quantity > 0 ? extra.quantity : 1))
                  : (extra.quantity && extra.quantity > 0 ? extra.quantity : 1);
                const isHourlyOfficial =
                  isFT ||
                  extra.name.toLowerCase().includes('festiva') ||
                  extra.name.toLowerCase().includes('complementaria');
                const displayedAmount =
                  isFT && selectedDayShiftTotalHours > 0
                    ? parseFloat((selectedDayShiftTotalHours * horaOrdinariaRate).toFixed(2))
                    : convAmt !== null
                    ? (isHourlyOfficial && extra.quantity === undefined ? extra.amount : parseFloat((qty * convAmt).toFixed(2)))
                    : extra.amount;
                return (
                <div
                  key={extra.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                    isFT
                      ? 'bg-teal-50/70 border-teal-200/80'
                      : 'bg-amber-50/50 border-amber-200/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isFT ? 'bg-teal-600' : 'bg-amber-500'}`}></span>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {extra.name}
                        {isFT && qty > 0 && ` (${qty.toLocaleString('es-ES')} h)`}
                      </p>
                      {extra.notes && <p className="text-[10px] text-slate-500">{extra.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold font-mono ${isFT ? 'text-teal-800' : 'text-emerald-700'}`}>
                      +{formatCurrency(displayedAmount)}
                    </span>
                    {!isMonthLocked && (
                      <button
                        type="button"
                        onClick={() => setExtraToRemove({ id: extra.id, name: extra.name })}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Eliminar extra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            !isLateSectionOpen && !(currentAssignment.lateFinishMinutes && currentAssignment.lateFinishMinutes > 0) && (
              <p className="text-xs text-slate-400 italic">Sin extras adicionales asignados para este día.</p>
            )
          )}

          {/* Subtotal devengado del día matching screenshot 3 */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 block">Subtotal devengado del día</span>
              <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Suma a nómina estimada
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 tabular-nums">
              {formatCurrency(selectedDayTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* TECLADO DE ASIGNACIÓN RÁPIDA matching screenshot 3 */}
      <div className={`space-y-2 pt-1 ${isMonthLocked ? 'opacity-55 pointer-events-none select-none' : ''}`}>
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-slate-700 uppercase tracking-wide">
            Teclado de Asignación Rápida
          </span>
          <span className="text-blue-600 font-medium">
            {isMonthLocked ? 'Mes validado (reabrir para editar)' : `Pulsa para asignar al día ${selectedDayNumber}`}
          </span>
        </div>

        {/* Quick buttons strip (div:nth-of-type(2)) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {quickShiftItems.map((item) => {
            const isSelectedShift = currentAssignment.shiftCode === item.code;

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleAssignShift(item.code)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelectedShift
                    ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span
                    className="font-bold text-xs px-1.5 py-0.5 rounded truncate max-w-[82px]"
                    style={{ backgroundColor: `${item.color}20`, color: item.color }}
                  >
                    {item.code}
                  </span>
                  {item.subtitle && (
                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1 py-0.5 rounded truncate">
                      {item.subtitle}
                    </span>
                  )}
                </div>
                <div className="mt-1.5">
                  <span className="text-[11px] font-semibold text-slate-700 block truncate">
                    {item.label}
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.rate > 0 ? formatCurrency(item.rate) : item.code === 'B' ? 'Baja IT' : 'Libre (0€)'}
                    </span>
                    {item.isUsedRecently && (
                      <span className="text-[9px] font-bold text-blue-600">Habitual</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Buscador visual e intuitivo de turnos (div:nth-of-type(3)) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Barra de búsqueda + filtros rápidos */}
          <div className="p-3 bg-slate-50/70 border-b border-slate-100 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Buscar por código, hora o tipo (ej. L08, 06:30, retén, S05)..."
                className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {pickerSearch && (
                <button
                  type="button"
                  onClick={() => setPickerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fila 1: Filtro por Día / Jornada (auto-detectado según el día elegido) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'laborable', label: 'L-V', count: pickerDayCounts.laborable },
                  { id: 'sabado', label: 'Sáb', count: pickerDayCounts.sabado },
                  { id: 'festivo', label: 'Dom/Fest', count: pickerDayCounts.festivo },
                  { id: 'todos', label: 'Todos', count: pickerDayCounts.todos },
                ] as const
              ).map((tab) => {
                const isActive = pickerDayFilter === tab.id;
                const isSuggested = selectedDayTypeSuggested === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPickerDayFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                    {isSuggested && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Acorde al día seleccionado" />
                    )}
                  </button>
                );
              })}

              {pickerUsedFallbackAllDays && (
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 ml-auto">
                  Mostrando en todos los días
                </span>
              )}
            </div>

            {/* Fila 2: Filtro por Franja / Particularidad */}
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'todos', label: 'Todas las franjas' },
                  { id: 'mañana', label: 'Mañana', dot: 'bg-amber-400' },
                  { id: 'tarde', label: 'Tarde', dot: 'bg-sky-500' },
                  { id: 'noche', label: 'Noche', dot: 'bg-purple-600' },
                  { id: 'reten', label: 'Retén', dot: 'bg-amber-600' },
                  { id: 'reducido', label: '<4h (1/2 Plus)', dot: 'bg-indigo-500' },
                ] as const
              ).map((chip) => {
                const isActive = pickerTimeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setPickerTimeFilter(chip.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {'dot' in chip && chip.dot && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : chip.dot}`} />
                    )}
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista clara y escaneable de turnos */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {pickerFilteredShifts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <p className="font-semibold text-slate-700">No hay turnos que coincidan con esa búsqueda</p>
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('');
                    setPickerDayFilter('todos');
                    setPickerTimeFilter('todos');
                  }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Ver todos los turnos ({pickerDayCounts.todos})
                </button>
              </div>
            ) : (
              pickerFilteredShifts.map((s) => {
                const rateCalc = computeShiftRateFromConvenio(s, activeYearRate);
                const isAssigned = currentAssignment.shiftCode === s.code;
                const dayShort =
                  s.dayType === 'sabado'
                    ? 'Sáb'
                    : s.dayType === 'festivo'
                    ? 'Dom/Fest'
                    : s.dayType === 'todos'
                    ? 'L-D'
                    : 'L-V';
                const slotLabel =
                  s.category === 'mañana'
                    ? 'Mañana'
                    : s.category === 'tarde'
                    ? 'Tarde'
                    : s.category === 'noche'
                    ? 'Noche'
                    : 'Servicio';

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleAssignShift(s.code)}
                    className={`w-full px-3 py-2.5 text-left transition-colors flex items-center justify-between gap-2.5 ${
                      isAssigned
                        ? 'bg-blue-50/90 hover:bg-blue-50'
                        : 'bg-white hover:bg-slate-50/90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="font-extrabold text-xs px-2 py-1 rounded-lg shrink-0 min-w-[64px] text-center"
                        style={{
                          backgroundColor: `${s.color}18`,
                          color: s.color,
                          border: `1px solid ${s.color}35`,
                        }}
                      >
                        {s.code}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 font-mono">
                            {s.startTime} – {s.endTime}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            · {s.drivingDuration || `${rateCalc.totalHours}h`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {dayShort} · {slotLabel}
                          </span>
                          {rateCalc.hasReten && (
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                              Retén +{formatCurrency(rateCalc.retenAmount ?? plusRetenRate)}
                            </span>
                          )}
                          {rateCalc.isReducedConductorPlus && (
                            <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded">
                              1/2 Plus (&lt;4h)
                            </span>
                          )}
                          {rateCalc.nightHours > 0 && (
                            <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded">
                              {rateCalc.nightHours}h noct.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-xs font-extrabold font-mono text-emerald-700 tabular-nums">
                        {formatCurrency(rateCalc.totalRate)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                          isAssigned
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isAssigned ? 'Asignado ✓' : 'Elegir'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Pie informativo con conteo y reinicio rápido */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              Mostrando <strong>{pickerFilteredShifts.length}</strong> de {pickerDayCounts.todos} turnos
            </span>
            {(pickerSearch || pickerTimeFilter !== 'todos' || pickerDayFilter !== selectedDayTypeSuggested) && (
              <button
                type="button"
                onClick={() => {
                  setPickerSearch('');
                  setPickerTimeFilter('todos');
                  setPickerDayFilter(selectedDayTypeSuggested);
                }}
                className="text-blue-600 font-bold hover:underline"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal to add extra concept or late finish to day */}
      {isAddingExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Particularidades · Día {selectedDayNumber}</h3>
              <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {MONTH_NAMES[selectedMonth - 1]}
              </span>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalExtraTab('concepto')}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  modalExtraTab === 'concepto'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Concepto Extra (€)
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalExtraTab('tiempo');
                  setModalLateHours(lateHoursInput || 0);
                  setModalLateMins(lateMinsInput || (currentAssignment.lateFinishMinutes ? currentAssignment.lateFinishMinutes % 60 : 40));
                  setModalLateReason(lateReasonInput || currentAssignment.lateFinishReason || '');
                }}
                className={`py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                  modalExtraTab === 'tiempo'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-indigo-600'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Terminado Tarde</span>
              </button>
            </div>

            {modalExtraTab === 'concepto' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Elegir concepto preconfigurado
                  </label>
                  <select
                    value={selectedExtraConceptId}
                    onChange={(e) => {
                      if (e.target.value === '__late_finish__') {
                        setModalExtraTab('tiempo');
                        setModalLateHours(lateHoursInput || 0);
                        setModalLateMins(lateMinsInput || 40);
                        return;
                      }
                      setSelectedExtraConceptId(e.target.value);
                      const found = extrasList.find((x) => x.id === e.target.value);
                      if (found) {
                        setCustomExtraName(found.name);
                        const convAmt = getOfficialConvenioExtraAmount(found.name, activeYearRate);
                        const unitAmt = convAmt ?? found.amount;
                        if (found.unit === 'hora' || isFTExtraName(found.name)) {
                          const defaultHours =
                            isFTExtraName(found.name) && selectedDayShiftTotalHours > 0
                              ? selectedDayShiftTotalHours
                              : 1;
                          setCustomExtraQuantity(defaultHours);
                          setCustomExtraAmount(parseFloat((defaultHours * unitAmt).toFixed(2)));
                        } else {
                          setCustomExtraQuantity(undefined);
                          setCustomExtraAmount(unitAmt);
                        }
                      } else {
                        setCustomExtraQuantity(undefined);
                      }
                    }}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">-- Seleccionar o escribir manual --</option>
                    <option value="__late_finish__">⏱️ Terminado más tarde del turno (Horas y minutos)</option>
                    {extrasList.map((e) => {
                      const convAmt = getOfficialConvenioExtraAmount(e.name, activeYearRate);
                      return (
                      <option key={e.id} value={e.id}>
                        {e.name} (+{formatCurrency(convAmt ?? e.amount)}{e.unit === 'hora' ? '/h' : ''})
                      </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Descripción del Concepto
                  </label>
                  <input
                    type="text"
                    value={customExtraName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomExtraName(val);
                      const convAmt = getOfficialConvenioExtraAmount(val, activeYearRate);
                      if (convAmt !== null) {
                        const qty = customExtraQuantity && customExtraQuantity > 0 ? customExtraQuantity : 1;
                        setCustomExtraAmount(parseFloat((qty * convAmt).toFixed(2)));
                      }
                    }}
                    placeholder="ej. Plus retén o Limpieza interior autocar"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>

                {(isFTExtraName(customExtraName) ||
                  customExtraName.toLowerCase().includes('festiva') ||
                  customExtraName.toLowerCase().includes('complementaria')) && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Horas a computar ({formatCurrency(horaOrdinariaRate)}/h)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={customExtraQuantity ?? 1}
                      onChange={(e) => {
                        const h = parseFloat(e.target.value) || 0;
                        setCustomExtraQuantity(h);
                        setCustomExtraAmount(parseFloat((h * horaOrdinariaRate).toFixed(2)));
                      }}
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                    {isFTExtraName(customExtraName) && (
                      <p className="text-[10.5px] text-teal-700 mt-1 font-semibold">
                        Al indicar F/T en un día con turno asignado, sus horas van aparte del salario base automáticamente a {formatCurrency(horaOrdinariaRate)}/h.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Importe Bruto Adicional (€)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={customExtraAmount}
                    onChange={(e) => setCustomExtraAmount(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                  {(customExtraName.toLowerCase().includes('reten') || customExtraName.toLowerCase().includes('retén')) && (
                    <p className="text-[10.5px] text-amber-700 mt-1 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Cuantía estipulada de Plus de Retén según convenio: <strong>{formatCurrency(plusRetenRate)}/día</strong>. Al añadirlo se quitan el Quebranto de moneda y el Plus conductor.</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleAddExtraToDay}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors"
                  >
                    Añadir al Día
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingExtraModal(false)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              /* Modal Tab: Terminado más tarde de horario (horas y minutos libres) */
              <div className="space-y-3">
                <div className="p-2.5 bg-indigo-50/80 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                  <strong>Tiempo trabajado tras fin de turno:</strong> Puedes indicar horas y minutos libremente (ej. 40 min, 1h y 5 min). Se retribuye a {formatCurrency(horaOrdinariaRate)}/h.
                </div>

                {/* Dual Horas & Minutos inputs */}
                <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Horas (h)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="1"
                        value={modalLateHours === 0 ? '' : modalLateHours}
                        onChange={(e) => setModalLateHours(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full py-2 px-2.5 pr-7 text-center text-lg font-black font-mono rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">h</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Minutos (min)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={modalLateMins === 0 ? '' : modalLateMins}
                        onChange={(e) => setModalLateMins(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full py-2 px-2.5 pr-8 text-center text-lg font-black font-mono rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">min</span>
                    </div>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '+5m', addM: 5 },
                    { label: '+10m', addM: 10 },
                    { label: '+15m', addM: 15 },
                    { label: '+30m', addM: 30 },
                    { label: '40 min', setH: 0, setM: 40 },
                    { label: '1h y 5m', setH: 1, setM: 5 },
                    { label: '+1h', addH: 1 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        let h = modalLateHours;
                        let m = modalLateMins;
                        if (preset.setH !== undefined) {
                          h = preset.setH;
                          m = preset.setM || 0;
                        } else {
                          const total = h * 60 + m + (preset.addH || 0) * 60 + (preset.addM || 0);
                          h = Math.floor(total / 60);
                          m = total % 60;
                        }
                        setModalLateHours(h);
                        setModalLateMins(m);
                      }}
                      className="text-[10px] font-bold px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Motivo */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Motivo / Observación
                  </label>
                  <input
                    type="text"
                    value={modalLateReason}
                    onChange={(e) => setModalLateReason(e.target.value)}
                    placeholder="ej. Retraso tráfico en A-2, avería coche, relevo tarde..."
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>

                {/* Computation preview */}
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl text-xs flex items-center justify-between font-semibold">
                  <div>
                    <p className="font-bold">
                      {formatMinutesToHoursAndMinutes(modalLateHours * 60 + modalLateMins)} de exceso
                    </p>
                    <p className="text-[10px] text-indigo-200">
                      ({modalLateHours * 60 + modalLateMins} minutos totales)
                    </p>
                  </div>
                  <span className="text-sm font-black font-mono">
                    +{formatCurrency(parseFloat((((modalLateHours * 60 + modalLateMins) / 60) * horaOrdinariaRate).toFixed(2)))}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLateHoursInput(modalLateHours);
                      setLateMinsInput(modalLateMins);
                      setLateReasonInput(modalLateReason);
                      handleSaveLateFinish(modalLateHours, modalLateMins, modalLateReason);
                      setIsLateSectionOpen(true);
                      setIsAddingExtraModal(false);
                    }}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                  >
                    Guardar Exceso en el Día
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingExtraModal(false)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmación para quitar turno asignado del día */}
      <ConfirmModal
        isOpen={showRemoveShiftConfirm}
        title="¿Quitar turno del día?"
        message={`¿Deseas desasignar el turno (${currentShift?.code || currentAssignment.shiftCode}) para el día ${selectedDayNumber} de ${MONTH_NAMES[selectedMonth - 1]}?\n\nEl día quedará como libre sin cómputo de servicio.`}
        confirmText="Sí, quitar turno"
        cancelText="Volver"
        isDestructive={true}
        onConfirm={() => {
          onUpdateAssignment(selectedDateStr, {
            shiftCode: undefined,
            isRest: false,
            isVacation: false,
            isSickLeave: false,
          });
          setShowRemoveShiftConfirm(false);
        }}
        onCancel={() => setShowRemoveShiftConfirm(false)}
      />

      {/* Confirmación para eliminar concepto extra del día */}
      <ConfirmModal
        isOpen={Boolean(extraToRemove)}
        title="¿Eliminar extra del día?"
        message={
          extraToRemove
            ? `¿Deseas eliminar el extra "${extraToRemove.name}" asignado a este día ${selectedDayNumber}?\n\nDejará de sumarse al subtotal devengado del día.`
            : ''
        }
        confirmText="Sí, eliminar extra"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (extraToRemove) {
            handleRemoveExtra(extraToRemove.id);
            setExtraToRemove(null);
          }
        }}
        onCancel={() => setExtraToRemove(null)}
      />
      {/* Confirmación para validar mes aunque queden días sin rellenar */}
      <ConfirmModal
        isOpen={showIncompleteValidateConfirm}
        title={`Validar ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
        message={`Actualmente hay ${counters.turnosCount + counters.descansosCount + counters.vacacionesCount + counters.bajasCount} de ${daysInMonth} días rellenados en el calendario.\n\nAl validar, se congelarán la jornada (${Math.round(partTimeFactorCal * 100)}%) y el IRPF (${profile?.irpfPercentage ?? 0}%), se guardará la nómina calculada de este mes y se recalcularán las horas del resto del año. ¿Deseas continuar?`}
        confirmText="Sí, validar y guardar"
        cancelText="Seguir editando"
        isDestructive={false}
        onConfirm={() => {
          setShowIncompleteValidateConfirm(false);
          if (onValidateMonth) {
            void onValidateMonth().then((res) => {
              if (res?.message) {
                setValidationFeedback(res.message);
                window.setTimeout(() => setValidationFeedback(null), 6000);
              }
            });
          }
        }}
        onCancel={() => setShowIncompleteValidateConfirm(false)}
      />

      {/* Confirmación para reabrir un mes validado */}
      <ConfirmModal
        isOpen={showUnvalidateConfirm}
        title={`¿Reabrir ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}?`}
        message={`Este mes estaba validado y bloqueado con su jornada (${validatedMonth?.jornadaPct ?? 100}%), IRPF (${validatedMonth?.irpfPercentage ?? 0}%) y turnos de ese momento.\n\nSi lo reabres, podrás editar días manualmente y la nómina volverá a calcularse con los valores y turnos vigentes.`}
        confirmText="Sí, reabrir mes"
        cancelText="Mantener validado"
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
