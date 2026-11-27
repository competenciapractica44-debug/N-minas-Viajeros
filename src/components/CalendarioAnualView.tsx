import React, { useMemo, useState } from 'react';
import {
  RotateCcw,
  CalendarX2,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Sliders,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  AnnualEditableParams,
  AnnualExtrasPayMode,
  AnnualMonthEditableFields,
  AnnualYearOverrideData,
  BolsaRepartoMode,
  ConvenioInfo,
  DayAssignment,
  ShiftDefinition,
  SickLeaveContingencyType,
  ValidatedMonthsMap,
  WorkerProfile,
} from '../types';
import {
  calculateAnnualLiquidation,
  deriveDefaultAnnualMonths,
  deriveDefaultAnnualParams,
  estimateWorkingDaysFromNatural,
  exportAnnualCalendarToExcel,
  formatEuro,
  formatHoras,
  getVoluntary8hBlockOptions,
  mapAnnualExtrasModeToProfile,
  resolveAnnualMonths,
  resolveAnnualParams,
} from '../utils/annualCalendar';

interface CalendarioAnualViewProps {
  selectedYear: number;
  onChangeYear: (year: number) => void;
  profile: WorkerProfile;
  convenio: ConvenioInfo;
  assignments: DayAssignment[];
  shifts: ShiftDefinition[];
  yearOverride?: AnnualYearOverrideData;
  onUpdateYearOverride: (year: number, nextOverride: AnnualYearOverrideData | null) => void;
  onSyncCommonToProfile: (partial: Partial<WorkerProfile>) => void;
  validatedMonths?: ValidatedMonthsMap;
  hasUnsavedChanges?: boolean;
  isUpdatingDrive?: boolean;
  onActualizarDrive?: () => void;
  onSelectMonthForNomina?: (year: number, month: number) => void;
}

