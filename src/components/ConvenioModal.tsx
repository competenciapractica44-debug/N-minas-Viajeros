import React, { useState } from 'react';
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
} from 'lucide-react';
import { ConvenioInfo, ConvenioYearRate } from '../types';
import { generateProrrogaYearRate } from '../data/convenioZaragoza';
import { formatCurrency } from '../utils/exporter';

interface ConvenioModalProps {
  isOpen: boolean;
  onClose: () => void;
  convenio: ConvenioInfo;
  onSaveConvenio: (newConvenio: ConvenioInfo) => void;
  currentYear: number;
}

export const ConvenioModal: React.FC<ConvenioModalProps> = ({
  isOpen,
  onClose,
  convenio,
  onSaveConvenio,
  currentYear,
}) => {
  const [selectedYearTab, setSelectedYearTab] = useState<number>(currentYear || 2024);
  const [prorrogaPercent, setProrrogaPercent] = useState<number>(3.2);
  const [activeRates, setActiveRates] = useState<Record<number, ConvenioYearRate>>(
    convenio.ratesByYear
  );

  const [jsonImportError, setJsonImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentRate = activeRates[selectedYearTab] || activeRates[2026] || activeRates[2024];

  const handleRateFieldChange = (field: keyof ConvenioYearRate, value: number) => {
    setActiveRates((prev) => ({
      ...prev,
      [selectedYearTab]: {
        ...prev[selectedYearTab],
        [field]: value,
      },
    }));
  };

  const handleApplyProrroga = (targetYear: number) => {
    const baseYear = targetYear - 1;
    const baseRate = activeRates[baseYear] || activeRates[2026] || activeRates[2024];
    const newRate = generateProrrogaYearRate(baseRate, targetYear, prorrogaPercent);

    const updated = {
      ...convenio,
      isExtended: true,
      extensionNotes: `Prórroga aplicada para el año ${targetYear} con un incremento del ${prorrogaPercent}%.`,
      ratesByYear: {
        ...activeRates,
        [targetYear]: newRate,
      },
    };

    setActiveRates(updated.ratesByYear);
    setSelectedYearTab(targetYear);
    onSaveConvenio(updated);
  };

  const handleSaveAll = () => {
    onSaveConvenio({
      ...convenio,
      ratesByYear: activeRates,
    });
    onClose();
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
          onSaveConvenio(parsed);
          setActiveRates(parsed.ratesByYear);
          alert('¡Convenio y tablas actualizadas con éxito!');
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
    dlAnchorElem.setAttribute('download', `Convenio_Transporte_Zaragoza_Tablas.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Convenio Colectivo & Prórrogas
              </h2>
              <p className="text-[11px] text-slate-500">
                Transporte de Viajeros de Zaragoza (BOPZ 182 / Código 50001135011982)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Expiration Notice Box */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-950">Vigencia y Cláusula de Ultraactividad</h4>
                <p className="text-amber-800 leading-relaxed mt-0.5">
                  El convenio oficial suscrito para <strong>2023 - 2026</strong> finaliza el <strong>31 de diciembre de 2026</strong>.
                  Conforme al <strong>Artículo 4</strong>, cuenta con una ultraactividad legal de <strong>24 meses</strong> (hasta el 31 de enero de 2029).
                  Pasado este año, puedes registrar el nuevo acuerdo o aplicar una <strong>prórroga salarial</strong> automática con el incremento pactado.
                </p>
              </div>
            </div>
          </div>

          {/* Prórroga Generator Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" /> Generador de Prórroga Salarial
              </span>
              <span className="text-[11px] text-slate-500">Actualización IPC</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">
                  Incremento Pactado (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={prorrogaPercent}
                  onChange={(e) => setProrrogaPercent(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-bold font-mono py-1.5 px-3 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 block mb-1">
                  Año a Generar
                </label>
                <input
                  type="number"
                  value={2027}
                  readOnly
                  className="w-full text-xs font-bold font-mono py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-600"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleApplyProrroga(2027)}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                >
                  Generar Prórroga 2027
                </button>
              </div>
            </div>
          </div>

          {/* Year selector tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Tablas Salariales Conductor-Perceptor
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {Object.keys(activeRates)
                  .map(Number)
                  .sort()
                  .map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setSelectedYearTab(yr)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedYearTab === yr
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
              </div>
            </div>

            {/* Editable Fields Grid */}
            {currentRate && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Salario Base (€ / día)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentRate.salarioBaseDia}
                    onChange={(e) => handleRateFieldChange('salarioBaseDia', parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold py-1 px-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Hora Ordinaria (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentRate.horaOrdinaria}
                    onChange={(e) => handleRateFieldChange('horaOrdinaria', parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold py-1 px-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Plus Nocturnidad (€ / h)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentRate.plusNocturnidadHora}
                    onChange={(e) => handleRateFieldChange('plusNocturnidadHora', parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold py-1 px-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Plus Conductor-Perceptor (€ / día)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentRate.plusConductorPerceptorDia}
                    onChange={(e) => handleRateFieldChange('plusConductorPerceptorDia', parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold py-1 px-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Quebranto de Moneda (€ / día)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentRate.quebrantoMonedaDia}
                    onChange={(e) => handleRateFieldChange('quebrantoMonedaDia', parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold py-1 px-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Plus Festivos superior a 4h (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentRate.plusFestivoMayor4h}
                    onChange={(e) => handleRateFieldChange('plusFestivoMayor4h', parseFloat(e.target.value) || 0)}
                    className="w-full font-mono font-bold py-1 px-2.5 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Upload / Backup section */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Subir Nuevo Convenio (JSON)</span>
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
                <span>Copia de Seguridad</span>
              </button>
            </div>

            {jsonImportError && (
              <span className="text-rose-600 text-xs font-semibold">{jsonImportError}</span>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
          >
            Guardar Tablas
          </button>
        </div>
      </div>
    </div>
  );
};
