import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Calendar,
  Save,
  Upload,
  Download,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Trash2,
  HelpCircle,
  Check,
  RotateCcw,
  Clock,
  Coins,
  Sun,
  Moon,
  Coffee,
  Bed,
} from 'lucide-react';
import { ConvenioInfo, ConvenioYearRate } from '../types';
import { generateProrrogaYearRate, DEFAULT_CONVENIO_ZARAGOZA } from '../data/convenioZaragoza';
import { formatCurrency } from '../utils/exporter';

interface ConvenioModalProps {
  isOpen: boolean;
  onClose: () => void;
  convenio?: ConvenioInfo;
  onSaveConvenio: (newConvenio: ConvenioInfo) => void;
  currentYear: number;
}

interface ConceptDefinition {
  key: keyof ConvenioYearRate;
  label: string;
  article?: string;
  unit: string;
  section: 'base' | 'plus' | 'dietas';
  description: string;
  isHourly?: boolean;
}

const CONCEPTS_METADATA: ConceptDefinition[] = [
  // Retribución Base y Horaria
  {
    key: 'horasJornadaAnual',
    label: 'Jornada Anual en Horas',
    article: 'Art. 14 Convenio',
    unit: 'horas / año',
    section: 'base',
    description: 'Total de horas anuales de trabajo efectivo según convenio (1.776 h anuales). Rige el cómputo de la jornada anual completa.',
  },
  {
    key: 'horaOrdinaria',
    label: 'Hora Ordinaria de Trabajo',
    article: 'Art. 18 Convenio',
    unit: '€ / hora',
    section: 'base',
    description: 'Valor de la hora ordinaria (13,62 €/h en 2026). Rige la retribución de los turnos regulares y los excesos de jornada.',
    isHourly: true,
  },
  {
    key: 'salarioBaseDia',
    label: 'Salario Base Diario',
    article: 'Art. 13 Convenio',
    unit: '€ / día',
    section: 'base',
    description: 'Salario base por día natural trabajado o de vacaciones (53,18 €/día en 2026).',
  },
  {
    key: 'salarioBaseAnual',
    label: 'Salario Base Anual',
    article: 'Art. 13 Convenio',
    unit: '€ / año',
    section: 'base',
    description: 'Retribución base anual garantizada según convenio (24.196,90 €/año en 2026).',
  },

  // Pluses del Convenio Zaragoza
  {
    key: 'plusNocturnidadHora',
    label: 'Plus de Nocturnidad (22:00 a 06:00)',
    article: 'Art. 18 Convenio',
    unit: '€ / hora nocturna',
    section: 'plus',
    description: 'Complemento de 2,48 €/hora en tramo nocturno (22:00 - 06:00). Se calcula automáticamente por cada minuto realizado.',
    isHourly: true,
  },
  {
    key: 'plusConductorPerceptorDia',
    label: 'Plus Conductor-Perceptor (≥ 4h)',
    article: 'Art. 19 Convenio',
    unit: '€ / día',
    section: 'plus',
    description: 'Por tareas simultáneas de conducción, cobro y venta de billetes en jornadas de 4 o más horas (6,27 €/día).',
  },
  {
    key: 'plusConductorPerceptorDiaReducido',
    label: 'Plus Conductor-Perceptor (< 4h)',
    article: 'Art. 19 Convenio',
    unit: '€ / día',
    section: 'plus',
    description: 'Por tareas de cobro y expedición en jornadas inferiores a 4 horas (3,14 €/día).',
  },
  {
    key: 'quebrantoMonedaDia',
    label: 'Quebranto de Moneda',
    article: 'Art. 20 Convenio',
    unit: '€ / día',
    section: 'plus',
    description: 'Compensación fija diaria por manejo y cuadre de efectivo en autocar (1,89 €/día).',
  },
  {
    key: 'plusVacacionesDia',
    label: 'Plus Vacaciones por Día',
    article: 'Art. 9 Convenio',
    unit: '€ / día de vacaciones',
    section: 'plus',
    description: 'Incentivo de 10,00 €/día de vacaciones retribuidas para contratos al 100% de jornada.',
  },
  {
    key: 'plusFestivoMayor4h',
    label: 'Plus Festivos y Domingos (> 4h)',
    article: 'Art. 17 Convenio',
    unit: '€ / servicio',
    section: 'plus',
    description: 'Plus por trabajar en domingo o festivo oficial con jornada superior a 4 horas (40,80 €/servicio).',
  },
  {
    key: 'plusFestivoMenor4h',
    label: 'Plus Festivos y Domingos (≤ 4h)',
    article: 'Art. 17 Convenio',
    unit: '€ / servicio',
    section: 'plus',
    description: 'Plus por trabajar en domingo o festivo oficial con jornada de hasta 4 horas (30,60 €/servicio).',
  },
  {
    key: 'plus24y31Diciembre',
    label: 'Plus Especial 24 y 31 de Diciembre',
    article: 'Art. 17 Convenio',
    unit: '€ / servicio',
    section: 'plus',
    description: 'Plus extraordinario por prestar servicio en Nochebuena o Nochevieja (30,60 €/servicio).',
  },

  // Dietas y Manutención
  {
    key: 'dietaComidaCenaRegular',
    label: 'Comida o Cena Línea Regular',
    article: 'Art. 23 Convenio',
    unit: '€ / servicio',
    section: 'dietas',
    description: 'Dieta de manutención en servicios de línea regular (15,00 €).',
  },
  {
    key: 'dietaComidaCenaDiscrecional',
    label: 'Comida o Cena Discrecional',
    article: 'Art. 23 Convenio',
    unit: '€ / servicio',
    section: 'dietas',
    description: 'Dieta en servicios discrecionales, circuitos o transporte de fábricas (19,00 €).',
  },
  {
    key: 'dietaPernoctaRegular',
    label: 'Pernocta Línea Regular',
    article: 'Art. 23 Convenio',
    unit: '€ / noche',
    section: 'dietas',
    description: 'Compensación por pernocta fuera del domicilio habitual en línea regular (12,27 €).',
  },
  {
    key: 'dietaPernoctaDiscrecional',
    label: 'Pernocta Discrecional',
    article: 'Art. 23 Convenio',
    unit: '€ / noche',
    section: 'dietas',
    description: 'Compensación por pernocta en viajes discrecionales o de largo recorrido (16,25 €).',
  },
];

