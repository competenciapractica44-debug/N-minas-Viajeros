import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Clock, CheckCircle2, Award, ShieldCheck, Bus, RefreshCw, Trash2, Calendar } from 'lucide-react';
import { ShiftDefinition } from '../types';
import { formatCurrency } from '../utils/exporter';
import { ConfirmModal } from './ConfirmModal';

interface TurnosBDViewProps {
  shifts: ShiftDefinition[];
  onOpenNewTurnoModal: () => void;
  onEditTurno: (shift: ShiftDefinition) => void;
  onDeleteTurno: (id: string) => void;
  onRestoreDefaults: () => void;
  currentYear: number;
}

type DayFilterType = 'todos' | 'laborable' | 'sabado' | 'festivo';
type TimeFilterType = 'todos' | 'mañana' | 'tarde' | 'noche';

const DAY_FILTERS: { id: DayFilterType; label: string; fullLabel: string }[] = [
  { id: 'todos', label: 'Todos', fullLabel: 'Todos los días' },
  { id: 'laborable', label: 'L-V', fullLabel: 'Laborables (Lunes a Viernes)' },
  { id: 'sabado', label: 'Sáb', fullLabel: 'Sábados' },
  { id: 'festivo', label: 'Dom/Fest', fullLabel: 'Domingos y Festivos' },
];

const TIME_FILTERS: { id: TimeFilterType; label: string; dotClass?: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'mañana', label: 'Mañana', dotClass: 'bg-amber-400' },
  { id: 'tarde', label: 'Tarde', dotClass: 'bg-sky-500' },
  { id: 'noche', label: 'Noche', dotClass: 'bg-purple-600' },
];

