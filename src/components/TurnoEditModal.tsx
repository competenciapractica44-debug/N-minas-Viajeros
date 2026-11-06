import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, Plus, Minus, Check, Sparkles, ArrowLeft, Trash2, Moon } from 'lucide-react';
import { ShiftDefinition, ShiftModality, ConvenioYearRate } from '../types';
import { calculateNightHours, calculateTotalHours } from '../utils/calculator';
import { formatCurrency } from '../utils/exporter';
import { ConfirmModal } from './ConfirmModal';

interface TurnoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shift: ShiftDefinition) => void;
  onDelete?: (shiftId: string) => void;
  shiftToEdit?: ShiftDefinition | null;
  yearRate?: ConvenioYearRate;
}

const PRESET_COLORS = [
  { label: 'Amarillo (Mañana)', value: '#eab308' },
  { label: 'Azul Celeste (Tarde)', value: '#0284c7' },
  { label: 'Morado (Noche)', value: '#7c3aed' },
  { label: 'Turquesa (Vacaciones)', value: '#06b6d4' },
  { label: 'Naranja (Partido)', value: '#f97316' },
  { label: 'Verde (Descanso)', value: '#10b981' },
  { label: 'Gris (Reserva)', value: '#64748b' },
];

export const TurnoEditModal: React.FC<TurnoEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  shiftToEdit,
  yearRate,
}) => {
  const [code, setCode] = useState('M3');
  const [color, setColor] = useState('#eab308'); // Amarillo predeterminado para mañana
  const [title, setTitle] = useState('');
  const [modality, setModality] = useState<ShiftModality>('continuado');
  const [terminal, setTerminal] = useState('Línea de Servicio');
  const [isPartida, setIsPartida] = useState(false);

  // Schedules
  const [startTime, setStartTime] = useState('06:30');
  const [endTime, setEndTime] = useState('14:15');
  const [secondStartTime, setSecondStartTime] = useState('15:00');
  const [secondEndTime, setSecondEndTime] = useState('19:00');

  // Retribución
  const [includePlusPuntualidad, setIncludePlusPuntualidad] = useState(false);
  const [plusPuntualidadVal, setPlusPuntualidadVal] = useState(12.00);
  const [includePlusNocturnidad, setIncludePlusNocturnidad] = useState(false);
  const [isHolidayRate, setIsHolidayRate] = useState(false);

  // Effective year rates from Convenio (defaults to 2026: 13.62 €/h, nocturnidad 2.48 €/h)
  const effectiveYearRate: ConvenioYearRate = useMemo(() => {
    return yearRate || {
      year: 2026,
      salarioBaseDia: 53.18,
      salarioBaseAnual: 24196.90,
      horaOrdinaria: 13.62,
      plusNocturnidadHora: 2.48,
      plusConductorPerceptorDia: 6.27,
      plusConductorPerceptorDiaReducido: 3.14,
      quebrantoMonedaDia: 1.89,
      plusFestivoMayor4h: 40.80,
      plusFestivoMenor4h: 30.60,
      plus24y31Diciembre: 30.60,
      dietaComidaCenaRegular: 15.00,
      dietaComidaCenaDiscrecional: 19.00,
      dietaPernoctaRegular: 12.27,
      dietaPernoctaDiscrecional: 16.25,
      plusVacacionesDia: 10.00,
      horasJornadaAnual: 1776,
    };
  }, [yearRate]);

  // Override / manual amount
  const [customGrossRate, setCustomGrossRate] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (shiftToEdit) {
      setCode(shiftToEdit.code);
      setColor(shiftToEdit.color || '#eab308');
      setTitle(shiftToEdit.title);
      setModality(shiftToEdit.modality);
      setTerminal(shiftToEdit.terminal || 'Línea de Servicio');
      setIsPartida(shiftToEdit.modality === 'partido');
      setStartTime(shiftToEdit.startTime);
      setEndTime(shiftToEdit.endTime);
      setSecondStartTime(shiftToEdit.secondStartTime || '15:00');
      setSecondEndTime(shiftToEdit.secondEndTime || '19:00');
      if (shiftToEdit.dayType === 'festivo') {
        setIsHolidayRate(true);
      }
      if (shiftToEdit.fixedRate) {
        setCustomGrossRate(shiftToEdit.fixedRate);
      }
    } else {
      // Default clean state
      setCode('M3');
      setColor('#eab308'); // Amarillo predeterminado
      setTitle('Mañana Regular Línea 105');
      setModality('continuado');
      setTerminal('Línea de Servicio');
      setIsPartida(false);
      setStartTime('06:30');
      setEndTime('14:45');
      setCustomGrossRate(null);
    }
  }, [shiftToEdit, isOpen]);

  // Real-time calculation of shift duration
  const drivingMinutes = useMemo(() => {
    let mins = 0;
    if (isPartida) {
      const h1 = calculateTotalHours(startTime, endTime);
      const h2 = calculateTotalHours(secondStartTime, secondEndTime);
      mins = Math.round((h1 + h2) * 60);
    } else {
      const h = calculateTotalHours(startTime, endTime);
      mins = Math.round(h * 60);
    }
    return mins;
  }, [isPartida, startTime, endTime, secondStartTime, secondEndTime]);

  const drivingHoursStr = `${Math.floor(drivingMinutes / 60)}h ${String(drivingMinutes % 60).padStart(2, '0')}m`;

  // Real-time night hours in tramo 22:00 a 06:00
  const nightHours = useMemo(() => {
    if (isPartida) {
      return (
        calculateNightHours(startTime, endTime) +
        calculateNightHours(secondStartTime, secondEndTime)
      );
    }
    return calculateNightHours(startTime, endTime);
  }, [isPartida, startTime, endTime, secondStartTime, secondEndTime]);

  // Whenever shift has hours in 22:00 - 06:00, automatically select nocturnidad
  useEffect(() => {
    if (nightHours > 0) {
      setIncludePlusNocturnidad(true);
    }
  }, [nightHours]);

  // Automatic gross calculation strictly according to Convenio Colectivo
  const calculatedGross = useMemo(() => {
    const totalHours = drivingMinutes / 60;
    const hourlyBase = totalHours * effectiveYearRate.horaOrdinaria;
    let total = hourlyBase;

    // Plus nocturnidad (Art. 18: 2,48 €/h en tramo 22:00 a 06:00)
    if (includePlusNocturnidad || nightHours > 0) {
      total += nightHours * (effectiveYearRate.plusNocturnidadHora || 2.48);
    }

    if (includePlusPuntualidad) {
      total += plusPuntualidadVal;
    }

    if (isHolidayRate) {
      // Plus festivo Art. 17 Convenio
      total += totalHours > 4 ? effectiveYearRate.plusFestivoMayor4h : effectiveYearRate.plusFestivoMenor4h;
    }

    return Math.round(total * 100) / 100;
  }, [
    drivingMinutes,
    effectiveYearRate,
    includePlusNocturnidad,
    nightHours,
    includePlusPuntualidad,
    plusPuntualidadVal,
    isHolidayRate,
  ]);

  const effectiveGrossRate = customGrossRate !== null ? customGrossRate : calculatedGross;

  if (!isOpen) return null;

  const handleSave = () => {
    let cat: ShiftDefinition['category'] = 'mañana';
    const sH = parseInt(startTime.split(':')[0], 10);
    if (modality === 'nocturno' || sH >= 22 || sH < 4) cat = 'noche';
    else if (modality === 'partido' || isPartida) cat = 'partido';
    else if (modality === 'discrecional') cat = 'discrecional';
    else if (sH >= 13) cat = 'tarde';

    // If color was default or unmodified, ensure requested category color
    let finalColor = color;
    if (!finalColor || finalColor === '#2563eb') {
      if (cat === 'mañana') finalColor = '#eab308';
      else if (cat === 'tarde') finalColor = '#0284c7';
      else if (cat === 'noche') finalColor = '#7c3aed';
    }

    const savedShift: ShiftDefinition = {
      id: shiftToEdit ? shiftToEdit.id : `custom-${Date.now()}`,
      code: code.trim().toUpperCase() || 'M1',
      title: title.trim() || `Servicio ${code}`,
      category: cat,
      dayType: isHolidayRate ? 'festivo' : 'laborable',
      modality: isPartida ? 'partido' : modality,
      terminal: terminal.trim() || 'Cochera Central',
      startTime,
      endTime,
      secondStartTime: isPartida ? secondStartTime : undefined,
      secondEndTime: isPartida ? secondEndTime : undefined,
      drivingDuration: drivingHoursStr,
      computedDuration: `${drivingHoursStr} (Jornada completa)`,
      fixedRate: effectiveGrossRate,
      color: finalColor,
      badges: [
        isPartida ? 'Servicio Partido' : modality === 'nocturno' ? 'Nocturnidad fija' : 'Servicio Ordinario',
      ],
      isCustom: true,
    };

    onSave(savedShift);
    onClose();
  };

  const handleDeleteClick = () => {
    if (!shiftToEdit) return;
    setShowDeleteConfirm(true);
  };

  const executeDelete = () => {
    if (!shiftToEdit) return;
    if (onDelete) onDelete(shiftToEdit.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Header matching screenshot 2 */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {shiftToEdit ? 'Editar Turno BD' : 'Nuevo Turno BD'}
              </h2>
              <p className="text-[11px] text-slate-500">Ficha técnica para cálculo automatizado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shiftToEdit && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-colors flex items-center gap-1.5"
                title="Eliminar este turno de la base de datos"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              En edición
            </span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* SECTION 1: IDENTIFICACIÓN Y CÓDIGO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide uppercase text-blue-700 flex items-center gap-1.5">
                IDENTIFICACIÓN Y CÓDIGO
              </span>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Homologado convenio
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Código Turno *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={7}
                    placeholder="M3"
                    className="w-full text-center font-bold text-base py-2 px-3 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block text-center">
                    Visible en cuadrante
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Color en Calendario
                </label>
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200/80">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                        color === c.value ? 'scale-110 ring-2 ring-offset-1 ring-slate-900' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {color === c.value && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-end gap-1">
                  <span>Previa:</span>
                  <span
                    className="px-1.5 py-0.2 rounded font-bold text-[10px]"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {code || 'M3'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Denominación del Servicio *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mañana Refuerzo Hospital - Línea 105"
                className="w-full text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Modalidad de Explotación */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                Modalidad de Explotación
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'continuado', label: 'Continuado Ordinario' },
                  { id: 'partido', label: 'Partido (2 tramos)' },
                  { id: 'nocturno', label: 'Nocturno (Búho)' },
                  { id: 'discrecional', label: 'Fábricas / Discrecional' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setModality(item.id as ShiftModality);
                      setIsPartida(item.id === 'partido');
                    }}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold text-center transition-all ${
                      modality === item.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: HORARIOS Y TRAMOS */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" /> Horarios y Tramos
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setIsPartida(false)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    !isPartida ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Continua
                </button>
                <button
                  type="button"
                  onClick={() => setIsPartida(true)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    isPartida ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Partida
                </button>
              </div>
            </div>

            {/* Tramo 1 */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  {isPartida ? '1º Tramo Línea' : 'Tramo Línea / Volante'}
                </span>
                <span className="text-[10px] text-slate-400">Servicio activo</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Inicio Servicio</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full font-mono text-xs font-semibold py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Fin de Línea</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full font-mono text-xs font-semibold py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Tramo 2 if Partida */}
            {isPartida && (
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    2º Tramo Línea
                  </span>
                  <span className="text-[10px] text-amber-700">Tarde / Retorno</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Inicio 2º Tramo</label>
                    <input
                      type="time"
                      value={secondStartTime}
                      onChange={(e) => setSecondStartTime(e.target.value)}
                      className="w-full font-mono text-xs font-semibold py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Fin de Servicio</label>
                    <input
                      type="time"
                      value={secondEndTime}
                      onChange={(e) => setSecondEndTime(e.target.value)}
                      className="w-full font-mono text-xs font-semibold py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs px-1 text-slate-600">
              <span>Conducción efectiva calculada:</span>
              <span className="font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                {drivingHoursStr}
              </span>
            </div>
          </div>

          {/* RESUMEN DE JORNADA PROGRAMADA */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">
                  Jornada Completa Programada
                </span>
                <span className="text-xs text-slate-600">
                  Horario íntegro de servicio registrado
                </span>
              </div>
            </div>
            <span className="text-base sm:text-lg font-black text-emerald-900 font-mono">
              {drivingHoursStr}
            </span>
          </div>

          {/* SECTION 4: RETRIBUCIÓN POR ASIGNACIÓN */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                Retribución por Asignación
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Fijo Nómina
              </span>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 block mb-1">
                Importe Total Bruto por Turno Realizado *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  value={effectiveGrossRate}
                  onChange={(e) => setCustomGrossRate(parseFloat(e.target.value) || 0)}
                  className="w-full text-2xl font-black font-mono py-2.5 px-4 rounded-2xl bg-blue-50/40 border border-blue-200 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-500">
                  €
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Se sumará de forma íntegra a tu devengo bruto cada vez que selecciones este código en el mes.
              </p>
            </div>

            {/* CONCEPTOS Y PLUSES SEGÚN CONVENIO */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Cálculo según Convenio ({effectiveYearRate.year})
                </span>
                {customGrossRate !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomGrossRate(null)}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    Usar cálculo oficial ({formatCurrency(calculatedGross)})
                  </button>
                )}
              </div>

              {/* Base por horas */}
              <div className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-200/50">
                <div>
                  <span className="font-medium block">Horas de servicio ({drivingHoursStr})</span>
                  <span className="text-[10px] text-slate-500">
                    {(drivingMinutes / 60).toFixed(2)}h × {formatCurrency(effectiveYearRate.horaOrdinaria)}/h ordinaria
                  </span>
                </div>
                <span className="font-bold font-mono text-slate-800">
                  {formatCurrency(((drivingMinutes / 60) * effectiveYearRate.horaOrdinaria))}
                </span>
              </div>

              {/* Plus Nocturnidad 22:00 a 06:00 */}
              <div className={`p-2.5 rounded-xl border transition-colors ${
                nightHours > 0
                  ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                  : 'bg-white/60 border-slate-200/70 text-slate-600'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Moon className={`w-4 h-4 mt-0.5 shrink-0 ${nightHours > 0 ? 'text-purple-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs">Plus Nocturnidad (22:00 - 06:00)</span>
                        {nightHours > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-200/70 text-purple-800 text-[10px] font-bold">
                            Activo auto
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {nightHours > 0
                          ? `${nightHours.toFixed(2)}h nocturnas detectadas en el horario a ${effectiveYearRate.plusNocturnidadHora.toFixed(2)} €/h (Art. 18 Convenio)`
                          : 'El turno no coincide con el tramo nocturno (22:00 a 06:00)'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-mono font-bold text-xs shrink-0 ${nightHours > 0 ? 'text-purple-700' : 'text-slate-400'}`}>
                    +{formatCurrency(nightHours * effectiveYearRate.plusNocturnidadHora)}
                  </span>
                </div>
              </div>

              {/* Plus puntualidad opcional */}
              <label className="flex items-center justify-between text-slate-700 py-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includePlusPuntualidad}
                    onChange={(e) => setIncludePlusPuntualidad(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Plus puntualidad e inicio temprano</span>
                </div>
                <span className="font-semibold text-emerald-600 font-mono">+{formatCurrency(plusPuntualidadVal)}</span>
              </label>
            </div>

            {/* Aplicación tarifaria automática */}
            <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-xl text-xs">
              <span className="font-semibold text-slate-700">Tipo de jornada:</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rateType"
                    checked={!isHolidayRate}
                    onChange={() => setIsHolidayRate(false)}
                    className="text-blue-600"
                  />
                  <span>Laborable</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rateType"
                    checked={isHolidayRate}
                    onChange={() => setIsHolidayRate(true)}
                    className="text-blue-600"
                  />
                  <span>Festivo / Domingo (+{formatCurrency(drivingMinutes / 60 > 4 ? effectiveYearRate.plusFestivoMayor4h : effectiveYearRate.plusFestivoMenor4h)})</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 sticky bottom-0">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
          >
            <span>Guardar Turno en Base de Datos</span>
          </button>
          {shiftToEdit && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl border border-rose-200/80 transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Eliminar este Turno de la Base de Datos</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Descartar cambios
          </button>
        </div>
      </div>

      {/* Confirmation modal for shift deletion */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={shiftToEdit ? `¿Eliminar turno ${shiftToEdit.code}?` : '¿Eliminar turno?'}
        message={
          shiftToEdit
            ? `¿Estás seguro de que deseas eliminar permanentemente el turno "${shiftToEdit.code} - ${shiftToEdit.title}" de la base de datos?\n\nDejará de estar disponible en el cuadrante mensual.`
            : ''
        }
        confirmText="Sí, eliminar turno"
        cancelText="Volver"
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