export const ConvenioModal: React.FC<ConvenioModalProps> = ({
  isOpen,
  onClose,
  convenio = DEFAULT_CONVENIO_ZARAGOZA,
  onSaveConvenio,
  currentYear = 2026,
}) => {
  // Build clean sanitized rates record starting at 2026
  const getCleanedRates = (): Record<number, ConvenioYearRate> => {
    const cleaned: Record<number, ConvenioYearRate> = {};
    const default2026 = DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026];

    const source = convenio?.ratesByYear || {};
    Object.entries(source).forEach(([k, v]) => {
      const y = Number(k);
      if (y >= 2026 && v) {
        cleaned[y] = {
          ...default2026,
          ...v,
          year: y,
        };
      }
    });

    if (!cleaned[2026]) {
      cleaned[2026] = { ...default2026 };
    }
    return cleaned;
  };

  const [activeRates, setActiveRates] = useState<Record<number, ConvenioYearRate>>(getCleanedRates);
  const [selectedYearTab, setSelectedYearTab] = useState<number>(() => {
    return currentYear >= 2026 ? currentYear : 2026;
  });

  // Re-synchronize state whenever modal opens or props update
  useEffect(() => {
    if (isOpen) {
      const cleaned = getCleanedRates();
      setActiveRates(cleaned);
      const targetYear = currentYear >= 2026 && cleaned[currentYear] ? currentYear : 2026;
      setSelectedYearTab(targetYear);
      setIsAddingNewYear(false);
      setShowConfirmModal(false);
      setSaveSuccessMessage(null);
      setYearToDelete(null);
    }
  }, [isOpen, convenio, currentYear]);

  // New Year Creation Drawer State
  const [isAddingNewYear, setIsAddingNewYear] = useState(false);
  const [newYearTarget, setNewYearTarget] = useState<number>(2027);
  const [newYearCreationMode, setNewYearCreationMode] = useState<'copy' | 'prorroga'>('copy');
  const [prorrogaPercent, setProrrogaPercent] = useState<number>(3.0);

  // Confirmation Modal State (required for existing edits and new years)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Safe fallback to guarantee currentRate is ALWAYS a valid complete ConvenioYearRate
  const default2026 = DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026];
  const currentRate: ConvenioYearRate = {
    ...default2026,
    ...(activeRates[selectedYearTab] || activeRates[2026] || {}),
    year: selectedYearTab,
  };

  const originalSavedRate = convenio?.ratesByYear?.[selectedYearTab];
  const isBrandNewYear = !originalSavedRate;

  // Track differences between editable draft and original saved rate
  const differences = CONCEPTS_METADATA.map((meta) => {
    const oldVal = originalSavedRate ? (originalSavedRate[meta.key] as number) : undefined;
    const newVal = (currentRate[meta.key] ?? default2026[meta.key] ?? 0) as number;
    const hasChanged = isBrandNewYear || (oldVal !== undefined && oldVal !== newVal);
    return {
      ...meta,
      oldVal,
      newVal,
      hasChanged,
    };
  });

  const hasAnyPendingChanges = differences.some((d) => d.hasChanged);

  const handleRateFieldChange = (field: keyof ConvenioYearRate, value: number) => {
    setSaveSuccessMessage(null);
    setActiveRates((prev) => {
      const existingYear = prev[selectedYearTab] || { ...default2026, year: selectedYearTab };
      return {
        ...prev,
        [selectedYearTab]: {
          ...existingYear,
          [field]: value,
        },
      };
    });
  };

  // Prepares the creation of a new year
  const handleCreateNewYearDraft = () => {
    const baseYear = selectedYearTab || 2026;
    const baseRate = activeRates[baseYear] || activeRates[2026] || default2026;

    let newDraftRate: ConvenioYearRate;
    if (newYearCreationMode === 'prorroga') {
      newDraftRate = generateProrrogaYearRate(baseRate, newYearTarget, prorrogaPercent);
    } else {
      newDraftRate = {
        ...baseRate,
        year: newYearTarget,
      };
    }

    setActiveRates((prev) => ({
      ...prev,
      [newYearTarget]: newDraftRate,
    }));
    setSelectedYearTab(newYearTarget);
    setIsAddingNewYear(false);
    setSaveSuccessMessage(`Borrador del año ${newYearTarget} generado. Puedes revisar y modificar cualquier concepto antes de confirmarlo.`);
  };

  // Restores 2026 values to official published BOPZ tables
  const handleRestoreDefaults = () => {
    setActiveRates((prev) => ({
      ...prev,
      2026: { ...DEFAULT_CONVENIO_ZARAGOZA.ratesByYear[2026] },
    }));
    setSelectedYearTab(2026);
    setSaveSuccessMessage('Valores de 2026 restablecidos según las tablas oficiales del BOPZ.');
  };

  // Confirms and applies changes permanently across the app
  const handleConfirmAndSave = () => {
    const updatedRates: Record<number, ConvenioYearRate> = {};
    Object.entries(activeRates).forEach(([k, v]) => {
      const y = Number(k);
      if (y >= 2026 && v) {
        updatedRates[y] = { ...v, year: y };
      }
    });

    if (!updatedRates[2026]) {
      updatedRates[2026] = { ...default2026 };
    }

    const updatedConvenio: ConvenioInfo = {
      title: convenio?.title || DEFAULT_CONVENIO_ZARAGOZA.title,
      bopzNumber: convenio?.bopzNumber || DEFAULT_CONVENIO_ZARAGOZA.bopzNumber,
      publicationDate: convenio?.publicationDate || DEFAULT_CONVENIO_ZARAGOZA.publicationDate,
      validFrom: '2026-01-01',
      validTo: `${Math.max(...Object.keys(updatedRates).map(Number), 2026)}-12-31`,
      ultractividadTo: '2029-01-31',
      isExpired: false,
      isExtended: Object.keys(updatedRates).some((y) => Number(y) > 2026),
      extensionNotes: `Tablas salariales actualizadas para el año ${selectedYearTab}.`,
      ratesByYear: updatedRates,
    };

    onSaveConvenio(updatedConvenio);
    setShowConfirmModal(false);
    setSaveSuccessMessage(`✅ Importes del año ${selectedYearTab} confirmados y aplicados en toda la aplicación.`);
  };

  const handleDeleteYear = (year: number) => {
    if (year === 2026) return; // Base year cannot be deleted
    const updated = { ...activeRates };
    delete updated[year];
    setActiveRates(updated);
    setSelectedYearTab(2026);
    setYearToDelete(null);

    const updatedConvenio: ConvenioInfo = {
      ...convenio,
      ratesByYear: updated,
    };
    onSaveConvenio(updatedConvenio);
    setSaveSuccessMessage(`Se han eliminado las tablas del año ${year}.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJsonImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.ratesByYear) {
          const cleaned: Record<number, ConvenioYearRate> = {};
          Object.entries(parsed.ratesByYear).forEach(([k, v]) => {
            const y = Number(k);
            if (y >= 2026 && v) {
              cleaned[y] = { ...default2026, ...(v as ConvenioYearRate), year: y };
            }
          });
          if (!cleaned[2026]) cleaned[2026] = { ...default2026 };
          const newConv = { ...parsed, validFrom: '2026-01-01', ratesByYear: cleaned };
          onSaveConvenio(newConv);
          setActiveRates(cleaned);
          setSaveSuccessMessage('¡Convenio importado con éxito!');
        } else {
          setJsonImportError('El archivo no tiene el formato de tablas requerido.');
        }
      } catch (err) {
        setJsonImportError('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(convenio, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `Convenio_Transporte_Zaragoza_Tablas_${selectedYearTab}.json`);
    dlAnchorElem.click();
  };

  const sortedYears = Object.keys(activeRates)
    .map(Number)
    .filter((y) => y >= 2026)
    .sort((a, b) => a - b);

  if (!sortedYears.includes(2026)) {
    sortedYears.unshift(2026);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Convenio Colectivo de Transporte
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                  Año {selectedYearTab}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Transporte de Viajeros por Carretera de Zaragoza · BOPZ Núm. 182 / Código 50001135011982
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Cerrar ventana"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Success Banner */}
          {saveSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{saveSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}

          {/* Year selector tabs & Add year button */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Año:
                </span>
                {sortedYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setSelectedYearTab(yr);
                      setIsAddingNewYear(false);
                      setSaveSuccessMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      selectedYearTab === yr
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <span>{yr}</span>
                    {yr === 2026 && (
                      <span className={`text-[9px] px-1 py-0.5 rounded font-normal ${selectedYearTab === yr ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                        Base
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {selectedYearTab === 2026 && (
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    title="Restablecer tablas originales de 2026"
                    className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Oficial BOPZ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewYear(!isAddingNewYear);
                    const nextYr = (sortedYears[sortedYears.length - 1] || 2026) + 1;
                    setNewYearTarget(nextYr);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Añadir Año</span>
                </button>
              </div>
            </div>

            {/* Inline drawer to add a new year */}
            {isAddingNewYear && (
              <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-sm space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Crear nuevo año de tarifas
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewYear(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Año a Crear
                    </label>
                    <input
                      type="number"
                      min={2026}
                      max={2035}
                      value={newYearTarget}
                      onChange={(e) => setNewYearTarget(parseInt(e.target.value, 10) || 2027)}
                      className="w-full text-xs font-bold font-mono py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Método Inicial
                    </label>
                    <select
                      value={newYearCreationMode}
                      onChange={(e) => setNewYearCreationMode(e.target.value as any)}
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="copy">Copiar importes de {selectedYearTab}</option>
                      <option value="prorroga">Aplicar incremento IPC pactado</option>
                    </select>
                  </div>

                  {newYearCreationMode === 'prorroga' ? (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Incremento IPC (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={prorrogaPercent}
                          onChange={(e) => setProrrogaPercent(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold font-mono py-2 px-3 rounded-xl border border-slate-200"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end">
                      <p className="text-[11px] text-slate-500 pb-2">
                        Se partirá de una copia que podrás editar campo a campo.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewYear(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNewYearDraft}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
                  >
                    Generar Borrador {newYearTarget}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RESUMEN EJECUTIVO DE CONCEPTOS DEL CONVENIO               */}
          {/* ========================================================= */}
          <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/60 rounded-2xl p-4 border border-blue-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Resumen de Conceptos Cubiertos por el Convenio ({selectedYearTab})
                </h3>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                Modificables abajo
              </span>
            </div>

            {/* Grid of Highlight Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Jornada Anual */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-blue-100 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-medium block">Jornada Anual (Art. 14)</span>
                <span className="text-sm font-extrabold text-blue-900 font-mono">
                  {currentRate.horasJornadaAnual || 1776} h
                </span>
                <span className="text-[10px] text-slate-500 block truncate">Horas anuales pactadas</span>
              </div>

              {/* Hora Ordinaria */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-blue-100 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-medium block">Hora Ordinaria (Art. 18)</span>
                <span className="text-sm font-extrabold text-blue-900 font-mono">
                  {formatCurrency(currentRate.horaOrdinaria || 13.62)}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">Retribución base/hora</span>
              </div>

              {/* Salario Base Diario */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-blue-100 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-medium block">Salario Base (Art. 13)</span>
                <span className="text-sm font-extrabold text-blue-900 font-mono">
                  {formatCurrency(currentRate.salarioBaseDia || 53.18)}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">€ / día natural</span>
              </div>

              {/* Nocturnidad */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-purple-100 shadow-2xs bg-purple-50/40">
                <span className="text-[10px] text-purple-700 font-medium block">Nocturnidad 22-06h (Art. 18)</span>
                <span className="text-sm font-extrabold text-purple-900 font-mono">
                  +{formatCurrency(currentRate.plusNocturnidadHora || 2.48)}
                </span>
                <span className="text-[10px] text-purple-600 block truncate">€ / hora nocturna</span>
              </div>

              {/* Plus Vacaciones */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-cyan-100 shadow-2xs">
                <span className="text-[10px] text-cyan-800 font-medium block">Plus Vacaciones (Art. 9)</span>
                <span className="text-sm font-extrabold text-cyan-900 font-mono">
                  +{formatCurrency(currentRate.plusVacacionesDia || 10.00)}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">€ / día de vacaciones</span>
              </div>

              {/* Conductor-Perceptor */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-blue-100 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-medium block">Cond.-Perceptor (Art. 19)</span>
                <span className="text-sm font-extrabold text-blue-900 font-mono">
                  +{formatCurrency(currentRate.plusConductorPerceptorDia || 6.27)}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">€ / día (jornada ≥4h)</span>
              </div>

              {/* Quebranto Moneda */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-blue-100 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-medium block">Quebranto (Art. 20)</span>
                <span className="text-sm font-extrabold text-blue-900 font-mono">
                  +{formatCurrency(currentRate.quebrantoMonedaDia || 1.89)}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">€ / día manejo efectivo</span>
              </div>

              {/* Plus Festivo */}
              <div className="bg-white/95 rounded-xl p-2.5 border border-amber-100 shadow-2xs">
                <span className="text-[10px] text-amber-800 font-medium block">Plus Festivos (Art. 17)</span>
                <span className="text-sm font-extrabold text-amber-900 font-mono">
                  +{formatCurrency(currentRate.plusFestivoMayor4h || 40.80)}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">Domingos y festivos</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* FORMULARIO EDITABLE DE TODOS LOS CONCEPTOS DEL CONVENIO    */}
          {/* ========================================================= */}
          <div className="space-y-4 pt-1">
            {/* SECCIÓN 1: RETRIBUCIÓN BASE Y HORAS ANUALES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  1. Horas Anuales y Retribución Base ({selectedYearTab})
                </h3>
                <span className="text-[10px] text-slate-400">Valores oficiales según convenio</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CONCEPTS_METADATA.filter((c) => c.section === 'base').map((item) => (
                  <div
                    key={item.key}
                    className={`p-3 rounded-2xl border transition-all ${
                      item.key === 'horaOrdinaria' || item.key === 'horasJornadaAnual'
                        ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-300/40'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        {item.label}
                        {item.article && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold">
                            {item.article}
                          </span>
                        )}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{item.unit}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2 leading-tight">{item.description}</p>
                    <div className="relative">
                      <input
                        type="number"
                        step={item.unit.includes('horas') ? '1' : '0.01'}
                        value={currentRate[item.key] ?? default2026[item.key] ?? 0}
                        onChange={(e) => handleRateFieldChange(item.key, parseFloat(e.target.value) || 0)}
                        className="w-full text-base font-black font-mono py-1.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {item.unit.includes('horas') ? 'h' : '€'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 2: PLUSES Y COMPLEMENTOS DEL SECTOR */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  2. Pluses y Complementos Salariales ({selectedYearTab})
                </h3>
                <span className="text-[10px] text-slate-400">Art. 9, 17, 18, 19, 20</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CONCEPTS_METADATA.filter((c) => c.section === 'plus').map((item) => (
                  <div
                    key={item.key}
                    className={`p-3 rounded-2xl border transition-all ${
                      item.key === 'plusNocturnidadHora'
                        ? 'bg-purple-50/50 border-purple-200'
                        : item.key === 'plusVacacionesDia'
                        ? 'bg-cyan-50/40 border-cyan-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        {item.label}
                        {item.article && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold">
                            {item.article}
                          </span>
                        )}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{item.unit}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2 leading-tight">{item.description}</p>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={currentRate[item.key] ?? default2026[item.key] ?? 0}
                        onChange={(e) => handleRateFieldChange(item.key, parseFloat(e.target.value) || 0)}
                        className="w-full text-base font-black font-mono py-1.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 3: DIETAS Y GASTOS DE MANUTENCIÓN */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-emerald-600" />
                  3. Dietas y Gastos de Manutención ({selectedYearTab})
                </h3>
                <span className="text-[10px] text-slate-400">Art. 23 Convenio Zaragoza</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CONCEPTS_METADATA.filter((c) => c.section === 'dietas').map((item) => (
                  <div key={item.key} className="p-3 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        {item.label}
                        {item.article && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold">
                            {item.article}
                          </span>
                        )}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{item.unit}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2 leading-tight">{item.description}</p>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={currentRate[item.key] ?? default2026[item.key] ?? 0}
                        onChange={(e) => handleRateFieldChange(item.key, parseFloat(e.target.value) || 0)}
                        className="w-full text-base font-black font-mono py-1.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete year button (only for added years > 2026) */}
            {selectedYearTab > 2026 && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setYearToDelete(selectedYearTab)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar tablas del año {selectedYearTab}</span>
                </button>
              </div>
            )}
          </div>

          {/* Upload / Backup section */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Importar Convenio (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exportar Copia JSON</span>
              </button>
            </div>

            {jsonImportError && (
              <span className="text-rose-600 text-xs font-semibold">{jsonImportError}</span>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 sticky bottom-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {hasAnyPendingChanges ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold text-[11px]">
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                Cambios pendientes de confirmar
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Tablas sincronizadas para {selectedYearTab}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Importes Año {selectedYearTab}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: Always asks for explicit confirmation before saving any changes */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {isBrandNewYear
                      ? `Confirmar Nuevo Año ${selectedYearTab}`
                      : `Confirmar Importes para el Año ${selectedYearTab}`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Revisa todos los importes configurados antes de aplicarlos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Table */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900">
                <p className="font-semibold text-amber-950 mb-0.5">
                  ¿Confirmas estos importes para el año {selectedYearTab}?
                </p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Al confirmar, estos valores regirán automáticamente el cálculo de las horas ordinarias, nocturnas (22:00 a 06:00), cuadrante del calendario y nóminas para el ejercicio <strong>{selectedYearTab}</strong>.
                </p>
              </div>

              {/* Table of all concepts with comparison */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <div className="bg-slate-100/80 px-3 py-2 font-bold text-slate-700 grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wider">
                  <span className="col-span-6">Concepto Retributivo</span>
                  <span className="col-span-3 text-right">Anterior</span>
                  <span className="col-span-3 text-right">Nuevo a Aplicar</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {differences.map((item) => (
                    <div
                      key={item.key}
                      className={`px-3 py-2 grid grid-cols-12 gap-2 items-center transition-colors ${
                        item.hasChanged ? 'bg-emerald-50/50' : 'bg-white'
                      }`}
                    >
                      <div className="col-span-6">
                        <span className="font-semibold text-slate-800 block leading-tight">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.article || item.unit}
                        </span>
                      </div>

                      <div className="col-span-3 text-right text-slate-500 font-mono text-xs">
                        {item.oldVal !== undefined
                          ? item.unit.includes('horas')
                            ? `${item.oldVal} h`
                            : formatCurrency(item.oldVal)
                          : '—'}
                      </div>

                      <div className="col-span-3 text-right font-mono font-bold text-xs flex items-center justify-end gap-1">
                        <span className={item.hasChanged ? 'text-emerald-700' : 'text-slate-800'}>
                          {item.unit.includes('horas') ? `${item.newVal} h` : formatCurrency(item.newVal)}
                        </span>
                        {item.hasChanged && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0" title="Modificado" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Volver a Revisar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSave}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Sí, Confirmar y Aplicar Importes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Year Confirmation Modal */}
      {yearToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Eliminar tablas de {yearToDelete}</h4>
                <p className="text-xs text-slate-500">¿Deseas retirar este año de la aplicación?</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Se eliminarán las tarifas configuradas para <strong>{yearToDelete}</strong>. Podrás volver a darlo de alta cuando lo necesites.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setYearToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteYear(yearToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
