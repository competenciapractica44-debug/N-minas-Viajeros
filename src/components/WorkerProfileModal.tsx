import React, { useState, useEffect, useMemo } from 'react';
import { X, User, Building2, Briefcase, Check, Clock, CalendarDays, CalendarRange, MapPin } from 'lucide-react';
import { WorkerProfile, ConvenioYearRate } from '../types';
import { DEFAULT_CONVENIO_ZARAGOZA } from '../data/convenioZaragoza';
import {
  SPANISH_AUTONOMOUS_COMMUNITIES,
  getOfficialHolidaysForYear,
  resolveRegionId,
} from '../data/spanishHolidays';
import { formatCurrency } from '../utils/exporter';

interface WorkerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: WorkerProfile;
  onSaveProfile: (profile: WorkerProfile) => void;
  yearRate?: ConvenioYearRate;
  isOnboarding?: boolean;
  isDriveConnected?: boolean;
}

export const WorkerProfileModal: React.FC<WorkerProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  yearRate,
  isOnboarding = false,
  isDriveConnected = false,
}) => {
  const effectiveRate = yearRate || DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026];
  const [formData, setFormData] = useState<WorkerProfile>(() => ({
    ...profile,
    autonomousCommunity: profile.autonomousCommunity || 'aragon',
    locality: profile.locality || '',
    prorrateoPagasExtra: profile.prorrateoPagasExtra || (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna'),
    partTimePercentage: profile.partTimePercentage !== undefined ? profile.partTimePercentage : 50,
    extrasCutoffMode: profile.extrasCutoffMode || 'direxis_25_24',
    customCutoffStartDay: profile.customCutoffStartDay || 25,
    hasVacationPlus: profile.hasVacationPlus !== undefined ? profile.hasVacationPlus : true,
    hasPunctualityEarlyStartPlus: profile.hasPunctualityEarlyStartPlus === true,
  }));

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      setFormData({
        ...profile,
        autonomousCommunity: profile.autonomousCommunity || 'aragon',
        locality: profile.locality || '',
        prorrateoPagasExtra: profile.prorrateoPagasExtra || (profile.prorratearPagasExtra !== false ? 'tres_pagas' : 'ninguna'),
        partTimePercentage: profile.partTimePercentage !== undefined ? profile.partTimePercentage : 50,
        extrasCutoffMode: profile.extrasCutoffMode || 'direxis_25_24',
        customCutoffStartDay: profile.customCutoffStartDay || 25,
        hasVacationPlus: profile.hasVacationPlus !== undefined ? profile.hasVacationPlus : true,
        hasPunctualityEarlyStartPlus: profile.hasPunctualityEarlyStartPlus === true,
      });
    }
  }, [isOpen, profile]);

  const activeRegionId = resolveRegionId(formData.autonomousCommunity, formData.locality) || 'aragon';
  const activeRegionObj = useMemo(
    () => SPANISH_AUTONOMOUS_COMMUNITIES.find((c) => c.id === activeRegionId) || SPANISH_AUTONOMOUS_COMMUNITIES[0],
    [activeRegionId]
  );

  const previewHolidays = useMemo(() => {
    const targetYear = effectiveRate.year || 2026;
    const map = getOfficialHolidaysForYear(targetYear, activeRegionId, formData.locality);
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [effectiveRate.year, activeRegionId, formData.locality]);

  const regionalAndLocalPreview = useMemo(
    () => previewHolidays.filter((h) => h.scope === 'regional' || h.scope === 'local'),
    [previewHolidays]
  );

  if (!isOpen) return null;

  const handleSave = () => {
    if (isOnboarding && !formData.name.trim()) {
      setValidationError('Por favor, introduce tu nombre completo para guardar tu perfil y sincronizarlo.');
      return;
    }
    setValidationError(null);
    onSaveProfile({
      ...formData,
      name: formData.name.trim(),
      nif: formData.nif.trim(),
      category: formData.category.trim(),
      companyName: formData.companyName.trim(),
      cif: formData.cif.trim(),
      autonomousCommunity: formData.autonomousCommunity || activeRegionId,
      locality: (formData.locality || '').trim(),
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
          {isOnboarding && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
              <p className="font-bold text-xs">
                {isDriveConnected
                  ? 'Configuración inicial de tu cuenta en Google Drive'
                  : 'Configura tus datos laborales iniciales'}
              </p>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                {isDriveConnected
                  ? 'No se han encontrado tus datos personales en Google Drive. Introduce tu perfil, empresa, localidad, jornada e IRPF para guardarlos en tu carpeta Direxis / Nóminas.'
                  : 'La aplicación inicia con el tarifario de turnos y el convenio base. Introduce tus particularidades laborales para personalizar tus nóminas.'}
              </p>
            </div>
          )}

          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
              {validationError}
            </div>
          )}

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
                  onChange={(e) => {
                    if (validationError) setValidationError(null);
                    setFormData({ ...formData, name: e.target.value });
                  }}
                  placeholder="Ej: Apellidos, Nombre"
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
                  placeholder="Ej: 12345678X"
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
                placeholder="Ej: Conductor/a Perceptor/a"
                className="w-full py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Localidad y Comunidad Autónoma para detectar festivos locales y regionales */}
            <div className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  <span className="font-bold text-slate-900 text-xs">
                    Localidad de Trabajo y Festivos Oficiales
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  Calendario
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Comunidad Autónoma (Regionales)
                  </label>
                  <select
                    value={activeRegionId}
                    onChange={(e) => {
                      const nextReg = e.target.value;
                      setFormData({
                        ...formData,
                        autonomousCommunity: nextReg,
                      });
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SPANISH_AUTONOMOUS_COMMUNITIES.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Localidad / Municipio (Locales) *
                  </label>
                  <input
                    type="text"
                    list="rutanomina-localities-list"
                    value={formData.locality || ''}
                    onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                    placeholder="Ej: Zaragoza, Utebo, Calatayud..."
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="rutanomina-localities-list">
                    {activeRegionObj.localities.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Sugerencias rápidas de municipios de la comunidad seleccionada */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 mr-0.5">Frecuentes:</span>
                {activeRegionObj.localities.slice(0, 6).map((loc) => {
                  const isSel = (formData.locality || '').trim().toLowerCase() === loc.toLowerCase();
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setFormData({ ...formData, locality: loc })}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        isSel
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50 hover:border-orange-300'
                      }`}
                    >
                      {loc}
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-600 bg-white rounded-xl p-2.5 border border-slate-200/80 space-y-1">
                <p className="font-semibold text-slate-800">
                  Festivos identificados ({effectiveRate.year || 2026}):{' '}
                  <span className="text-rose-700">Nacionales</span> ·{' '}
                  <span className="text-purple-700">Regionales ({activeRegionObj.name})</span>
                  {formData.locality?.trim() ? (
                    <>
                      {' '}
                      · <span className="text-orange-700">Locales ({formData.locality.trim()})</span>
                    </>
                  ) : null}
                </p>
                {regionalAndLocalPreview.length > 0 && (
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {regionalAndLocalPreview
                      .map((h) => `${h.date.slice(8, 10)}/${h.date.slice(5, 7)} ${h.name}`)
                      .join(' · ')}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  Se destacarán en color distinto en el calendario. El Plus Festivo ({formatCurrency(effectiveRate.plusFestivoMayor4h ?? 40.80)}) se sigue activando manualmente día a día.
                </p>
              </div>
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
                  placeholder="Nombre o razón social de la empresa"
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
                  placeholder="Ej: A12345678"
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
                    min="0"
                    max="45"
                    value={formData.irpfPercentage}
                    onChange={(e) => setFormData({ ...formData, irpfPercentage: Math.max(0, parseFloat(e.target.value) || 0) })}
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
                  <span className="block mt-1 font-semibold text-amber-950">
                    Jornada anual a cumplir (Art. 14):{' '}
                    {parseFloat((((effectiveRate.horasJornadaAnual || 1776) * (formData.partTimePercentage || 50)) / 100).toFixed(2)).toLocaleString('es-ES')} h/año
                    {' '}({parseFloat(((((effectiveRate.horasJornadaAnual || 1776) * (formData.partTimePercentage || 50)) / 100) / 12).toFixed(2)).toLocaleString('es-ES')} h/mes equivalente).
                  </span>
                </p>
              </div>
            )}

            {!isPartTime && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 flex items-center justify-between gap-2">
                <span>
                  <strong>Jornada Completa (100% · Art. 14 Convenio):</strong> deber anual de{' '}
                  <strong>{(effectiveRate.horasJornadaAnual || 1776).toLocaleString('es-ES')} h/año</strong>
                </span>
                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-blue-200 shrink-0">
                  {parseFloat(((effectiveRate.horasJornadaAnual || 1776) / 12).toFixed(2)).toLocaleString('es-ES')} h/mes
                </span>
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

            {/* Extras Cutoff Mode (Ciclo de Cierre de Variables / Direxis Zaragoza) */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
                Ciclo de Corte para Extras y Variables Fuera de Salario Base
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                El salario base se computa siempre por los días naturales del mes. Los conceptos variables y horas extras pueden liquidarse según el día de corte de la empresa para que la nómina se abone puntual.
              </p>

              <div className="space-y-2 pt-1">
                {/* Opción 1: Direxis Zaragoza (25 mes anterior al 24 actual) */}
                <label
                  onClick={() => setFormData({ ...formData, extrasCutoffMode: 'direxis_25_24' })}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    formData.extrasCutoffMode === 'direxis_25_24'
                      ? 'border-blue-600 bg-blue-50/60 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="extrasCutoffMode"
                    checked={formData.extrasCutoffMode === 'direxis_25_24'}
                    onChange={() => setFormData({ ...formData, extrasCutoffMode: 'direxis_25_24' })}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>Ciclo Oficial Direxis Zaragoza (del 25 al 24)</span>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                        Predeterminado
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Los extras se cuentan desde el <strong>día 25 del mes anterior</strong> hasta el <strong>día 24 del mes en curso</strong>. Los extras generados a partir del día 25 pasan a la nómina del mes siguiente.
                    </p>
                  </div>
                </label>

                {/* Opción 2: Mes natural completo (1 al 31) */}
                <label
                  onClick={() => setFormData({ ...formData, extrasCutoffMode: 'mes_natural' })}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    formData.extrasCutoffMode === 'mes_natural'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="extrasCutoffMode"
                    checked={formData.extrasCutoffMode === 'mes_natural'}
                    onChange={() => setFormData({ ...formData, extrasCutoffMode: 'mes_natural' })}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs">
                      Mes Natural Completo (del día 1 al último día del mes)
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Todos los extras devengados entre el día 1 y el día 30/31 del mes en curso se liquidan en la misma nómina mensual.
                    </p>
                  </div>
                </label>

                {/* Opción 3: Personalizado */}
                <label
                  onClick={() => setFormData({ ...formData, extrasCutoffMode: 'personalizado' })}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    formData.extrasCutoffMode === 'personalizado'
                      ? 'border-purple-600 bg-purple-50/60 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="extrasCutoffMode"
                    checked={formData.extrasCutoffMode === 'personalizado'}
                    onChange={() => setFormData({ ...formData, extrasCutoffMode: 'personalizado' })}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="space-y-2 w-full">
                    <p className="font-bold text-slate-900 text-xs">
                      Día de corte personalizado
                    </p>
                    {formData.extrasCutoffMode === 'personalizado' && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-600">Desde el día</span>
                        <input
                          type="number"
                          min={1}
                          max={28}
                          value={formData.customCutoffStartDay || 25}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customCutoffStartDay: Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 25)),
                            })
                          }
                          className="w-16 py-1 px-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center bg-white"
                        />
                        <span className="text-[11px] text-slate-600">
                          {(formData.customCutoffStartDay || 25) === 1 ? (
                            <>al último día del mes en curso (Mes natural completo).</>
                          ) : (
                            <>
                              del mes anterior al{' '}
                              <strong>{(formData.customCutoffStartDay || 25) - 1}</strong> del mes en curso (incluidos).
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Agreement pluses */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                Pluses e Incentivos de Convenio
              </span>

              {/* Opción Plus de Vacaciones (Art. 9 Convenio: 10€/día al 100%, proporcional al % de jornada) */}
              <div className="p-3 bg-cyan-50/70 rounded-2xl border border-cyan-200/80 space-y-1.5 transition-all">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasVacationPlus !== false}
                    onChange={(e) => setFormData({ ...formData, hasVacationPlus: e.target.checked })}
                    className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4 shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs">
                        Activar automáticamente el Plus de Vacaciones ({formatCurrency(effectiveRate.plusVacacionesDia ?? 10.00)}/día bruto al 100%)
                      </span>
                      <span className="text-[10px] font-bold bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded">
                        Art. 9 · Proporcional a la jornada
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      Aplica automáticamente el incentivo del Art. 9 del Convenio ({formatCurrency(effectiveRate.plusVacacionesDia ?? 10.00)}/día bruto al 100%, o parte proporcional según tu % de jornada) en todos los días marcados como 'V' en el calendario.
                    </p>
                    {isPartTime && (formData.partTimePercentage || 50) < 100 && (
                      <div className="flex items-center gap-1.5 text-[10px] text-cyan-900 bg-cyan-100/80 p-1.5 rounded-lg font-medium mt-1">
                        <span>ℹ️</span>
                        <span>
                          Con tu jornada actual al <strong>{formData.partTimePercentage || 50}%</strong>, percibirás{' '}
                          <strong>
                            {formatCurrency(
                              parseFloat(
                                (((effectiveRate.plusVacacionesDia ?? 10.00) * (formData.partTimePercentage || 50)) / 100).toFixed(2)
                              )
                            )}/día bruto
                          </strong>{' '}
                          en cada día de vacaciones ('V').
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.hasConductorPerceptorPlus}
                  onChange={(e) => setFormData({ ...formData, hasConductorPerceptorPlus: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span className="text-slate-700">
                  Aplicar Plus Conductor-Perceptor (Art. 19: {formatCurrency(effectiveRate.plusConductorPerceptorDia ?? 6.27)}/día bruto trabajado)
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
                  Cobro de billetes a bordo / Quebranto de moneda (Art. 20: {formatCurrency(effectiveRate.quebrantoMonedaDia ?? 1.89)}/día bruto)
                </span>
              </label>

              {/* Opción Plus de Puntualidad e Inicio Temprano (habilita selector por días en el calendario) */}
              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-1 transition-all">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasPunctualityEarlyStartPlus === true}
                    onChange={(e) =>
                      setFormData({ ...formData, hasPunctualityEarlyStartPlus: e.target.checked })
                    }
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs">
                        Habilitar Plus de Puntualidad e Inicio Temprano ({formatCurrency(effectiveRate.plusPuntualidadDia ?? 12.00)}/día)
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                        Opcional · Por días
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Recogido en convenio pero desactivado por defecto. Si lo marcas, aparecerá un botón en cada día del calendario para aplicarlo únicamente en las jornadas necesarias.
                    </p>
                  </div>
                </label>
              </div>
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
            {isDriveConnected ? 'Guardar y sincronizar en Drive' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
};
