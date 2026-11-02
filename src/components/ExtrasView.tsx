import React, { useState } from 'react';
import { SlidersHorizontal, Plus, CheckCircle2, Edit2, Trash2, X, Info } from 'lucide-react';
import { ExtraConcept, ExtraUnit } from '../types';
import { formatCurrency } from '../utils/exporter';

interface ExtrasViewProps {
  extras: ExtraConcept[];
  onToggleExtra: (id: string) => void;
  onSaveExtra: (extra: ExtraConcept) => void;
  onDeleteExtra: (id: string) => void;
}

export const ExtrasView: React.FC<ExtrasViewProps> = ({
  extras,
  onToggleExtra,
  onSaveExtra,
  onDeleteExtra,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ExtraConcept | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(30.00);
  const [unit, setUnit] = useState<ExtraUnit>('servicio');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('Fuera de convenio, Importe fijo');
  const [isTaxable, setIsTaxable] = useState(true);

  const activeCount = extras.filter((e) => e.active).length;

  const handleOpenNew = () => {
    setEditingExtra(null);
    setName('');
    setAmount(25.00);
    setUnit('servicio');
    setDescription('');
    setTagInput('Fuera de convenio');
    setIsTaxable(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (extra: ExtraConcept) => {
    setEditingExtra(extra);
    setName(extra.name);
    setAmount(extra.amount);
    setUnit(extra.unit);
    setDescription(extra.description);
    setTagInput(extra.tags.join(', '));
    setIsTaxable(extra.isTaxable);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const updated: ExtraConcept = {
      id: editingExtra ? editingExtra.id : `extra-${Date.now()}`,
      name: name.trim(),
      amount: Number(amount) || 0,
      unit,
      description: description.trim(),
      tags: tags.length > 0 ? tags : ['Fuera de convenio'],
      active: editingExtra ? editingExtra.active : true,
      isTaxable,
    };

    onSaveExtra(updated);
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-4 pb-24 space-y-4">
      {/* Top Header Card matching screenshot 4 */}
      <div className="bg-blue-50/80 rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Extras Fuera de Convenio
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-1">
              Configura pluses voluntarios, acuerdos de empresa, servicios discrecionales o gratificaciones no contempladas en el convenio para asignarlos a tus jornadas.
            </p>
          </div>
        </div>
      </div>

      {/* Active Count & Add Button strip matching screenshot 4 */}
      <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              {activeCount} Extras Activos
            </span>
            <span className="text-[11px] text-slate-500">
              Disponibles en el selector diario
            </span>
          </div>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Añadir</span>
        </button>
      </div>

      {/* Concepts Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
        <span className="font-bold uppercase tracking-wider text-slate-600">
          Conceptos Personalizados
        </span>
        <span className="text-[11px] text-blue-600">Toca para editar</span>
      </div>

      {/* Extra Concept Cards List matching screenshot 4 */}
      <div className="space-y-3">
        {extras.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl p-4 border transition-all relative ${
              item.active
                ? 'border-slate-200 shadow-xs hover:border-blue-300'
                : 'border-slate-200/60 opacity-60 bg-slate-50/50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {item.name}
                </h3>
                <span className="text-[11px] text-slate-500 block">
                  {item.unit === 'servicio' && 'Importe Fijo por ocasión'}
                  {item.unit === 'hora' && 'Precio por hora adicional'}
                  {item.unit === 'dia' && 'Plus por incidente / día'}
                  {item.unit === 'fijo' && 'Plus fijo excepcional'}
                </span>
              </div>

              {/* Amount and unit */}
              <div className="text-right shrink-0">
                <div className="text-base sm:text-lg font-extrabold text-emerald-700 font-mono tabular-nums leading-none">
                  {formatCurrency(item.amount)}
                </div>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                  / {item.unit}
                </span>
              </div>
            </div>

            {/* Description box */}
            {item.description && (
              <div className="mt-2.5 p-2.5 bg-slate-50/80 rounded-xl text-xs text-slate-600 border border-slate-100">
                {item.description}
              </div>
            )}

            {/* Footer with Tags and Switch Toggle matching screenshot 4 */}
            <div className="mt-3 pt-2.5 flex items-center justify-between gap-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                {item.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60"
                  >
                    {tag}
                  </span>
                ))}
                {!item.isTaxable && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                    Dieta Exenta
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded"
                  title="Editar concepto"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteExtra(item.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                  title="Eliminar concepto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Toggle switch matching screenshot 4 */}
                <button
                  type="button"
                  onClick={() => onToggleExtra(item.id)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    item.active ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  title={item.active ? 'Desactivar concepto' : 'Activar concepto'}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                      item.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Button to Create New Concept matching screenshot 4 */}
      <button
        onClick={handleOpenNew}
        className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>+ Crear Concepto Extra</span>
      </button>

      {/* Footer info box matching screenshot 4 */}
      <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Estos complementos se sumarán de forma independiente en tu desglose mensual de nómina bajo la categoría <strong>'Complementos Pactados'</strong>.
        </p>
      </div>

      {/* Create / Edit Extra Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingExtra ? 'Editar Concepto Extra' : 'Nuevo Concepto Fuera de Convenio'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nombre del Concepto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Limpieza profunda o Espera en hotel"
                  className="w-full text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Importe (€) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tipo de Cómputo
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as ExtraUnit)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="servicio">Por servicio / ocasión</option>
                    <option value="hora">Por hora adicional</option>
                    <option value="dia">Por día / incidente</option>
                    <option value="fijo">Importe fijo mensual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Descripción o Criterio de Aplicación
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="ej. Para viajes discrecionales o fines de semana si no hay personal de cochera."
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Etiquetas (separadas por comas)
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Fuera de convenio, Facturable, Plus meteorológico"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isTaxable}
                  onChange={(e) => setIsTaxable(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">
                  Concepto sujeto a retención de IRPF y cotización Seguridad Social
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Guardar Concepto
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
