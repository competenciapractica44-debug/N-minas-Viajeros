import React, { useState } from 'react';
import { X, User, Building2, Briefcase, Percent, Check } from 'lucide-react';
import { WorkerProfile } from '../types';

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
  const [formData, setFormData] = useState<WorkerProfile>(profile);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile(formData);
    onClose();
  };

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
                Perfil de Conductor y Empresa
              </h2>
              <p className="text-[11px] text-slate-500">Datos para la nómina y reportes oficiales</p>
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
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {/* Worker info */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 uppercase tracking-wider block text-[11px]">
              Datos del Trabajador
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200"
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
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Categoría Profesional (Convenio)
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full py-2 px-3 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          {/* Company Info */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <span className="font-bold text-slate-900 uppercase tracking-wider block text-[11px]">
              Datos de la Empresa
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200"
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
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Labor & Tax settings */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <span className="font-bold text-slate-900 uppercase tracking-wider block text-[11px]">
              Condiciones Laborales y Fiscales
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Tipo de Contrato
                </label>
                <select
                  value={formData.contractType}
                  onChange={(e) => setFormData({ ...formData, contractType: e.target.value as any })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="indefinido">Indefinido (Desempleo 1,55%)</option>
                  <option value="temporal">Temporal (Desempleo 1,60%)</option>
                  <option value="tiempo_parcial">Fijo Discontinuo / Parcial</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Tipo Retención IRPF (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.irpfPercentage}
                  onChange={(e) => setFormData({ ...formData, irpfPercentage: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasConductorPerceptorPlus}
                  onChange={(e) => setFormData({ ...formData, hasConductorPerceptorPlus: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">
                  Aplicar Plus Conductor-Perceptor (Art. 19: 6,27 €/día)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasMonetaryQuebranto}
                  onChange={(e) => setFormData({ ...formData, hasMonetaryQuebranto: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">
                  Cobro de billetes a bordo / Quebranto de moneda (Art. 20: 1,89 €/día)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.prorratearPagasExtra}
                  onChange={(e) => setFormData({ ...formData, prorratearPagasExtra: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-slate-700">
                  Prorratear las 3 Pagas Extraordinarias mensualmente (Art. 11)
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
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
