import React, { useState } from 'react';
import { X, User, Building2, Briefcase, Percent, Check, HelpCircle, Clock, CalendarDays } from 'lucide-react';
import { WorkerProfile, ExtraPayProrrateo } from '../types';

interface WorkerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: WorkerProfile;
  onSaveProfile: (profile: WorkerProfile) => void;
}

export const WorkerProfileModal: React.FC<WorkerProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}) => {
  const [formData, setFormData] = useState<WorkerProfile>(() => ({
    ...profile,
    prorrateoPagasExtra: profile.prorrateoPagasExtra || (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna'),
    partTimePercentage: profile.partTimePercentage !== undefined ? profile.partTimePercentage : 50,
  }));

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile({
      ...formData,
      prorratearPagasExtra: formData.prorrateoPagasExtra === 'tres_pagas',
    });
    onClose();
  };

  const isPartTime = formData.contractType === 'tiempo_parcial';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Perfil del Conductor y Empresa
              </h2>
              <p className="text-[11px] text-slate-500">Configuración laboral, jornada y régimen de pagas extras</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs">
          {/* Worker info */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Datos del Trabajador
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  NIF / NIE *
                </label>
                <input
                  type="text"
                  value={formData.nif}
                  onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Categoría Profesional (Convenio Zaragoza)
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Company Info */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Datos de la Empresa
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  CIF de la Empresa
                </label>
                <input
                  type="text"
                  value={formData.cif}
                  onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Labor & Tax settings */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Condiciones Laborales y Fiscales
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Tipo de Contrato
                </label>
                <select
                  value={formData.contractType}
                  onChange={(e) => setFormData({ ...formData, contractType: e.target.value as any })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="indefinido">Indefinido (Jornada Completa 100%)</option>
                  <option value="temporal">Temporal (Jornada Completa 100%)</option>
                  <option value="tiempo_parcial">Contrato a Tiempo Parcial / Jornada Reducida</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Retención IRPF Conductor (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="2"
                    max="45"
                    value={formData.irpfPercentage}
                    onChange={(e) => setFormData({ ...formData, irpfPercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full py-2 pl-3 pr-8 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-slate-400 text-xs">%</span>
                </div>
              </div>
            </div>

            {/* Part-time percentage control */}
            {isPartTime && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Porcentaje de la Jornada Laboral</span>
                  </div>
                  <span className="font-mono font-bold text-sm bg-white text-amber-700 px-2.5 py-0.5 rounded-lg border border-amber-200 shadow-2xs">
                    {formData.partTimePercentage || 50}%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-amber-700/70 font-mono">10%</span>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    step={5}
                    value={formData.partTimePercentage || 50}
                    onChange={(e) =>
                      setFormData({ ...formData, partTimePercentage: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <span className="text-[10px] text-amber-700/70 font-mono">95%</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[25, 33, 50, 67, 75, 80].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setFormData({ ...formData, partTimePercentage: pct })}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        formData.partTimePercentage === pct
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-100/60'
                      }`}
                    >
                      {pct}% {pct === 50 ? '(Media)' : ''}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-amber-800 leading-relaxed">
                  El salario base y las pagas extraordinarias se calcularán de forma proporcional al{' '}
                  <strong className="font-semibold">{formData.partTimePercentage || 50}%</strong> de la jornada de convenio.
                </p>
              </div>
            )}

            {/* Extra Pay Prorrateo selector */}
            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                Régimen de Cobro de Pagas Extraordinarias (Art. 11 Convenio)
              </label>

              <div className="space-y-2">
                {/* Option 1: 3 pagas prorrateadas */}
                <label
                  onClick={() => setFormData({ ...formData, prorrateoPagasExtra: 'tres_pagas' })}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    formData.prorrateoPagasExtra === 'tres_pagas'
                      ? 'border-blue-600 bg-blue-50/60 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="prorrateoPagasExtra"
                    checked={formData.prorrateoPagasExtra === 'tres_pagas'}
                    onChange={() => setFormData({ ...formData, prorrateoPagasExtra: 'tres_pagas' })}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs">
                      Prorratear las 3 pagas extras mensualmente
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Se abona en cada nómina mensual 7,5 días de salario base (equivalente a 90 días anuales repartidos en 12 meses).
                    </p>
                  </div>
                </label>

                {/* Option 2: 1 paga prorrateada (Marzo) + Julio y Diciembre íntegras */}
                <label
                  onClick={() => setFormData({ ...formData, prorrateoPagasExtra: 'una_paga' })}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    formData.prorrateoPagasExtra === 'una_paga'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="prorrateoPagasExtra"
                    checked={formData.prorrateoPagasExtra === 'una_paga'}
                    onChange={() => setFormData({ ...formData, prorrateoPagasExtra: 'una_paga' })}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>Prorratear sólo 1 paga y 2 íntegras</span>
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                        Julio y Diciembre
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Se prorratea únicamente la paga de Marzo (2,5 días de salario base/mes), y las pagas de Verano (Julio) y Navidad (Diciembre) se abonan completas en su mes (30 días cada una).
                    </p>
                  </div>
                </label>

                {/* Option 3: Sin prorrateo */}
                <label
                  onClick={() => setFormData({ ...formData, prorrateoPagasExtra: 'ninguna' })}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    formData.prorrateoPagasExtra === 'ninguna'
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="prorrateoPagasExtra"
                    checked={formData.prorrateoPagasExtra === 'ninguna'}
                    onChange={() => setFormData({ ...formData, prorrateoPagasExtra: 'ninguna' })}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs">
                      Sin prorrateo mensual (Cobro íntegro en fecha)
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Las 3 pagas completas se cobran en su totalidad únicamente en Marzo, Julio y Diciembre (30 días de salario base cada una).
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Agreement pluses */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.hasConductorPerceptorPlus}
                  onChange={(e) => setFormData({ ...formData, hasConductorPerceptorPlus: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span className="text-slate-700">
                  Aplicar Plus Conductor-Perceptor (Art. 19: 6,27 €/día trabajado)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.hasMonetaryQuebranto}
                  onChange={(e) => setFormData({ ...formData, hasMonetaryQuebranto: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span className="text-slate-700">
                  Cobro de billetes a bordo / Quebranto de moneda (Art. 20: 1,89 €/día)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
