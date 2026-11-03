import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Layers,
  Sparkles,
  Edit3,
} from 'lucide-react';
import {
  DayAssignment,
  ShiftDefinition,
  ExtraConcept,
  ConvenioInfo,
} from '../types';
import { formatCurrency } from '../utils/exporter';
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
  onEditShift,
}) => {
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [isAddingExtraModal, setIsAddingExtraModal] = useState(false);
  const [selectedExtraConceptId, setSelectedExtraConceptId] = useState('');
  const [customExtraName, setCustomExtraName] = useState('');
  const [customExtraAmount, setCustomExtraAmount] = useState(25.00);
  const [showRemoveShiftConfirm, setShowRemoveShiftConfirm] = useState(false);
  const [extraToRemove, setExtraToRemove] = useState<{ id: string; name: string } | null>(null);

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

  // Counters
  const counters = useMemo(() => {
    let turnosCount = 0;
    let descansosCount = 0;
    let extrasTotal = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const asg = assignments.find((a) => a.date === dStr);
      if (asg) {
        if (asg.shiftCode === 'D' || asg.isRest) {
          descansosCount++;
        } else if (asg.shiftCode) {
          turnosCount++;
        }
        if (asg.extras) {
          asg.extras.forEach((e) => {
            extrasTotal += e.amount;
          });
        }
      }
    }
    return { turnosCount, descansosCount, extrasTotal };
  }, [assignments, daysInMonth, selectedYear, selectedMonth]);

  // Day subtotal devengado
  const selectedDayTotal = useMemo(() => {
    let base = 0;
    if (currentShift && currentShift.code !== 'D') {
      base = currentShift.fixedRate || convenio.ratesByYear[selectedYear]?.salarioBaseDia || 50.37;
    }
    const extrasSum = currentAssignment.extras?.reduce((sum, e) => sum + e.amount, 0) || 0;
    return base + extrasSum;
  }, [currentShift, currentAssignment.extras, convenio, selectedYear]);

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
    const shift = shiftsMap.get(code);
    onUpdateAssignment(selectedDateStr, {
      shiftCode: code,
      isRest: code === 'D',
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
      <div className="flex items-center justify-center gap-4 text-xs font-semibold py-1">
        <span className="flex items-center gap-1.5 text-slate-700">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <strong>{counters.turnosCount}</strong> Turnos
        </span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5 text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          <strong>{counters.descansosCount}</strong> Descansos
        </span>
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
            const hasExtras = asg?.extras && asg.extras.length > 0;

            const isRest = shiftCode === 'D' || asg?.isRest;

            // Determine badge appearance
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';
            if (isRest) {
              badgeBg = '#dcfce7'; // green
              badgeColor = '#15803d';
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
          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                {currentShift.modality === 'partido' && currentShift.secondStartTime
                  ? `Horario Partido (${currentShift.startTime}-${currentShift.endTime} / ${currentShift.secondStartTime}-${currentShift.secondEndTime})`
                  : `Horario Continuo (${currentShift.startTime} - ${currentShift.endTime})`}
              </span>
              <span className="text-sm font-bold font-mono text-slate-900">
                {formatCurrency(currentShift.fixedRate || convenio.ratesByYear[selectedYear]?.salarioBaseDia || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Tarifa BD: {currentShift.computedDuration || 'Jornada completa'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Fijado BD</span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-dashed border-slate-200">
            Ningún turno asignado para este día. Elige uno abajo en el teclado rápido.
          </div>
        )}

        {/* PARTICULARIDADES / EXTRAS DEL DÍA matching screenshot 3 */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Particularidades / Extras del Día
            </span>
            <button
              onClick={() => setIsAddingExtraModal(true)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>

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
            <p className="text-xs text-slate-400 italic">Sin extras asignados para este día.</p>
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
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { code: 'M1', label: 'Mañana', rate: 82.00, color: '#eab308' },
            { code: 'T1', label: 'Tarde', rate: 82.00, color: '#0284c7' },
            { code: 'SP1', label: 'Partido', rate: 91.50, color: '#f97316' },
            { code: 'N1', label: 'Nocturno', rate: 104.50, color: '#7c3aed' },
            { code: 'D', label: 'Descanso', rate: 0, color: '#10b981' },
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
              .filter((s) => !['M1', 'T1', 'SP1', 'N1', 'D', 'R'].includes(s.code))
              .map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code} · {s.title} ({s.startTime}-{s.endTime}) - {formatCurrency(s.fixedRate || 0)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Modal to add extra concept to day */}
      {isAddingExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Añadir Extra al Día {selectedDayNumber}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Elegir concepto preconfigurado
                </label>
                <select
                  value={selectedExtraConceptId}
                  onChange={(e) => {
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