export const TurnosBDView: React.FC<TurnosBDViewProps> = ({
  shifts,
  onOpenNewTurnoModal,
  onEditTurno,
  onDeleteTurno,
  onRestoreDefaults,
  currentYear,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDayType, setSelectedDayType] = useState<DayFilterType>('todos');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeFilterType>('todos');
  const [shiftToDelete, setShiftToDelete] = useState<ShiftDefinition | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // Contadores para el filtro de Jornada (Día)
  const dayCounts = useMemo(() => {
    const counts: Record<DayFilterType, number> = {
      todos: 0,
      laborable: 0,
      sabado: 0,
      festivo: 0,
    };
    shifts.forEach((s) => {
      if (s.code === 'D') return;
      counts.todos++;
      if (s.dayType === 'laborable') {
        counts.laborable++;
      } else if (
        s.dayType === 'sabado' ||
        s.title.toLowerCase().includes('sábado') ||
        (s.badges && s.badges.some((b) => b.toLowerCase().includes('sábado')))
      ) {
        counts.sabado++;
      } else if (
        s.dayType === 'festivo' ||
        s.title.toLowerCase().includes('festivo') ||
        s.title.toLowerCase().includes('domingo') ||
        (s.badges && s.badges.some((b) => b.toLowerCase().includes('festivo') || b.toLowerCase().includes('domingo')))
      ) {
        counts.festivo++;
      }
    });
    return counts;
  }, [shifts]);

  // Contadores para el filtro de Franja Horaria (respetando la jornada seleccionada)
  const timeCounts = useMemo(() => {
    const counts: Record<TimeFilterType, number> = {
      todos: 0,
      mañana: 0,
      tarde: 0,
      noche: 0,
    };
    shifts.forEach((s) => {
      if (s.code === 'D') return;

      let matchesDay = true;
      if (selectedDayType === 'laborable') {
        matchesDay = s.dayType === 'laborable';
      } else if (selectedDayType === 'sabado') {
        matchesDay =
          s.dayType === 'sabado' ||
          s.title.toLowerCase().includes('sábado') ||
          (s.badges && s.badges.some((b) => b.toLowerCase().includes('sábado')));
      } else if (selectedDayType === 'festivo') {
        matchesDay =
          s.dayType === 'festivo' ||
          s.title.toLowerCase().includes('festivo') ||
          s.title.toLowerCase().includes('domingo') ||
          (s.badges && s.badges.some((b) => b.toLowerCase().includes('festivo') || b.toLowerCase().includes('domingo')));
      }

      if (!matchesDay) return;

      counts.todos++;
      if (s.category === 'mañana') counts.mañana++;
      else if (s.category === 'tarde') counts.tarde++;
      else if (s.category === 'noche') counts.noche++;
    });
    return counts;
  }, [shifts, selectedDayType]);

  // Filter shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      // Exclude generic 'D' from general turnos list or keep it
      if (s.code === 'D') return false;

      const matchesSearch =
        !searchTerm.trim() ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.terminal.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesDay = true;
      if (selectedDayType === 'laborable') {
        matchesDay = s.dayType === 'laborable';
      } else if (selectedDayType === 'sabado') {
        matchesDay =
          s.dayType === 'sabado' ||
          s.title.toLowerCase().includes('sábado') ||
          (s.badges && s.badges.some((b) => b.toLowerCase().includes('sábado')));
      } else if (selectedDayType === 'festivo') {
        matchesDay =
          s.dayType === 'festivo' ||
          s.title.toLowerCase().includes('festivo') ||
          s.title.toLowerCase().includes('domingo') ||
          (s.badges && s.badges.some((b) => b.toLowerCase().includes('festivo') || b.toLowerCase().includes('domingo')));
      }

      let matchesTime = true;
      if (selectedTimeSlot !== 'todos') {
        matchesTime = s.category === selectedTimeSlot;
      }

      return matchesSearch && matchesDay && matchesTime;
    });
  }, [shifts, searchTerm, selectedDayType, selectedTimeSlot]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-4">
      {/* Top Banner Card matching design */}
      <div className="bg-blue-50/90 rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-sm relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Base de Datos & Tarifas de Turno
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tarifario de Turnos de <strong>DIREXIS ZARAGOZA</strong> y servicios personalizados.
              Cada turno refleja el cómputo íntegro de la jornada y retribución fijada según convenio.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1 text-blue-700">
                <Clock className="w-3.5 h-3.5" /> Convenio Transporte {currentYear}
              </span>
              <span>·</span>
              <span>{shifts.filter((s) => s.code !== 'D').length} turnos en base de datos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Input matching design */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar código o línea..."
          className="w-full bg-white text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Sistema Combinado de Filtros (Jornada y Franja horaria) */}
      <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-xs space-y-3">
        {/* Nivel 1: Jornada / Día */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5 px-0.5">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              1. Día / Jornada
            </span>
            {selectedDayType !== 'todos' && (
              <button
                type="button"
                onClick={() => setSelectedDayType('todos')}
                className="text-blue-600 hover:text-blue-800 text-[10px] font-semibold hover:underline"
              >
                Ver todos
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5 w-full">
            {DAY_FILTERS.map((item) => {
              const isActive = selectedDayType === item.id;
              const count = dayCounts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedDayType(item.id)}
                  title={item.fullLabel}
                  className={`w-full py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs font-bold ring-1 ring-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-medium'
                  }`}
                >
                  <span className="text-xs truncate w-full">{item.label}</span>
                  <span
                    className={`text-[10px] font-mono leading-none px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-white text-slate-500 border border-slate-200/60'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nivel 2: Franja Horaria (Mañana / Tarde / Noche) */}
        <div className="pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5 px-0.5">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-slate-700">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              2. Horario / Franja
            </span>
            {selectedTimeSlot !== 'todos' && (
              <button
                type="button"
                onClick={() => setSelectedTimeSlot('todos')}
                className="text-blue-600 hover:text-blue-800 text-[10px] font-semibold hover:underline"
              >
                Todas las franjas
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5 w-full">
            {TIME_FILTERS.map((item) => {
              const isActive = selectedTimeSlot === item.id;
              const count = timeCounts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedTimeSlot(item.id)}
                  className={`w-full py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-bold ring-1 ring-blue-600'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 w-full">
                    {item.dotClass && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isActive ? 'bg-white' : item.dotClass
                        }`}
                      />
                    )}
                    <span className="text-xs truncate">{item.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono leading-none px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-white text-slate-500 border border-slate-200/60'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Turno Cards List */}
      <div className="space-y-3">
        {filteredShifts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500">
            <Bus className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron turnos con ese criterio</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otro término de búsqueda o categoría.</p>
          </div>
        ) : (
          filteredShifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-blue-300 transition-all group relative"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* Code badge */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight shrink-0 shadow-xs"
                    style={{
                      backgroundColor: `${shift.color}15`,
                      color: shift.color,
                      border: `1.5px solid ${shift.color}35`,
                    }}
                  >
                    {shift.code}
                  </div>

                  {/* Title & Terminal */}
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {shift.title}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[220px] sm:max-w-md">{shift.terminal}</span>
                    </p>
                  </div>
                </div>

                {/* Edit & delete buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditTurno(shift)}
                    title="Editar ficha del turno"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShiftToDelete(shift);
                    }}
                    title={`Eliminar turno ${shift.code} de la base de datos`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Schedules & Duration details */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Horario de servicio
                  </span>
                  <p className="font-semibold text-slate-800">
                    {shift.modality === 'partido' && shift.secondStartTime
                      ? `${shift.startTime}-${shift.endTime} / ${shift.secondStartTime}-${shift.secondEndTime}`
                      : `${shift.startTime} - ${shift.endTime}`}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[11px] text-slate-400">Cómputo jornada</span>
                  <p className="font-semibold text-slate-800 truncate" title={shift.computedDuration}>
                    {shift.computedDuration}
                  </p>
                </div>
              </div>

              {/* Bottom footer with Tag & Tarifa Fija */}
              <div className="mt-3 pt-2.5 flex items-center justify-between gap-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {shift.badges[0] || (shift.category === 'mañana' ? 'Turno Mañana' : shift.category === 'tarde' ? 'Turno Tarde' : shift.category === 'noche' ? 'Turno Noche' : 'Servicio Oficial')}
                  </span>
                  {shift.dayType !== 'laborable' && shift.dayType !== 'todos' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {shift.dayType === 'festivo' ? 'Festivo' : 'Sábado'}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block -mb-0.5">Tarifa fija</span>
                  <span className="text-base sm:text-lg font-extrabold text-emerald-700 font-mono tabular-nums">
                    {formatCurrency(shift.fixedRate || 0)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info notice box matching design */}
      <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
          i
        </div>
        <div>
          <h4 className="font-bold text-slate-900 mb-0.5">Regla de Liquidación Automática</h4>
          <p className="text-slate-600 leading-relaxed">
            Al asignar estos códigos en tu calendario, el importe consolidado se sumará directamente a tu nómina sin necesidad de calcular horas de relevo por separado.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onOpenNewTurnoModal}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Añadir nuevo turno a la Base de Datos</span>
        </button>

        <div className="flex justify-center">
          <button
            onClick={() => setConfirmRestore(true)}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restablecer partes oficiales Direxis Zaragoza</span>
          </button>
        </div>
      </div>

      {/* Modal confirmación para eliminar turno */}
      <ConfirmModal
        isOpen={Boolean(shiftToDelete)}
        title={shiftToDelete ? `¿Eliminar turno ${shiftToDelete.code}?` : '¿Eliminar turno?'}
        message={
          shiftToDelete
            ? `¿Estás seguro de que deseas eliminar el turno "${shiftToDelete.code} - ${shiftToDelete.title}" de la base de datos?\n\nEsta acción eliminará el turno del tarifario y no se podrá deshacer.`
            : ''
        }
        confirmText="Sí, eliminar turno"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (shiftToDelete) {
            onDeleteTurno(shiftToDelete.id);
            setShiftToDelete(null);
          }
        }}
        onCancel={() => setShiftToDelete(null)}
      />

      {/* Modal confirmación para restablecer turnos de fábrica */}
      <ConfirmModal
        isOpen={confirmRestore}
        title="¿Restablecer partes oficiales?"
        message="¿Deseas restablecer todos los turnos predeterminados de DIREXIS Zaragoza según convenio?\n\nLos turnos personalizados que hayas añadido se sustituirán por la lista oficial homologada."
        confirmText="Restablecer base de datos"
        cancelText="Volver"
        isDestructive={false}
        onConfirm={() => {
          onRestoreDefaults();
          setConfirmRestore(false);
        }}
        onCancel={() => setConfirmRestore(false)}
      />
    </div>
  );
};
