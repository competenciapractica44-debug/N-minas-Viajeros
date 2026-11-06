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
} from 'lucide-react';
import {
  DayAssignment,
  ShiftDefinition,
  ExtraConcept,
  ConvenioInfo,
  WorkerProfile,
} from '../types';
import { formatCurrency } from '../utils/exporter';
import { formatMinutesToHoursAndMinutes, computeShiftRateFromConvenio } from '../utils/calculator';
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
}) => {
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [isAddingExtraModal, setIsAddingExtraModal] = useState(false);
  const [selectedExtraConceptId, setSelectedExtraConceptId] = useState('');
  const [customExtraName, setCustomExtraName] = useState('');
  const [customExtraAmount, setCustomExtraAmount] = useState(25.00);
  const [showRemoveShiftConfirm, setShowRemoveShiftConfirm] = useState(false);
  const [extraToRemove, setExtraToRemove] = useState<{ id: string; name: string } | null>(null);

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
    if (!currentAssignment.shiftCode) return null;
    return (
      shiftsMap.get(currentAssignment.shiftCode) ||
      shifts.find((s) => s.code === currentAssignment.shiftCode)
    );
  }, [shiftsMap, shifts, currentAssignment.shiftCode]);

  const horaOrdinariaRate = convenio.ratesByYear[selectedYear]?.horaOrdinaria || 12.87;

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
    let turnosCount = 0;
    let descansosCount = 0;
    let vacacionesCount = 0;
    let extrasTotal = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const asg = assignments.find((a) => a.date === dStr);
      if (asg) {
        if (asg.shiftCode === 'D' || asg.isRest) {
          descansosCount++;
        } else if (asg.shiftCode === 'V' || asg.isVacation) {
          vacacionesCount++;
        } else if (asg.shiftCode) {
          turnosCount++;
        }
        if (asg.extras) {
          asg.extras.forEach((e) => {
            extrasTotal += e.amount;
          });
        }
        if (asg.lateFinishMinutes && asg.lateFinishMinutes > 0) {
          const lateAmt = asg.lateFinishAmount !== undefined
            ? asg.lateFinishAmount
            : (asg.lateFinishMinutes / 60) * horaOrdinariaRate;
          extrasTotal += lateAmt;
        }
      }
    }
    return { turnosCount, descansosCount, vacacionesCount, extrasTotal };
  }, [assignments, daysInMonth, selectedYear, selectedMonth, horaOrdinariaRate]);

  // Helper: check if vacation plus (10€/day) applies based on profile 100% contract condition
  const isJornada100 = !profile || profile.contractType !== 'tiempo_parcial' || (profile.partTimePercentage || 100) >= 100;
  const isAutoVacationPlusActive = profile?.hasVacationPlus100Percent !== false;
  const appliesVacationPlus = isAutoVacationPlusActive && isJornada100;

  // Day subtotal devengado
  const selectedDayTotal = useMemo(() => {
    let base = 0;
    const yearRate = convenio.ratesByYear[selectedYear] || convenio.ratesByYear[2026];
    const isSunday = new Date(selectedYear, selectedMonth - 1, selectedDayNumber).getDay() === 0;

    if (currentShift) {
      if (currentShift.code === 'D') {
        base = 0;
      } else if (currentShift.code === 'V') {
        const factor = (!isJornada100 && profile?.partTimePercentage) ? profile.partTimePercentage / 100 : 1;
        const baseDia = (yearRate.salarioBaseDia || 50.37) * factor;
        const plusVac = appliesVacationPlus ? (yearRate.plusVacacionesDia || 10.00) : 0;
        base = baseDia + plusVac;
      } else {
        const shiftCalc = computeShiftRateFromConvenio(currentShift, yearRate, { isSunday });
        base = shiftCalc.totalRate;
      }
    }
    const extrasSum = currentAssignment.extras?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const lateAmt = currentAssignment.lateFinishAmount !== undefined
      ? currentAssignment.lateFinishAmount
      : (currentAssignment.lateFinishMinutes
          ? parseFloat(((currentAssignment.lateFinishMinutes / 60) * (yearRate.horaOrdinaria || horaOrdinariaRate)).toFixed(2))
          : 0);
    return base + extrasSum + lateAmt;
  }, [
    currentShift,
    currentAssignment.extras,
    currentAssignment.lateFinishMinutes,
    currentAssignment.lateFinishAmount,
    convenio,
    selectedYear,
    selectedMonth,
    selectedDayNumber,
    isJornada100,
    appliesVacationPlus,
    profile?.partTimePercentage,
    horaOrdinariaRate,
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
    onUpdateAssignment(selectedDateStr, {
      shiftCode: code,
      isRest: code === 'D',
      isVacation: code === 'V',
    });
  };

  // Add extra to selected day
  const handleAddExtraToDay = () => {
    let name = customExtraName;
    let amount = customExtraAmount;

    if (selectedExtraConceptId) {
      const concept = extrasList.find((e) => e.id === selectedExtraConceptId);
      if (concept) {
        name = concept.name;
        amount = concept.amount;
      }
    }

    if (!name) return;

    const newExtra = {
      id: `dayextra-${Date.now()}`,
      name,
      amount,
    };

    const currentExtras = currentAssignment.extras || [];
    onUpdateAssignment(selectedDateStr, {
      extras: [...currentExtras, newExtra],
    });

    setIsAddingExtraModal(false);
    setSelectedExtraConceptId('');
    setCustomExtraName('');
  };

  const handleRemoveExtra = (extraId: string) => {
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
          <strong>{counters.turnosCount}</strong> Turnos
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
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5 text-slate-700">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <strong>{counters.extrasTotal > 0 ? `+${formatCurrency(counters.extrasTotal)}` : '0€'}</strong> Extras
        </span>
      </div>

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
            const shiftDef = shiftCode ? shiftsMap.get(shiftCode) || shifts.find((s) => s.code === shiftCode) : null;
            const isSelected = selectedDayNumber === dayNum;
            const hasExtras = (asg?.extras && asg.extras.length > 0) || Boolean(asg?.lateFinishMinutes && asg.lateFinishMinutes > 0);

            const isRest = shiftCode === 'D' || asg?.isRest;
            const isVacation = shiftCode === 'V' || asg?.isVacation;

            // Determine badge appearance
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';
            if (isRest) {
              badgeBg = '#dcfce7'; // green
              badgeColor = '#15803d';
            } else if (isVacation) {
              badgeBg = '#cffafe'; // cyan-100
              badgeColor = '#0891b2'; // cyan-600
            } else if (shiftDef) {
              badgeBg = `${shiftDef.color}18`;
              badgeColor = shiftDef.color;
            }

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDayNumber(dayNum)}
                className={`h-14 sm:h-16 p-1 rounded-xl flex flex-col justify-between items-center transition-all relative ${
                  isSelected
                    ? 'ring-2 ring-blue-600 bg-blue-50/40 shadow-xs z-10'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Day number & indicators */}
                <div className="w-full flex items-center justify-between px-1">
                  <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                    {dayNum}
                  </span>
                  {hasExtras && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Contiene extras"></span>
                  )}
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
      </div>

      {/* Selected Day Details Panel matching screenshot 3 */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {formattedDayTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentAssignment.customLine || 'Línea Interurbana 421 · Coche 304'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {currentAssignment.shiftCode && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (currentShift && onEditShift) {
                      onEditShift(currentShift);
                    }
                  }}
                  title="Ver o editar ficha de este turno"
                  className="px-2.5 py-1 rounded-lg text-xs font-black transition-transform hover:scale-105"
                  style={{
                    backgroundColor: currentShift ? `${currentShift.color}20` : '#e2e8f0',
                    color: currentShift ? currentShift.color : '#334155',
                  }}
                >
                  {currentAssignment.shiftCode}
                </button>

                {currentShift && onEditShift && (
                  <button
                    type="button"
                    onClick={() => onEditShift(currentShift)}
                    title="Editar ficha del turno en la base de datos"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowRemoveShiftConfirm(true)}
                  title="Eliminar este turno del día (dejar libre)"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

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
          </div>
        </div>

        {/* Shift Details Box */}
        {currentShift ? (
          currentShift.code === 'V' ? (
            <div className="bg-cyan-50/90 rounded-2xl p-3.5 border border-cyan-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-cyan-950">
                <span className="flex items-center gap-1.5 font-bold">
                  <CalendarIcon className="w-4 h-4 text-cyan-600" />
                  Vacaciones Anuales Retribuidas
                </span>
                <span className="text-sm font-bold font-mono text-cyan-800">
                  {formatCurrency(
                    ((convenio.ratesByYear[selectedYear]?.salarioBaseDia || 50.37) * (!isJornada100 && profile?.partTimePercentage ? profile.partTimePercentage / 100 : 1)) +
                    (appliesVacationPlus ? (convenio.ratesByYear[selectedYear]?.plusVacacionesDia || 10.00) : 0)
                  )}
                </span>
              </div>
              {appliesVacationPlus ? (
                <p className="text-[11px] text-cyan-800 leading-relaxed">
                  Jornada retribuida completa (100%): Salario Base diario ({formatCurrency(convenio.ratesByYear[selectedYear]?.salarioBaseDia || 50.37)}) + <strong>Plus de Vacaciones de {formatCurrency(convenio.ratesByYear[selectedYear]?.plusVacacionesDia || 10.00)}/día</strong> según el Art. 9 del Convenio Colectivo de Zaragoza.
                </p>
              ) : !isJornada100 ? (
                <p className="text-[11px] text-cyan-900 leading-relaxed">
                  Jornada de vacaciones retribuida con Salario Base proporcional ({formatCurrency((convenio.ratesByYear[selectedYear]?.salarioBaseDia || 50.37) * ((profile?.partTimePercentage || 50) / 100))}). El <strong>Plus de Vacaciones (10 €/día)</strong> no se devenga al estar contratado al {profile?.partTimePercentage || 50}% (la opción configurada en el perfil requiere contrato al 100%).
                </p>
              ) : (
                <p className="text-[11px] text-cyan-900 leading-relaxed">
                  Jornada de vacaciones retribuida con Salario Base diario ({formatCurrency(convenio.ratesByYear[selectedYear]?.salarioBaseDia || 50.37)}). El <strong>Plus de Vacaciones (10 €/día)</strong> se encuentra desactivado en tu Perfil de trabajador.
                </p>
              )}
              <div className="flex items-center justify-between text-[11px] text-cyan-700 pt-1 border-t border-cyan-200/60">
                <span className="flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
                  {appliesVacationPlus ? 'Plus de 10 €/día activo (contrato al 100%)' : 'Retribución Salario Base diaria'}
                </span>
                <span className="text-[10px] font-bold text-cyan-700 uppercase bg-cyan-100 px-2 py-0.5 rounded-md">Art. 9 Convenio</span>
              </div>
            </div>
          ) : (
            (() => {
              const activeRate = convenio.ratesByYear[selectedYear] || convenio.ratesByYear[2026];
              const isSunday = new Date(selectedYear, selectedMonth - 1, selectedDayNumber).getDay() === 0;
              const shiftRateCalc = computeShiftRateFromConvenio(currentShift, activeRate, { isSunday });

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
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200/70 px-1.5 py-0.5 rounded">
                      Convenio {selectedYear}
                    </span>
                  </div>
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Particularidades / Extras del Día
            </span>
            <div className="flex items-center gap-1.5">
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

              <button
                type="button"
                onClick={() => {
                  setModalExtraTab('concepto');
                  setIsAddingExtraModal(true);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline px-1 py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>

          {/* APARTADO DESPLEGABLE: Terminado más tarde de lo que marca el turno */}
          {isLateSectionOpen ? (
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
                  +{formatCurrency(currentAssignment.lateFinishAmount || (((currentAssignment.lateFinishMinutes || 0) / 60) * horaOrdinariaRate))}
                </span>
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
              </div>
            </div>
          ) : null}

          {/* Lista de otros extras asignados */}
          {currentAssignment.extras && currentAssignment.extras.length > 0 ? (
            <div className="space-y-2">
              {currentAssignment.extras.map((extra) => (
                <div
                  key={extra.id}
                  className="flex items-center justify-between p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/60 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <div>
                      <p className="font-semibold text-slate-800">{extra.name}</p>
                      {extra.notes && <p className="text-[10px] text-slate-500">{extra.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-emerald-700">
                      +{formatCurrency(extra.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtraToRemove({ id: extra.id, name: extra.name })}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Eliminar extra"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !isLateSectionOpen && !(currentAssignment.lateFinishMinutes && currentAssignment.lateFinishMinutes > 0) && (
              <p className="text-xs text-slate-400 italic">Sin extras asignados para este día.</p>
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
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-slate-700 uppercase tracking-wide">
            Teclado de Asignación Rápida
          </span>
          <span className="text-blue-600 font-medium">
            Pulsa para asignar al día {selectedDayNumber}
          </span>
        </div>

        {/* Quick buttons strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { code: 'M1', label: 'Mañana', rate: 82.00, color: '#eab308' },
            { code: 'T1', label: 'Tarde', rate: 82.00, color: '#0284c7' },
            { code: 'S1', label: 'Sábado', rate: 82.00, color: '#0284c7' },
            { code: 'N1', label: 'Nocturno', rate: 104.50, color: '#7c3aed' },
            { code: 'D', label: 'Descanso', rate: 0, color: '#10b981' },
            {
              code: 'V',
              label: 'Vacaciones',
              rate: appliesVacationPlus
                ? 60.37
                : Math.round(((convenio.ratesByYear[selectedYear]?.salarioBaseDia || 50.37) * (!isJornada100 && profile?.partTimePercentage ? profile.partTimePercentage / 100 : 1)) * 100) / 100,
              color: '#06b6d4',
              subtitle: appliesVacationPlus ? '+10€' : 'Base',
            },
            { code: 'R', label: 'Reserva', rate: 78.50, color: '#eab308' },
          ].map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => handleAssignShift(item.code)}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                currentAssignment.shiftCode === item.code
                  ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className="font-bold text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${item.color}20`, color: item.color }}
                >
                  {item.code}
                </span>
                {item.subtitle && (
                  <span className="text-[9px] font-bold text-cyan-800 bg-cyan-100 px-1 py-0.5 rounded">
                    {item.subtitle}
                  </span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-[11px] font-semibold text-slate-700 block truncate">
                  {item.label}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {item.rate > 0 ? formatCurrency(item.rate) : 'Libre'}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Dropdown to pick from all other official DIREXIS parts */}
        <div className="flex items-center gap-2 pt-1">
          <select
            value={currentAssignment.shiftCode || ''}
            onChange={(e) => {
              if (e.target.value) handleAssignShift(e.target.value);
            }}
            className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Seleccionar entre todos los partes Direxis Zaragoza (98 turnos)...</option>
            {shifts
              .filter((s) => !['M1', 'T1', 'S1', 'N1', 'D', 'R', 'V'].includes(s.code))
              .map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code} · {s.title} ({s.startTime}-{s.endTime}) - {formatCurrency(computeShiftRateFromConvenio(s, convenio.ratesByYear[selectedYear] || convenio.ratesByYear[2026]).totalRate)}
                </option>
              ))}
          </select>
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
                        setCustomExtraAmount(found.amount);
                      }
                    }}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">-- Seleccionar o escribir manual --</option>
                    <option value="__late_finish__">⏱️ Terminado más tarde del turno (Horas y minutos)</option>
                    {extrasList.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} (+{formatCurrency(e.amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Descripción del Concepto
                  </label>
                  <input
                    type="text"
                    value={customExtraName}
                    onChange={(e) => setCustomExtraName(e.target.value)}
                    placeholder="ej. Limpieza interior autocar"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Importe Bruto Adicional (€)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={customExtraAmount}
                    onChange={(e) => setCustomExtraAmount(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono font-bold"
                  />
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
          onUpdateAssignment(selectedDateStr, { shiftCode: undefined, isRest: false });
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
    </div>
  );
};