export const CalendarioAnualView: React.FC<CalendarioAnualViewProps> = ({
  selectedYear,
  onChangeYear,
  profile,
  convenio,
  assignments,
  shifts,
  yearOverride,
  onUpdateYearOverride,
  onSyncCommonToProfile,
  validatedMonths,
  hasUnsavedChanges,
  isUpdatingDrive,
  onActualizarDrive,
  onSelectMonthForNomina,
}) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [cuotaDrafts, setCuotaDrafts] = useState<Record<number, string>>({});

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Valores automáticos procedentes de RutaNómina (Perfil + Convenio + Turnos Día)
  const defaultParams = useMemo(
    () => deriveDefaultAnnualParams(profile, convenio, selectedYear),
    [profile, convenio, selectedYear]
  );

  const defaultMonths = useMemo(
    () => deriveDefaultAnnualMonths(selectedYear, profile, assignments, shifts, convenio, validatedMonths),
    [selectedYear, profile, assignments, shifts, convenio, validatedMonths]
  );

  const effectiveParams = useMemo(
    () => resolveAnnualParams(defaultParams, yearOverride),
    [defaultParams, yearOverride]
  );

  const effectiveMonths = useMemo(
    () => resolveAnnualMonths(defaultMonths, yearOverride),
    [defaultMonths, yearOverride]
  );

  const liquidation = useMemo(
    () => calculateAnnualLiquidation(selectedYear, effectiveParams, effectiveMonths, validatedMonths),
    [selectedYear, effectiveParams, effectiveMonths, validatedMonths]
  );

  const hasParamOverrides = Boolean(
    yearOverride?.paramOverrides && Object.keys(yearOverride.paramOverrides).length > 0
  );
  const hasMonthOverrides = Boolean(
    yearOverride?.monthOverrides && Object.keys(yearOverride.monthOverrides).length > 0
  );
  const hasAnyOverrides = hasParamOverrides || hasMonthOverrides;

  const commonDiffersFromProfile = useMemo(() => {
    return (
      effectiveParams.jornadaPct !== defaultParams.jornadaPct ||
      effectiveParams.modoExtras !== defaultParams.modoExtras ||
      effectiveParams.plusVacDia100 !== defaultParams.plusVacDia100
    );
  }, [effectiveParams, defaultParams]);

  const handleParamChange = <K extends keyof AnnualEditableParams>(
    field: K,
    value: AnnualEditableParams[K]
  ) => {
    const nextParamOverrides = {
      ...(yearOverride?.paramOverrides || {}),
      [field]: value,
    };
    if (nextParamOverrides[field] === defaultParams[field]) {
      delete nextParamOverrides[field];
    }
    onUpdateYearOverride(selectedYear, {
      paramOverrides:
        Object.keys(nextParamOverrides).length > 0 ? nextParamOverrides : undefined,
      monthOverrides: yearOverride?.monthOverrides,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMonthFieldsChange = (
    monthIdx: number,
    updates: Partial<AnnualMonthEditableFields>
  ) => {
    const prevMonthMap = yearOverride?.monthOverrides || {};
    const prevMonthFields = prevMonthMap[monthIdx] || {};
    const nextMonthFields: Partial<AnnualMonthEditableFields> = {
      ...prevMonthFields,
    };

    for (const [k, v] of Object.entries(updates)) {
      const key = k as keyof AnnualMonthEditableFields;
      if (v === undefined) {
        delete nextMonthFields[key];
      } else {
        (nextMonthFields as Record<string, unknown>)[key] = v;
      }
    }

    const nextMonthOverrides = {
      ...prevMonthMap,
    };
    if (Object.keys(nextMonthFields).length > 0) {
      nextMonthOverrides[monthIdx] = nextMonthFields;
    } else {
      delete nextMonthOverrides[monthIdx];
    }

    onUpdateYearOverride(selectedYear, {
      paramOverrides: yearOverride?.paramOverrides,
      monthOverrides:
        Object.keys(nextMonthOverrides).length > 0 ? nextMonthOverrides : undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMonthFieldChange = <K extends keyof AnnualMonthEditableFields>(
    monthIdx: number,
    field: K,
    value: AnnualMonthEditableFields[K]
  ) => {
    handleMonthFieldsChange(monthIdx, { [field]: value });
  };

  const handleResetToRutaNomina = () => {
    setCuotaDrafts({});
    onUpdateYearOverride(selectedYear, null);
    showToast(`Valores de ${selectedYear} sincronizados de nuevo con RutaNómina y Convenio.`);
  };

  const handleResetCuotasManuales = () => {
    setCuotaDrafts({});
    const prevMonths = yearOverride?.monthOverrides || {};
    const nextMonths: Record<number, Partial<AnnualMonthEditableFields>> = {};
    for (const [key, fields] of Object.entries(prevMonths)) {
      const idx = Number(key);
      const copy = { ...fields };
      delete copy.cuotaFijaManual;
      if (Object.keys(copy).length > 0) {
        nextMonths[idx] = copy;
      }
    }
    onUpdateYearOverride(selectedYear, {
      paramOverrides: yearOverride?.paramOverrides,
      monthOverrides: Object.keys(nextMonths).length > 0 ? nextMonths : undefined,
      updatedAt: new Date().toISOString(),
    });
    showToast('Cuotas fijas mensuales restablecidas al cálculo automático.');
  };

  const handleVacacionesACero = () => {
    const prevMonths = yearOverride?.monthOverrides || {};
    const nextMonths: Record<number, Partial<AnnualMonthEditableFields>> = { ...prevMonths };
    for (let i = 0; i < 12; i++) {
      const copy = {
        ...(nextMonths[i] || {}),
        vacNat: 0,
      };
      delete copy.vacLab;
      nextMonths[i] = copy;
    }
    onUpdateYearOverride(selectedYear, {
      paramOverrides: yearOverride?.paramOverrides,
      monthOverrides: nextMonths,
      updatedAt: new Date().toISOString(),
    });
    showToast('Vacaciones mensuales puestas a 0 para simulación.');
  };

  const handleImportDailyVacAndSick = () => {
    const prevMonths = yearOverride?.monthOverrides || {};
    const nextMonths: Record<number, Partial<AnnualMonthEditableFields>> = {};
    for (const [key, fields] of Object.entries(prevMonths)) {
      const idx = Number(key);
      const copy = { ...fields };
      delete copy.vacNat;
      delete copy.vacLab;
      delete copy.bajaNat;
      delete copy.bajaLab;
      delete copy.bajaEsContinuacion;
      delete copy.horasReales;
      if (Object.keys(copy).length > 0) {
        nextMonths[idx] = copy;
      }
    }
    onUpdateYearOverride(selectedYear, {
      paramOverrides: yearOverride?.paramOverrides,
      monthOverrides: Object.keys(nextMonths).length > 0 ? nextMonths : undefined,
      updatedAt: new Date().toISOString(),
    });
    showToast(`Horas reales, vacaciones y bajas importadas desde Turnos Día de ${selectedYear}.`);
  };

  const handlePushCommonToProfile = () => {
    const pct = Math.min(100, Math.max(1, Math.round(effectiveParams.jornadaPct)));
    const nextProrrateo = mapAnnualExtrasModeToProfile(effectiveParams.modoExtras);
    onSyncCommonToProfile({
      contractType: pct < 100 ? 'tiempo_parcial' : 'indefinido',
      partTimePercentage: pct,
      prorrateoPagasExtra: nextProrrateo,
      prorratearPagasExtra: nextProrrateo === 'tres_pagas',
      hasVacationPlus: effectiveParams.plusVacDia100 > 0,
    });
    showToast('Jornada, pagas extras y plus de vacaciones guardados en tu Perfil y Google Drive.');
  };

  const handleVoluntaryConsentChange = (enabled: boolean, hours: number) => {
    const cleanHours = enabled ? Math.round(Math.max(0, hours) * 100) / 100 : 0;
    const isActive = enabled && cleanHours > 0;
    onSyncCommonToProfile({
      voluntaryHours15Enabled: isActive,
      voluntaryHours15Hours: cleanHours,
    });
    if (
      yearOverride?.paramOverrides &&
      ('voluntarias15Activas' in yearOverride.paramOverrides ||
        'voluntarias15Horas' in yearOverride.paramOverrides)
    ) {
      const nextOverrides = { ...yearOverride.paramOverrides };
      delete nextOverrides.voluntarias15Activas;
      delete nextOverrides.voluntarias15Horas;
      onUpdateYearOverride(selectedYear, {
        paramOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
        monthOverrides: yearOverride.monthOverrides,
        updatedAt: new Date().toISOString(),
      });
    }
    showToast(
      isActive
        ? `Consentimiento activado: ${formatHoras(cleanHours)} voluntarias (máx. 15%).`
        : 'Horas voluntarias del 15% desactivadas.'
    );
  };

  const handleDescargarExcel = () => {
    try {
      const fileName = exportAnnualCalendarToExcel(liquidation, profile);
      showToast(`Archivo ${fileName} generado con éxito.`);
    } catch (err) {
      console.error('Error exportando Excel anual:', err);
      showToast('Ocurrió un error al generar el archivo Excel.');
    }
  };

  const { p } = liquidation;
  const difVac = p.vacReglamentarias - liquidation.totalVacNat;
  const vacMatches = difVac === 0;
  const vacPending = difVac > 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 pb-28 space-y-5">
      {/* Panel de Configuración del Convenio y Calendario Anual */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center space-x-2 text-[11px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                <span>Convenio Transporte Viajeros</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">Parametrización {selectedYear}</span>
              </span>

              {hasAnyOverrides ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <Sliders className="w-3 h-3" />
                  <span>Con ediciones manuales (guardado en Drive)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Auto-sincronizado con RutaNómina</span>
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Configuración Anual y Bolsa de Horas
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Compara las <strong>horas teóricas de cuadre anual (0,00 h)</strong> con las <strong>horas reales sumadas de Turnos Día (mes natural)</strong> para comprobar y compensar desvíos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasAnyOverrides && (
              <button
                type="button"
                onClick={handleResetToRutaNomina}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer"
                title="Descartar ediciones manuales y recargar datos desde tu Perfil, Convenio y Turnos Día"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sincronizar con RutaNómina</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleImportDailyVacAndSick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition cursor-pointer"
              title="Recargar horas reales, vacaciones (V) y bajas (B) desde tu cuadrante diario"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Traer Datos del Diario</span>
            </button>

            <button
              type="button"
              onClick={handleVacacionesACero}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer"
            >
              <CalendarX2 className="w-3.5 h-3.5" />
              <span>Vacaciones a 0</span>
            </button>

            {onActualizarDrive && (
              <button
                type="button"
                onClick={onActualizarDrive}
                disabled={isUpdatingDrive}
                title="Recalcular todos los meses y guardar en Google Drive"
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border shadow-xs transition ${
                  isUpdatingDrive
                    ? 'bg-amber-500 text-white border-amber-600 cursor-wait'
                    : hasUnsavedChanges
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300/70 cursor-pointer'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 cursor-pointer'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingDrive ? 'animate-spin' : ''}`} />
                <span>{isUpdatingDrive ? 'Actualizando...' : hasUnsavedChanges ? 'Actualizar Drive' : 'Actualizar'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDescargarExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {commonDiffersFromProfile && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-950">
            <span>
              Has editado parámetros comunes (<strong>% Jornada</strong>, <strong>Pagas Extras</strong> o{' '}
              <strong>Plus Vacaciones</strong>) respecto a tu perfil actual de RutaNómina.
            </span>
            <button
              type="button"
              onClick={handlePushCommonToProfile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shrink-0 self-start sm:self-auto transition cursor-pointer"
            >
              <span>Aplicar a mi Perfil y Drive</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Fila principal de parámetros */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-5">
          <div>
            <label
              htmlFor="paramAnio"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1"
            >
              Año Ejercicio
            </label>
            <input
              type="number"
              id="paramAnio"
              value={selectedYear}
              min={2026}
              max={2040}
              step={1}
              onChange={(e) => {
                const yr = parseInt(e.target.value, 10);
                if (!Number.isNaN(yr) && yr >= 2026 && yr <= 2040) {
                  onChangeYear(yr);
                }
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="paramHorasAnuales"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1"
            >
              Horas 100% Año
            </label>
            <input
              type="number"
              id="paramHorasAnuales"
              value={effectiveParams.horasAnuales100}
              min={500}
              max={2500}
              step={1}
              onChange={(e) =>
                handleParamChange('horasAnuales100', Math.max(1, parseFloat(e.target.value) || 0))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="paramJornadaPct"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-blue-700 mb-1"
            >
              % Jornada
            </label>
            <input
              type="number"
              id="paramJornadaPct"
              value={effectiveParams.jornadaPct}
              min={1}
              max={100}
              step={1}
              onChange={(e) =>
                handleParamChange(
                  'jornadaPct',
                  Math.min(100, Math.max(1, parseFloat(e.target.value) || 100))
                )
              }
              className="w-full rounded-xl border border-blue-300 bg-blue-50/50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-extrabold text-blue-950"
            />
            <div className="text-[11px] font-semibold text-blue-700 mt-1">
              Efectiva: {formatHoras(liquidation.jornadaAnualEfectiva)}/año
            </div>
          </div>

          <div>
            <label
              htmlFor="paramVacReg"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1"
            >
              Días Vac. Convenio
            </label>
            <input
              type="number"
              id="paramVacReg"
              value={effectiveParams.vacReglamentarias}
              min={0}
              max={60}
              step={1}
              onChange={(e) =>
                handleParamChange(
                  'vacReglamentarias',
                  Math.max(0, parseInt(e.target.value, 10) || 0)
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="paramBaseMes"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1"
            >
              Base 100% (€/Mes)
            </label>
            <input
              type="number"
              id="paramBaseMes"
              value={effectiveParams.baseMes100}
              min={0}
              max={20000}
              step={0.01}
              onChange={(e) =>
                handleParamChange('baseMes100', Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            />
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Aplicado: {formatEuro(liquidation.baseMensualEfectiva)}/mes
            </div>
          </div>

          <div>
            <label
              htmlFor="paramCompMes"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1"
            >
              Comp. 100% (€)
            </label>
            <input
              type="number"
              id="paramCompMes"
              value={effectiveParams.compMes100}
              min={0}
              max={10000}
              step={0.01}
              onChange={(e) =>
                handleParamChange('compMes100', Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            />
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Aplicado: {formatEuro(liquidation.compMensualEfectiva)}/mes
            </div>
          </div>
        </div>

        {/* Segunda fila de parámetros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div>
            <label
              htmlFor="paramNumPagas"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1"
            >
              Nº Pagas Anuales
            </label>
            <input
              type="number"
              id="paramNumPagas"
              value={effectiveParams.numPagas}
              min={12}
              max={18}
              step={1}
              onChange={(e) =>
                handleParamChange('numPagas', Math.max(12, parseInt(e.target.value, 10) || 15))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="paramModoExtras"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1"
            >
              Abono Pagas Extras
            </label>
            <select
              id="paramModoExtras"
              value={effectiveParams.modoExtras}
              onChange={(e) =>
                handleParamChange('modoExtras', e.target.value as AnnualExtrasPayMode)
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            >
              <option value="prorrateadas">Prorrateadas (12 meses)</option>
              <option value="integras">Íntegras (Mar, Jul, Dic)</option>
              <option value="mixta_marzo_prorr">2 Íntegras + Marzo Prorr.</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="paramPlusVacDia"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-800 mb-1"
            >
              Plus Vac. 100% (€/D)
            </label>
            <input
              type="number"
              id="paramPlusVacDia"
              value={effectiveParams.plusVacDia100}
              min={0}
              max={500}
              step={0.01}
              onChange={(e) =>
                handleParamChange('plusVacDia100', Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="w-full rounded-xl border border-amber-300 bg-amber-50/50 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            />
            <div className="text-[11px] font-semibold text-amber-700 mt-1">
              Aplicado: {formatEuro(liquidation.plusVacDiaEfectivo)}/día
            </div>
          </div>

          <div>
            <label
              htmlFor="paramRepartoBolsa"
              className="block text-[11px] font-extrabold uppercase tracking-wider text-cyan-800 mb-1"
            >
              Reparto Bolsa Horas
            </label>
            <select
              id="paramRepartoBolsa"
              value={effectiveParams.repartoBolsa}
              onChange={(e) =>
                handleParamChange('repartoBolsa', e.target.value as BolsaRepartoMode)
              }
              className="w-full rounded-xl border border-cyan-300 bg-cyan-50/50 focus:bg-white focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 px-3 py-2 text-sm font-bold text-slate-900"
            >
              <option value="lineal">Cuota Fija Mensual</option>
              <option value="equilibrado">Equilibrado (Uniforme)</option>
            </select>
          </div>
        </div>

        {/* Barra de estado y métricas resumen */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border ${
              vacMatches
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : vacPending
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {vacMatches ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>
              {vacMatches
                ? `Vacaciones cuadradas: ${liquidation.totalVacNat} / ${p.vacReglamentarias} días naturales (todos con plus)`
                : vacPending
                ? `Faltan ${difVac} días naturales por asignar (${liquidation.totalVacNat} / ${p.vacReglamentarias} con plus)`
                : `Exceso de ${Math.abs(difVac)} días naturales sobre convenio (${liquidation.totalVacNat} / ${p.vacReglamentarias})`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs sm:text-sm text-slate-700">
            <span>
              Jornada:{' '}
              <strong className="text-slate-950 font-mono tabular-nums">
                {formatHoras(liquidation.jornadaAnualEfectiva)}
              </strong>
            </span>
            <span
              title={
                liquidation.esJornadaCompleta
                  ? 'Jornada completa (100%): tope legal máximo de 80 horas extraordinarias anuales'
                  : 'Tope máximo de horas realizadas totales al año (Jornada anual teórica + 30%)'
              }
            >
              {liquidation.esJornadaCompleta ? 'Límite +80 h:' : 'Límite +30%:'}{' '}
              <strong className="text-slate-950 font-mono tabular-nums">
                {formatHoras(liquidation.topeMaximoHoras30Anual)}
              </strong>{' '}
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                (+{formatHoras(liquidation.limiteComplementarias30Horas)})
              </span>
            </span>
            {!liquidation.esJornadaCompleta && (
              <span title="Horas complementarias voluntarias (hasta el 15% sobre la jornada anual efectiva, requiere consentimiento del empleado en bloques de 8h)">
                Voluntarias 15%:{' '}
                <strong
                  className={`font-mono tabular-nums ${
                    liquidation.voluntarias15Activas ? 'text-indigo-800' : 'text-slate-500'
                  }`}
                >
                  {liquidation.voluntarias15Activas
                    ? `${formatHoras(liquidation.horasVoluntarias15Activadas)} / ${formatHoras(liquidation.horasVoluntarias15Anual)}`
                    : `0,00 h / ${formatHoras(liquidation.horasVoluntarias15Anual)}`}
                </strong>
              </span>
            )}
            <span title="Cuota fija mensual redondeada al entero superior (se regulariza en los últimos meses tras disfrutar los 31 días de vacaciones)">
              Cuota base:{' '}
              <strong className="text-slate-950 font-mono tabular-nums">
                {formatHoras(liquidation.cuotaFijaMes)}/mes
              </strong>
            </span>
            <span>
              Media diaria:{' '}
              <strong className="text-slate-950 font-mono tabular-nums">
                {liquidation.horasPorDiaActivo.toLocaleString('es-ES', {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}{' '}
                h/día
              </strong>
            </span>
            <span title="La bolsa de horas inicia el 1 de enero a 0,00 h (ni a favor ni en contra del año anterior)">
              Inicio 1 Ene:{' '}
              <strong className="text-slate-950 font-mono tabular-nums">
                {formatHoras(liquidation.bolsaInicialAnio)}
              </strong>
            </span>
            <span title="Horas realizadas en Turnos Día (verde) más horas teóricas de meses sin turnos (violeta) para estimar el cierre anual">
              Real + Prev.:{' '}
              <strong className="text-emerald-700 font-mono tabular-nums">
                {formatHoras(liquidation.sumaHorasRealizadas)}
              </strong>
              {liquidation.horasPendientesMesesSinRegistro > 0.004 && (
                <>
                  {' + '}
                  <strong className="text-violet-700 font-mono tabular-nums">
                    {formatHoras(liquidation.horasPendientesMesesSinRegistro)}
                  </strong>
                </>
              )}
              {' = '}
              <strong className="text-slate-950 font-mono tabular-nums">
                {formatHoras(liquidation.horasEstimadasCierreAnual)}
              </strong>
            </span>
            <span>
              Compensar (R−T):{' '}
              <strong
                className={`font-mono tabular-nums ${
                  liquidation.bolsaCompensacionFinal > 0.004
                    ? 'text-emerald-700'
                    : liquidation.bolsaCompensacionFinal < -0.004
                    ? 'text-rose-700'
                    : 'text-slate-950'
                }`}
              >
                {liquidation.mesesConTurnosCount > 0
                  ? formatHoras(liquidation.bolsaCompensacionFinal, true)
                  : '0,00 h'}
              </strong>
            </span>
            <span>
              Bruto fijo anual:{' '}
              <strong className="text-blue-900 font-mono tabular-nums">
                {formatEuro(liquidation.brutoFijoAnual)}
              </strong>
            </span>
          </div>
        </div>

        {/* Barra de Llenado y Alerta de Límite Máximo Anual (+30%) y Voluntarias (15%) */}
        {(() => {
          const isExceeded = liquidation.superaLimite30ConPendientes;
          const isPaceRisk = liquidation.riesgoSuperarLimite30PorRitmo;
          const isNear =
            !isExceeded && !isPaceRisk && liquidation.porcentajeMargen30Consumido >= 80;
          const isVolActive = liquidation.voluntarias15Activas;
          const activeVolHours = liquidation.horasVoluntarias15Activadas;
          const effectiveCap = liquidation.topeMaximoConVoluntariasAnual;
          const effectiveMarginCap = Math.round(
            (liquidation.limiteComplementarias30Horas + activeVolHours) * 100
          ) / 100;
          const volBlockOptions = getVoluntary8hBlockOptions(liquidation.horasVoluntarias15Anual);

          const realWidthPct = Math.min(100, Math.max(0, liquidation.porcentajeLlenadoTope30));
          const projectedWidthPct = Math.min(100, Math.max(realWidthPct, liquidation.porcentajeEstimadoTope30));
          const baseMarkerPct =
            effectiveCap > 0
              ? (liquidation.jornadaAnualEfectiva / effectiveCap) * 100
              : 76.92;
          const base30MarkerPct =
            isVolActive && effectiveCap > 0
              ? (liquidation.topeMaximoHoras30Anual / effectiveCap) * 100
              : null;
          const unloggedMonthsCount = Math.max(0, 12 - liquidation.mesesConTurnosCount);

          const selectedBlockValue = (() => {
            if (!isVolActive) return '0';
            const match = volBlockOptions.find((opt) => Math.abs(opt - activeVolHours) < 0.01);
            return String(match ?? activeVolHours);
          })();

          return (
            <div
              className={`mt-4 rounded-xl border p-3.5 text-xs ${
                isExceeded
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : isPaceRisk || isNear
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-slate-50/90 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {isExceeded || isPaceRisk || isNear ? (
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        isExceeded ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  )}
                  <span className="font-bold text-slate-900">
                    {liquidation.esJornadaCompleta
                      ? `Control Tope Anual Jornada Completa (+80,00 h máx. · ${formatHoras(effectiveCap)})`
                      : `Control Tope Anual +30% (${formatHoras(liquidation.topeMaximoHoras30Anual)})${
                          isVolActive
                            ? ` + ${formatHoras(activeVolHours)} voluntarias = ${formatHoras(effectiveCap)}`
                            : ` · Voluntarias 15% (${formatHoras(liquidation.horasVoluntarias15Anual)})`
                        }`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
                  <span>
                    Realizado:{' '}
                    <strong className="text-emerald-700">
                      {formatHoras(liquidation.sumaHorasRealizadas)}
                    </strong>{' '}
                    ({liquidation.porcentajeLlenadoTope30.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%)
                  </span>
                  {liquidation.horasPendientesMesesSinRegistro > 0.004 && (
                    <span>
                      + Teór. sin turnos:{' '}
                      <strong className="text-violet-700">
                        +{formatHoras(liquidation.horasPendientesMesesSinRegistro)}
                      </strong>
                    </span>
                  )}
                  <span>
                    Estimado cierre:{' '}
                    <strong
                      className={
                        isExceeded
                          ? 'text-rose-700'
                          : isPaceRisk
                          ? 'text-amber-800'
                          : 'text-slate-950'
                      }
                    >
                      {formatHoras(liquidation.horasEstimadasCierreAnual)}
                    </strong>{' '}
                    / {formatHoras(effectiveCap)}
                  </span>
                  <span>
                    {liquidation.margenRestante30Horas >= 0 ? 'Margen disp.: ' : 'Exceso s/ tope: '}
                    <strong
                      className={
                        liquidation.margenRestante30Horas < 0
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }
                    >
                      {liquidation.margenRestante30Horas >= 0
                        ? formatHoras(liquidation.margenRestante30Horas)
                        : `+${formatHoras(Math.abs(liquidation.margenRestante30Horas))}`}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Control de consentimiento de Horas Voluntarias (solo tiempo parcial) o nota de límite 80h (100%) */}
              {liquidation.esJornadaCompleta ? (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 px-3 py-1.5 rounded-lg bg-white/85 border border-slate-200/90 text-[11px] text-slate-700">
                  <span>
                    <strong className="text-slate-900">Jornada completa (100%):</strong> rige el límite legal máximo de{' '}
                    <strong className="font-mono text-slate-950">+80,00 h</strong> extraordinarias al año (no aplican complementarias +30% ni voluntarias +15%).
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5 px-3 py-2 rounded-lg bg-white/85 border border-slate-200/90">
                  <div className="flex items-center gap-2 text-[11px] text-slate-700">
                    {isVolActive ? (
                      <Unlock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span>
                      <strong className="text-slate-900">Horas voluntarias 15% (con consentimiento):</strong>{' '}
                      {isVolActive
                        ? `Consentidas ${formatHoras(activeVolHours)} de ${formatHoras(liquidation.horasVoluntarias15Anual)} máx.`
                        : `Desactivadas (hasta ${formatHoras(liquidation.horasVoluntarias15Anual)} disponibles en bloques de 8 h)`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleVoluntaryConsentChange(
                          !isVolActive,
                          !isVolActive ? liquidation.horasVoluntarias15Anual : 0
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isVolActive
                          ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                          : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900'
                      }`}
                      title={
                        isVolActive
                          ? 'Pulsa para revocar el consentimiento de horas voluntarias'
                          : 'Activar horas voluntarias del 15% con consentimiento del empleado'
                      }
                    >
                      {isVolActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {isVolActive
                          ? `Voluntarias activas (${formatHoras(activeVolHours)})`
                          : 'Activar Voluntarias 15%'}
                      </span>
                    </button>

                    <select
                      aria-label="Bloques de 8 horas de horas voluntarias"
                      value={selectedBlockValue}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleVoluntaryConsentChange(val > 0, val);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tabular-nums cursor-pointer"
                    >
                      <option value="0">0 h — Sin consentimiento</option>
                      {volBlockOptions.map((opt) => {
                        const isExact8 = Math.abs(opt % 8) < 0.001;
                        const blocks = Math.round(opt / 8);
                        return (
                          <option key={opt} value={String(opt)}>
                            {isExact8
                              ? `${opt} h (${blocks} ${blocks === 1 ? 'bloque' : 'bloques'} × 8h)`
                              : `${formatHoras(opt)} (Tope 15%)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {/* Barra visual de llenado: verde = realizadas, violeta = teóricas sumadas en meses sin turnos */}
              <div
                className={`relative w-full h-3 bg-slate-200/80 rounded-lg overflow-hidden ${
                  isExceeded
                    ? 'ring-2 ring-rose-500/80'
                    : isPaceRisk || isNear
                    ? 'ring-2 ring-amber-500/75'
                    : ''
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-violet-500/85 transition-all duration-200"
                  style={{ width: `${projectedWidthPct}%` }}
                  title={`Previsión cierre anual (realizadas + teóricas sin turnos): ${formatHoras(liquidation.horasEstimadasCierreAnual)}`}
                />
                <div
                  className="relative h-full bg-emerald-600 transition-all duration-200"
                  style={{ width: `${realWidthPct}%` }}
                  title={`Horas realizadas acumuladas: ${formatHoras(liquidation.sumaHorasRealizadas)}`}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-slate-900/80"
                  style={{ left: `${baseMarkerPct}%` }}
                  title={`100% Jornada Anual Teórica: ${formatHoras(liquidation.jornadaAnualEfectiva)}`}
                />
                {base30MarkerPct !== null && (
                  <div
                    className="absolute inset-y-0 w-0.5 bg-indigo-800/85"
                    style={{ left: `${base30MarkerPct}%` }}
                    title={`Límite base +30% (sin voluntarias): ${formatHoras(liquidation.topeMaximoHoras30Anual)}`}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-[11px] text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-emerald-600" aria-hidden="true" />
                    <span>
                      Realizadas:{' '}
                      <strong className="font-mono tabular-nums text-emerald-800">
                        {formatHoras(liquidation.sumaHorasRealizadas)}
                      </strong>
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-violet-500" aria-hidden="true" />
                    <span>
                      Teór. sin turnos:{' '}
                      <strong className="font-mono tabular-nums text-violet-800">
                        +{formatHoras(liquidation.horasPendientesMesesSinRegistro)}
                      </strong>
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Marca 100% Jornada:{' '}
                    <strong className="font-mono tabular-nums text-slate-800">
                      {formatHoras(liquidation.jornadaAnualEfectiva)}
                    </strong>
                  </span>
                  {isVolActive && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Marca +30% base:{' '}
                        <strong className="font-mono tabular-nums text-indigo-800">
                          {formatHoras(liquidation.topeMaximoHoras30Anual)}
                        </strong>
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>
                    Margen extra usado/est.:{' '}
                    <strong className="font-mono tabular-nums text-slate-800">
                      {liquidation.porcentajeMargen30Consumido.toLocaleString('es-ES', {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </strong>{' '}
                    (de +{formatHoras(effectiveMarginCap)})
                  </span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {liquidation.esJornadaCompleta
                    ? `Tope máx. (+80 h): ${formatHoras(effectiveCap)}`
                    : isVolActive
                      ? `Tope efectivo (+30% y vol.): ${formatHoras(effectiveCap)}`
                      : `Tope máx. 130%: ${formatHoras(effectiveCap)}`}
                </span>
              </div>

              {(isExceeded || isPaceRisk || isNear) && (
                <div
                  className={`mt-2 pt-2 border-t text-[11px] leading-snug font-medium ${
                    isExceeded
                      ? 'border-rose-200 text-rose-900'
                      : 'border-amber-200 text-amber-900'
                  }`}
                >
                  {isExceeded ? (
                    <span>
                      <strong>
                        Alerta — Límite{' '}
                        {liquidation.esJornadaCompleta
                          ? 'de +80 h anuales'
                          : isVolActive
                            ? 'efectivo (+30% + voluntarias)'
                            : 'del +30%'}{' '}
                        superado:
                      </strong>{' '}
                      sumando lo ya realizado (
                      {formatHoras(liquidation.sumaHorasRealizadas)}) y las teóricas pendientes (
                      {formatHoras(liquidation.horasPendientesMesesSinRegistro)}), la estimación anual (
                      {formatHoras(liquidation.horasEstimadasCierreAnual)}) supera el tope máximo de{' '}
                      {formatHoras(effectiveCap)} en{' '}
                      <strong>{formatHoras(Math.abs(liquidation.margenRestante30Horas))}</strong>.
                      {unloggedMonthsCount > 0
                        ? ` Regulariza reduciendo al menos ${formatHoras(Math.abs(liquidation.margenRestante30Horas))} entre los ${unloggedMonthsCount} meses pendientes.`
                        : ' Revisa el cuadrante anual para regularizar el exceso.'}
                      {!liquidation.esJornadaCompleta &&
                        !isVolActive &&
                        liquidation.horasVoluntarias15Anual > 0 &&
                        ` También puedes activar horas voluntarias (+15%, hasta ${formatHoras(liquidation.horasVoluntarias15Anual)}) en bloques de 8 h con consentimiento del empleado.`}
                    </span>
                  ) : isPaceRisk ? (
                    <span>
                      <strong>Alerta de estimación mensual:</strong> al ritmo actual en los meses registrados respecto a las horas teóricas del mes, se estima alcanzar{' '}
                      <strong>{formatHoras(liquidation.horasEstimadasAlRitmoActual)}</strong> al final del año, superando el tope de{' '}
                      {formatHoras(effectiveCap)} en{' '}
                      <strong>
                        {formatHoras(
                          Math.max(0, liquidation.horasEstimadasAlRitmoActual - effectiveCap)
                        )}
                      </strong>
                      . Regulariza los próximos meses (margen restante actual: {formatHoras(liquidation.margenRestante30Horas)}).
                    </span>
                  ) : (
                    <span>
                      <strong>Aviso de proximidad al límite:</strong> la estimación actual consume el{' '}
                      {liquidation.porcentajeMargen30Consumido.toLocaleString('es-ES', {
                        maximumFractionDigits: 1,
                      })}
                      % del margen anual disponible. Quedan{' '}
                      <strong>{formatHoras(liquidation.margenRestante30Horas)}</strong> de margen antes de alcanzar{' '}
                      {formatHoras(effectiveCap)}.
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Recálculo dinámico del resto del año tras meses validados / cambios de jornada */}
        {liquidation.validatedMonthsCount > 0 && (
          <div className="mt-4 bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 border border-indigo-200 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Lock className="w-4 h-4 text-indigo-700 shrink-0" />
                <span className="font-extrabold text-indigo-950">
                  Recálculo Resto del Año ({liquidation.validatedMonthsCount}/12 meses validados)
                </span>
                {liquidation.hasJornadaChangeAcrossMonths && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                    Cambio de % jornada detectado · Resto al {effectiveParams.jornadaPct}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-700">
                Saldo arrastrado desde meses validados:{' '}
                <strong
                  className={
                    liquidation.saldoArrastradoValidado > 0.004
                      ? 'text-emerald-700 font-mono'
                      : liquidation.saldoArrastradoValidado < -0.004
                      ? 'text-rose-700 font-mono'
                      : 'text-slate-900 font-mono'
                  }
                >
                  {formatHoras(liquidation.saldoArrastradoValidado, true)}
                </strong>
                {' · '}
                Cuota teórica restante ({liquidation.unvalidatedMonthsCount} meses al {effectiveParams.jornadaPct}%):{' '}
                <strong className="font-mono text-slate-900">
                  {formatHoras(liquidation.horasRestantesBase)}
                </strong>
              </p>
            </div>

            {liquidation.unvalidatedMonthsCount > 0 ? (
              <div className="flex flex-wrap items-center gap-4 bg-white/85 px-3.5 py-2 rounded-xl border border-indigo-200/80 shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Pendiente ajustado a 0
                  </span>
                  <strong className="text-sm font-black font-mono text-indigo-950">
                    {formatHoras(liquidation.horasPendientesAjustadasResto)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Media mensual restante
                  </span>
                  <strong className="text-sm font-black font-mono text-blue-800">
                    {formatHoras(liquidation.cuotaMensualAjustadaResto)}/mes
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Media diaria ({liquidation.diasComputoRestantes} d.)
                  </span>
                  <strong className="text-sm font-black font-mono text-emerald-800">
                    {liquidation.mediaDiariaAjustadaResto.toLocaleString('es-ES', {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}{' '}
                    h/d
                  </strong>
                </div>
              </div>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-xs">
                Ejercicio completo validado (12/12 meses)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cuadro Numérico Completo de Liquidación */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Cuadro Numérico Completo de Liquidación {p.anio}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Compensación (R − T) frente al criterio seleccionado en cabecera (
              {p.repartoBolsa === 'equilibrado' ? 'Horas Equilibradas' : 'Cuota Fija Mensual'}), junto a las Horas Realizadas del{' '}
              {profile.extrasCutoffMode === 'mes_natural'
                ? 'mes natural'
                : profile.extrasCutoffMode === 'personalizado'
                  ? `ciclo (día ${profile.customCutoffStartDay || 25} al ${(profile.customCutoffStartDay || 25) - 1})`
                  : 'ciclo Direxis (25 anterior al 24 actual)'}{' '}
              en Turnos Día
            </p>
          </div>
          <span className="inline-block bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-full self-start sm:self-auto">
            Valor hora tabla:{' '}
            {liquidation.valorHoraTabla.toLocaleString('es-ES', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            €/h
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px]">
              <tr>
                <th className="px-3 py-3 text-left whitespace-nowrap">Mes {p.anio}</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Háb. Cal.</th>
                <th
                  className="px-2 py-3 text-center whitespace-nowrap"
                  title="Días naturales de vacaciones disfrutados en el mes (31 días con plus en año completo)"
                >
                  Vacaciones
                </th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Baja IT (Nat / L-V / Tipo)</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Días Activos</th>
                <th className="px-3 py-3 text-right whitespace-nowrap" title="Horas teóricas calculadas según días activos para cuadrar el año a 0,00 h">
                  Horas Teór.
                </th>
                <th
                  className="px-3 py-3 text-right whitespace-nowrap"
                  title={
                    p.repartoBolsa === 'equilibrado'
                      ? 'Horas teóricas equilibradas según días activos + IT del mes'
                      : 'Cuota fija mensual redondeada al entero superior; tras disfrutar los 31 días de vacaciones, regulariza los meses restantes para cuadrar el año y dejar la bolsa a 0,00 h'
                  }
                >
                  {p.repartoBolsa === 'equilibrado' ? 'Horas Equil.' : 'Cuota Fija'}
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Saldo Teór.</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Bolsa Teór.</th>
                <th className="px-3 py-3 text-right whitespace-nowrap bg-emerald-50 text-emerald-950" title="Horas reales de Turnos Día; en meses sin turnos muestra en violeta las horas teóricas previstas para el cierre anual">
                  Horas Real. / Prev.
                </th>
                <th
                  className="px-3 py-3 text-right whitespace-nowrap bg-emerald-50 text-emerald-950"
                  title={
                    p.repartoBolsa === 'equilibrado'
                      ? 'Horas Realizadas (+IT, excluidas complementarias cobradas) menos Horas Equilibradas'
                      : 'Horas Realizadas (+IT, excluidas complementarias cobradas) menos Cuota Fija Mensual'
                  }
                >
                  Comp. (R − T)
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Fijo Prorr.</th>
                <th
                  className="px-3 py-3 text-right whitespace-nowrap"
                  title="Calculado por día natural de vacaciones disfrutado (31 días en año trabajado al completo)"
                >
                  Plus Vac.
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap bg-blue-50 text-blue-950">
                  Total Bruto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              <tr className="bg-slate-50/90 text-slate-600 text-[11px] sm:text-xs">
                <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">
                  Inicio 1 Ene {p.anio}
                </td>
                <td colSpan={6} className="px-3 py-2 text-center italic text-slate-500">
                  Saldo inicial de bolsa en enero: ni a favor ni en contra (sin arrastre de año anterior)
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-700 whitespace-nowrap">
                  {formatHoras(liquidation.bolsaInicialAnio)}
                </td>
                <td className="px-3 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                  {formatHoras(liquidation.bolsaInicialAnio)}
                </td>
                <td className="px-3 py-2 text-right text-slate-400 bg-emerald-50/35 whitespace-nowrap">
                  —
                </td>
                <td className="px-3 py-2 text-right font-bold text-emerald-900 bg-emerald-50/35 whitespace-nowrap">
                  {formatHoras(liquidation.bolsaInicialAnio)}
                </td>
                <td colSpan={3} className="px-3 py-2 text-right text-slate-400">
                  —
                </td>
              </tr>
              {liquidation.filas.map((m) => {
                const tieneVac = m.vacNat > 0;
                const tieneBaja = m.bajaNat > 0 || m.bajaLab > 0;
                const rowClass = tieneBaja
                  ? 'bg-rose-50/40 hover:bg-rose-50/80'
                  : tieneVac
                  ? 'bg-amber-50/40 hover:bg-amber-50/80'
                  : 'hover:bg-slate-50';

                const saldoClass =
                  m.saldoMes > 0.004
                    ? 'text-emerald-600 font-bold'
                    : m.saldoMes < -0.004
                    ? 'text-rose-600 font-bold'
                    : 'text-slate-600 font-bold';

                const bolsaClass =
                  m.bolsaAcumulada > 0.004
                    ? 'text-emerald-700 font-bold'
                    : m.bolsaAcumulada < -0.004
                    ? 'text-rose-700 font-bold'
                    : 'text-slate-900 font-black';

                const difClass = !m.tieneRegistroReal
                  ? 'text-slate-400 font-medium'
                  : m.diferenciaRealMes > 0.004
                  ? 'text-emerald-700 font-bold'
                  : m.diferenciaRealMes < -0.004
                  ? 'text-rose-700 font-bold'
                  : 'text-slate-700 font-bold';

                const compAcumClass =
                  m.bolsaCompensacionAcumulada > 0.004
                    ? 'text-emerald-800'
                    : m.bolsaCompensacionAcumulada < -0.004
                    ? 'text-rose-700'
                    : 'text-slate-500';

                return (
                  <tr key={m.idx} className={rowClass}>
                    <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span>{m.mes}</span>
                        {m.isValidated && (
                          <button
                            type="button"
                            onClick={() => onSelectMonthForNomina?.(selectedYear, m.idx + 1)}
                            title="Mes validado con nómina congelada. Pulsa para ver la nómina guardada."
                            className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>
                              {m.effectiveJornadaPct}% · IRPF {m.validatedIrpf ?? 0}%
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={31}
                        step={1}
                        value={m.habilesCal}
                        onChange={(e) =>
                          handleMonthFieldChange(
                            m.idx,
                            'habilesCal',
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )
                        }
                        className="w-14 text-center rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <input
                        type="number"
                        min={0}
                        max={31}
                        step={1}
                        value={m.vacNat}
                        title="Días naturales de vacaciones disfrutados en el mes (todos cobran plus)"
                        onChange={(e) => {
                          const natVal = Math.max(0, Math.min(31, parseInt(e.target.value, 10) || 0));
                          handleMonthFieldsChange(m.idx, {
                            vacNat: natVal,
                            vacLab: undefined,
                          });
                        }}
                        className="w-16 text-center rounded border border-amber-300 bg-amber-50/60 px-1.5 py-1 text-xs font-bold text-amber-900 focus:border-amber-600 focus:outline-none"
                      />
                      {m.vacNat > 0 && (
                        <div className="mt-1 text-[10px] font-bold text-amber-800">
                          {m.vacNat} {m.vacNat === 1 ? 'día' : 'días'} con plus
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center space-x-1">
                        <input
                          type="number"
                          min={0}
                          max={31}
                          step={1}
                          value={m.bajaNat}
                          title="Baja IT días naturales (calcula automáticamente L–V)"
                          onChange={(e) => {
                            const natVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const maxHab = Math.max(0, m.habilesCal - m.vacLab);
                            handleMonthFieldsChange(m.idx, {
                              bajaNat: natVal,
                              bajaLab: estimateWorkingDaysFromNatural(natVal, maxHab),
                            });
                          }}
                          className="w-11 text-center rounded border border-rose-300 bg-rose-50/60 px-1 py-1 text-xs font-bold text-rose-900 focus:border-rose-600 focus:outline-none"
                        />
                        <span className="text-slate-400 font-bold">/</span>
                        <input
                          type="number"
                          min={0}
                          max={31}
                          step={1}
                          value={m.bajaLab}
                          title="Baja IT días laborables (L–V)"
                          onChange={(e) =>
                            handleMonthFieldChange(
                              m.idx,
                              'bajaLab',
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="w-11 text-center rounded border border-rose-300 bg-rose-50/60 px-1 py-1 text-xs font-bold text-rose-900 focus:border-rose-600 focus:outline-none"
                        />
                        <select
                          value={m.tipoBaja}
                          title="Contingencia de la baja en este mes"
                          onChange={(e) =>
                            handleMonthFieldChange(
                              m.idx,
                              'tipoBaja',
                              e.target.value as SickLeaveContingencyType
                            )
                          }
                          className="rounded border border-rose-300 bg-white px-1.5 py-1 text-[11px] font-bold text-rose-900 focus:border-rose-600 focus:outline-none"
                        >
                          <option value="comun">E. Común</option>
                          <option value="accidente_100">Acc. 100%</option>
                          <option value="accidente_75">Acc. 75%</option>
                        </select>
                      </div>
                      {m.prevMonthHasBaja && m.bajaNat > 0 && m.tipoBaja === 'comun' && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleMonthFieldChange(
                                m.idx,
                                'bajaEsContinuacion',
                                !m.bajaEsContinuacionEfectiva
                              )
                            }
                            title={
                              m.bajaEsContinuacionEfectiva
                                ? 'Misma baja continuada (no reinicia días 1–3 sin cobro). Pulsa si es una nueva baja distinta.'
                                : 'Baja nueva independiente (reinicia en día 1). Pulsa para enlazar con el mes anterior.'
                            }
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                              m.bajaEsContinuacionEfectiva
                                ? 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200'
                                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {m.bajaEsContinuacionEfectiva
                              ? `↳ Continúa baja (d. ${m.rachaInicioDia + 1}–${m.rachaFinDia})`
                              : `↺ Nueva baja (d. 1–${m.rachaFinDia})`}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center font-bold text-slate-800 whitespace-nowrap">
                      {m.diasActivos}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-800 whitespace-nowrap">
                      <div>{formatHoras(m.horasTeoricasActivas)}</div>
                      {m.bajaLab > 0 && (
                        <div className="text-[10px] font-semibold text-rose-700">
                          +IT {formatHoras(m.horasJustificadasIT)}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          max={400}
                          step={0.01}
                          value={
                            cuotaDrafts[m.idx] !== undefined
                              ? cuotaDrafts[m.idx]
                              : String(Number(m.cuotaMes.toFixed(2)))
                          }
                          title="Cuota fija mensual editable manualmente (debe cuadrar al final con Horas Teór. y respetar los límites anuales)"
                          onChange={(e) => {
                            const raw = e.target.value;
                            setCuotaDrafts((prev) => ({ ...prev, [m.idx]: raw }));
                            if (raw.trim() === '') return;
                            const parsed = parseFloat(raw.replace(',', '.'));
                            if (Number.isFinite(parsed) && parsed >= 0) {
                              handleMonthFieldChange(
                                m.idx,
                                'cuotaFijaManual',
                                Math.round(parsed * 100) / 100
                              );
                            }
                          }}
                          onBlur={() => {
                            setCuotaDrafts((prev) => {
                              if (!(m.idx in prev)) return prev;
                              const next = { ...prev };
                              delete next[m.idx];
                              return next;
                            });
                          }}
                          className={`w-20 text-right rounded border px-1.5 py-1 text-xs font-bold font-mono tabular-nums focus:outline-none ${
                            m.isCuotaManual
                              ? 'border-amber-400 bg-amber-50 text-amber-950 focus:border-amber-600'
                              : 'border-slate-300 bg-white text-slate-700 focus:border-blue-600'
                          }`}
                        />
                        {m.isCuotaManual && (
                          <button
                            type="button"
                            onClick={() => {
                              setCuotaDrafts((prev) => {
                                const next = { ...prev };
                                delete next[m.idx];
                                return next;
                              });
                              handleMonthFieldChange(m.idx, 'cuotaFijaManual', undefined);
                            }}
                            title="Restablecer cuota fija automática de este mes"
                            className="text-[10px] font-bold text-amber-800 hover:text-amber-950 px-1 py-0.5 rounded bg-amber-100 cursor-pointer"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                      {m.isCuotaManual ? (
                        <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                          Manual
                        </div>
                      ) : (
                        p.repartoBolsa !== 'equilibrado' &&
                        m.vacNat === 0 &&
                        m.bajaNat === 0 &&
                        Math.abs(m.cuotaMes - liquidation.cuotaFijaMes) > 0.004 && (
                          <div className="text-[10px] font-semibold text-indigo-700 mt-0.5">
                            Regularizada
                          </div>
                        )
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap ${saldoClass}`}>
                      {formatHoras(m.saldoMes, true)}
                    </td>
                    <td className={`px-3 py-2.5 text-right whitespace-nowrap ${bolsaClass}`}>
                      {formatHoras(m.bolsaAcumulada, true)}
                    </td>
                    <td className="px-3 py-2 text-right bg-emerald-50/35 whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          max={400}
                          step={0.01}
                          value={Number(m.horasRealizadas.toFixed(2))}
                          title="Horas reales trabajadas del ciclo activo desde Turnos Día (editable manualmente)"
                          onChange={(e) =>
                            handleMonthFieldChange(
                              m.idx,
                              'horasReales',
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                          className={`w-20 text-right rounded border px-1.5 py-1 text-xs font-bold font-mono tabular-nums focus:outline-none ${
                            m.isHorasManual
                              ? 'border-indigo-300 bg-indigo-50/70 text-indigo-900 focus:border-indigo-600'
                              : m.tieneRegistroReal
                              ? 'border-emerald-300 bg-white text-emerald-950 focus:border-emerald-600'
                              : 'border-violet-200 bg-violet-50/40 text-slate-500 focus:border-violet-600'
                          }`}
                        />
                        {m.isHorasManual && (
                          <button
                            type="button"
                            onClick={() => handleMonthFieldChange(m.idx, 'horasReales', undefined)}
                            title="Volver a tomar horas reales desde Turnos Día"
                            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-950 px-1 py-0.5 rounded bg-indigo-100 cursor-pointer"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                      {m.tieneRegistroReal ? (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 space-y-0.5">
                          <div>
                            {m.isHorasManual
                              ? 'Manual'
                              : `${m.turnosDiarioCount} turnos · ${
                                  profile.extrasCutoffMode === 'mes_natural'
                                    ? 'Mes nat.'
                                    : profile.extrasCutoffMode === 'personalizado'
                                      ? `Ciclo d.${profile.customCutoffStartDay || 25}`
                                      : 'Ciclo 25–24'
                                }`}
                          </div>
                          {!m.isHorasManual && m.horasTotalesTrabajadas > m.horasRealizadas + 0.004 && (
                            <div className="text-[10px] font-bold text-slate-600 font-mono">
                              Total trab.: {formatHoras(m.horasTotalesTrabajadas)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 text-[10px] font-bold font-mono tabular-nums"
                          title="Sin turnos registrados: se suman estas horas teóricas del mes para calcular la previsión anual"
                        >
                          <span>+{formatHoras(m.horasTeoricasActivas)} prev. teór.</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right bg-emerald-50/35 whitespace-nowrap">
                      <div className={difClass}>
                        {m.tieneRegistroReal
                          ? formatHoras(m.diferenciaRealMes, true)
                          : '—'}
                      </div>
                      {m.tieneRegistroReal && (
                        <>
                          {m.horasComplementariasMes > 0.004 && (
                            <div className="text-[10px] font-bold text-indigo-700">
                              −{formatHoras(m.horasComplementariasMes)} compl. (no a bolsa)
                            </div>
                          )}
                          <div className={`text-[10px] font-bold ${compAcumClass}`}>
                            {m.bajaLab > 0 ? 'Incl. +IT · ' : ''}Acum:{' '}
                            {formatHoras(m.bolsaCompensacionAcumulada, true)}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-800 whitespace-nowrap">
                      <div>{formatEuro(m.fijoMes)}</div>
                      {m.detalleIT && (
                        <div className="text-[10px] font-semibold text-rose-700">{m.detalleIT}</div>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right whitespace-nowrap ${
                        m.plusVacMes > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'
                      }`}
                    >
                      <div>{formatEuro(m.plusVacMes)}</div>
                      {m.vacNat > 0 && liquidation.plusVacDiaEfectivo > 0 && (
                        <div className="text-[10px] font-semibold text-amber-700">
                          {m.vacNat}d × {formatEuro(liquidation.plusVacDiaEfectivo)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-slate-950 bg-blue-50/50 whitespace-nowrap">
                      {formatEuro(m.totalBrutoMes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-blue-950 text-white font-extrabold text-xs sm:text-sm">
              <tr>
                <td className="px-3 py-3 whitespace-nowrap">TOTAL {p.anio}</td>
                <td className="px-2 py-3 text-center whitespace-nowrap">
                  {liquidation.totalHabilesCal}
                </td>
                <td className="px-2 py-3 text-center text-amber-300 whitespace-nowrap">
                  {liquidation.totalVacNat} d.
                </td>
                <td className="px-2 py-3 text-center text-rose-300 whitespace-nowrap">
                  {liquidation.totalBajaNat} / {liquidation.totalBajaLab}
                </td>
                <td className="px-2 py-3 text-center whitespace-nowrap">
                  {liquidation.totalDiasActivos}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap font-mono tabular-nums">
                  {formatHoras(liquidation.sumaHorasComputoTeorico)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right whitespace-nowrap font-mono tabular-nums ${
                    liquidation.superaLimiteAnualCuota ||
                    ((liquidation.hasCuotaManualOverride || liquidation.hasAllStatutoryVacations) &&
                      !liquidation.cuotaCuadraConTeoricas)
                      ? 'text-amber-300 bg-rose-950/60'
                      : ''
                  }`}
                >
                  <div>{formatHoras(liquidation.sumaCuotaFija)}</div>
                  {(liquidation.hasCuotaManualOverride || liquidation.hasAllStatutoryVacations) &&
                    !liquidation.cuotaCuadraConTeoricas && (
                      <div className="text-[10px] font-bold text-rose-300">
                        Descuadre: {formatHoras(liquidation.diffCuotaVsTeoricas, true)}
                      </div>
                    )}
                </td>
                <td className="px-3 py-3 text-right text-cyan-300 whitespace-nowrap">
                  {formatHoras(liquidation.sumaSaldoMes, true)}
                </td>
                <td className="px-3 py-3 text-right text-cyan-300 whitespace-nowrap">
                  {formatHoras(liquidation.bolsaAcumuladaFinal, true)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono tabular-nums">
                  <div className="text-emerald-300" title="Total horas reales registradas">
                    {formatHoras(liquidation.sumaHorasRealizadas)}
                  </div>
                  {liquidation.horasPendientesMesesSinRegistro > 0.004 && (
                    <div
                      className="text-[11px] font-bold text-violet-300"
                      title="Horas teóricas de meses sin turnos sumadas a la previsión anual"
                    >
                      +{formatHoras(liquidation.horasPendientesMesesSinRegistro)} teór.
                    </div>
                  )}
                  <div
                    className="text-[11px] font-black text-white border-t border-white/20 mt-0.5 pt-0.5"
                    title="Estimación total con la que acabará el año"
                  >
                    Prev. {formatHoras(liquidation.horasEstimadasCierreAnual)}
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-emerald-300 whitespace-nowrap">
                  {liquidation.mesesConTurnosCount > 0
                    ? formatHoras(liquidation.bolsaCompensacionFinal, true)
                    : '0,00 h'}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {formatEuro(liquidation.sumaFijo)}
                </td>
                <td className="px-3 py-3 text-right text-amber-300 whitespace-nowrap">
                  {formatEuro(liquidation.sumaPlusVac)}
                </td>
                <td className="px-3 py-3 text-right text-emerald-300 whitespace-nowrap">
                  {formatEuro(liquidation.sumaTotalBruto)}
                </td>
              </tr>
              {(((liquidation.hasCuotaManualOverride || liquidation.hasAllStatutoryVacations) &&
                !liquidation.cuotaCuadraConTeoricas) ||
                liquidation.superaLimiteAnualCuota ||
                (liquidation.superaLimiteBaseCuota && !liquidation.esJornadaCompleta)) && (
                <tr
                  className={`border-t text-xs font-semibold ${
                    liquidation.superaLimiteAnualCuota
                      ? 'bg-rose-950 text-rose-100 border-rose-700'
                      : 'bg-amber-950 text-amber-100 border-amber-700'
                  }`}
                >
                  <td colSpan={14} className="px-4 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            liquidation.superaLimiteAnualCuota ? 'text-rose-300' : 'text-amber-300'
                          }`}
                        />
                        <div className="space-y-0.5 leading-snug">
                          {(liquidation.hasCuotaManualOverride || liquidation.hasAllStatutoryVacations) &&
                            !liquidation.cuotaCuadraConTeoricas && (
                              <p>
                                <strong>Descuadre de Cuota Fija vs Horas Teóricas:</strong> la suma de{' '}
                                <span className="font-mono">{formatHoras(liquidation.sumaCuotaFija)}</span>{' '}
                                no cuadra con las{' '}
                                <span className="font-mono">
                                  {formatHoras(liquidation.sumaHorasComputoTeorico)}
                                </span>{' '}
                                de la columna izquierda (diferencia:{' '}
                                <strong className="font-mono underline">
                                  {formatHoras(liquidation.diffCuotaVsTeoricas, true)}
                                </strong>
                                {liquidation.diffCuotaVsTeoricas > 0
                                  ? ' de más sobre las teóricas'
                                  : ' pendientes por repartir'}
                                ).
                              </p>
                            )}
                          {liquidation.superaLimiteAnualCuota ? (
                            <p className="text-rose-200">
                              <strong>Límite anual superado:</strong> las cuotas fijas suman{' '}
                              <span className="font-mono">{formatHoras(liquidation.sumaCuotaFija)}</span>{' '}
                              y rebasan el tope máximo legal de{' '}
                              <span className="font-mono">
                                {formatHoras(liquidation.topeMaximoConVoluntariasAnual)}
                              </span>{' '}
                              (
                              {liquidation.esJornadaCompleta
                                ? 'máx. +80 h extras anuales en jornada 100%'
                                : `jornada ${p.jornadaPct}% + 30% base${
                                    liquidation.voluntarias15Activas
                                      ? ` + ${formatHoras(liquidation.horasVoluntarias15Activadas)} voluntarias`
                                      : ''
                                  }`}
                              ).
                            </p>
                          ) : (
                            liquidation.superaLimiteBaseCuota &&
                            !liquidation.esJornadaCompleta && (
                              <p className="text-amber-200">
                                <strong>Aviso tope +30%:</strong> la suma de cuotas supera el 30% base (
                                {formatHoras(liquidation.topeMaximoHoras30Anual)}) utilizando parte del tramo voluntario activado.
                              </p>
                            )
                          )}
                        </div>
                      </div>
                      {liquidation.hasCuotaManualOverride && (
                        <button
                          type="button"
                          onClick={handleResetCuotasManuales}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/25 text-[11px] font-bold shrink-0 self-start sm:self-center cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restablecer cuotas automáticas</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Aviso no bloqueante */}
      {toastMsg && (
        <div className="fixed bottom-20 right-5 z-50 max-w-sm rounded-xl bg-slate-900 text-white px-4 py-3 text-xs sm:text-sm font-semibold shadow-xl border border-slate-700">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
