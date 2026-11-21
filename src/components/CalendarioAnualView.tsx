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
}) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
    () => deriveDefaultAnnualMonths(selectedYear, profile, assignments, shifts, convenio),
    [selectedYear, profile, assignments, shifts, convenio]
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
    () => calculateAnnualLiquidation(selectedYear, effectiveParams, effectiveMonths),
    [selectedYear, effectiveParams, effectiveMonths]
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
    onUpdateYearOverride(selectedYear, null);
    showToast(`Valores de ${selectedYear} sincronizados de nuevo con RutaNómina y Convenio.`);
  };

  const handleVacacionesACero = () => {
    const prevMonths = yearOverride?.monthOverrides || {};
    const nextMonths: Record<number, Partial<AnnualMonthEditableFields>> = { ...prevMonths };
    for (let i = 0; i < 12; i++) {
      nextMonths[i] = {
        ...(nextMonths[i] || {}),
        vacNat: 0,
        vacLab: 0,
      };
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
                ? `Vacaciones cuadradas: ${liquidation.totalVacNat} / ${p.vacReglamentarias} días naturales (${liquidation.totalVacLab} laborables L–V)`
                : vacPending
                ? `Faltan ${difVac} días naturales por asignar (${liquidation.totalVacNat} / ${p.vacReglamentarias} · ${liquidation.totalVacLab} L–V)`
                : `Exceso de ${Math.abs(difVac)} días naturales sobre convenio (${liquidation.totalVacNat} / ${p.vacReglamentarias} · ${liquidation.totalVacLab} L–V)`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs sm:text-sm text-slate-700">
            <span>
              Jornada:{' '}
              <strong className="text-slate-950">
                {formatHoras(liquidation.jornadaAnualEfectiva)}
              </strong>
            </span>
            <span>
              Cuota base:{' '}
              <strong className="text-slate-950">
                {formatHoras(liquidation.cuotaFijaMes)}/mes
              </strong>
            </span>
            <span>
              Media diaria:{' '}
              <strong className="text-slate-950">
                {liquidation.horasPorDiaActivo.toLocaleString('es-ES', {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}{' '}
                h/día
              </strong>
            </span>
            <span>
              Real Diario:{' '}
              <strong className="text-emerald-800">
                {formatHoras(liquidation.sumaHorasRealizadas)}
              </strong>
            </span>
            <span>
              Compensar (R−T):{' '}
              <strong
                className={
                  liquidation.bolsaCompensacionFinal > 0.004
                    ? 'text-emerald-700'
                    : liquidation.bolsaCompensacionFinal < -0.004
                    ? 'text-rose-700'
                    : 'text-slate-950'
                }
              >
                {liquidation.mesesConTurnosCount > 0
                  ? formatHoras(liquidation.bolsaCompensacionFinal, true)
                  : '0,00 h'}
              </strong>
            </span>
            <span>
              Bruto fijo anual:{' '}
              <strong className="text-blue-900">
                {formatEuro(liquidation.brutoFijoAnual)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Cuadro Numérico Completo de Liquidación */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Cuadro Numérico Completo de Liquidación {p.anio}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Horas Teóricas para cuadrar el año a 0 h junto a las Horas Realizadas del mes natural en Turnos Día y su compensación acumulada
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
                <th className="px-2 py-3 text-center whitespace-nowrap">Vacac. (Nat / L-V)</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Baja IT (Nat / L-V / Tipo)</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Días Activos</th>
                <th className="px-3 py-3 text-right whitespace-nowrap" title="Horas teóricas calculadas según días activos para cuadrar el año a 0,00 h">
                  Horas Teór.
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Cuota Fija</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Saldo Teór.</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Bolsa Teór.</th>
                <th className="px-3 py-3 text-right whitespace-nowrap bg-emerald-50 text-emerald-950" title="Suma automática de horas del mes natural en Turnos Día">
                  Horas Real. (Diario)
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap bg-emerald-50 text-emerald-950" title="Diferencia entre Horas Realizadas y Horas Teóricas (mes y acumulado)">
                  Comp. (R − T)
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Fijo Prorr.</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Plus Vac.</th>
                <th className="px-3 py-3 text-right whitespace-nowrap bg-blue-50 text-blue-950">
                  Total Bruto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {liquidation.filas.map((m) => {
                const tieneVac = m.vacNat > 0 || m.vacLab > 0;
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
                      {m.mes}
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
                      <div className="inline-flex items-center justify-center space-x-1">
                        <input
                          type="number"
                          min={0}
                          max={31}
                          step={1}
                          value={m.vacNat}
                          title="Vacaciones naturales (calcula automáticamente L–V)"
                          onChange={(e) => {
                            const natVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const maxHab = Math.max(0, m.habilesCal - m.bajaLab);
                            handleMonthFieldsChange(m.idx, {
                              vacNat: natVal,
                              vacLab: estimateWorkingDaysFromNatural(natVal, maxHab),
                            });
                          }}
                          className="w-12 text-center rounded border border-amber-300 bg-amber-50/60 px-1 py-1 text-xs font-bold text-amber-900 focus:border-amber-600 focus:outline-none"
                        />
                        <span className="text-slate-400 font-bold">/</span>
                        <input
                          type="number"
                          min={0}
                          max={31}
                          step={1}
                          value={m.vacLab}
                          title="Vacaciones laborables (L–V)"
                          onChange={(e) =>
                            handleMonthFieldChange(
                              m.idx,
                              'vacLab',
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="w-12 text-center rounded border border-amber-300 bg-amber-50/60 px-1 py-1 text-xs font-bold text-amber-900 focus:border-amber-600 focus:outline-none"
                        />
                      </div>
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
                    <td className="px-3 py-2.5 text-right text-slate-500 whitespace-nowrap">
                      {formatHoras(m.cuotaMes)}
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
                          title="Horas reales trabajadas en el mes natural desde Turnos Día (editable manualmente)"
                          onChange={(e) =>
                            handleMonthFieldChange(
                              m.idx,
                              'horasReales',
                              Math.max(0, parseFloat(e.target.value) || 0)
                            )
                          }
                          className={`w-20 text-right rounded border px-1.5 py-1 text-xs font-bold focus:outline-none ${
                            m.isHorasManual
                              ? 'border-indigo-300 bg-indigo-50/70 text-indigo-900 focus:border-indigo-600'
                              : m.turnosDiarioCount > 0
                              ? 'border-emerald-300 bg-white text-emerald-950 focus:border-emerald-600'
                              : 'border-slate-300 bg-white text-slate-600 focus:border-blue-600'
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
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {m.isHorasManual
                          ? 'Manual'
                          : m.turnosDiarioCount > 0
                          ? `${m.turnosDiarioCount} turnos · Mes nat.`
                          : 'Sin turnos'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right bg-emerald-50/35 whitespace-nowrap">
                      <div className={difClass}>
                        {m.tieneRegistroReal
                          ? formatHoras(m.diferenciaRealMes, true)
                          : '—'}
                      </div>
                      {m.tieneRegistroReal && (
                        <div className={`text-[10px] font-bold ${compAcumClass}`}>
                          Acum: {formatHoras(m.bolsaCompensacionAcumulada, true)}
                        </div>
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
                      {formatEuro(m.plusVacMes)}
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
                  {liquidation.totalVacNat} / {liquidation.totalVacLab}
                </td>
                <td className="px-2 py-3 text-center text-rose-300 whitespace-nowrap">
                  {liquidation.totalBajaNat} / {liquidation.totalBajaLab}
                </td>
                <td className="px-2 py-3 text-center whitespace-nowrap">
                  {liquidation.totalDiasActivos}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {formatHoras(liquidation.sumaHorasComputoTeorico)}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {formatHoras(liquidation.sumaCuotaFija)}
                </td>
                <td className="px-3 py-3 text-right text-cyan-300 whitespace-nowrap">
                  {formatHoras(liquidation.sumaSaldoMes, true)}
                </td>
                <td className="px-3 py-3 text-right text-cyan-300 whitespace-nowrap">
                  {formatHoras(liquidation.bolsaAcumuladaFinal, true)}
                </td>
                <td className="px-3 py-3 text-right text-emerald-300 whitespace-nowrap">
                  {formatHoras(liquidation.sumaHorasRealizadas)}
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
