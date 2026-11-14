import React from 'react';
import { Cloud, Folder, FileText, ExternalLink, Calendar, RefreshCw, X, Download, CheckCircle2 } from 'lucide-react';
import { DriveFileInfo } from '../services/googleDriveService';

interface DriveNominasModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: DriveFileInfo[];
  isLoading: boolean;
  onRefresh: () => void;
  currentMonthName: string;
  currentYear: number;
  nominasFolderUrl?: string;
  onSaveCurrentNomina: () => void;
  isSavingCurrent: boolean;
  saveSuccessMessage: string | null;
}

export const DriveNominasModal: React.FC<DriveNominasModalProps> = ({
  isOpen,
  onClose,
  files,
  isLoading,
  onRefresh,
  currentMonthName,
  currentYear,
  nominasFolderUrl,
  onSaveCurrentNomina,
  isSavingCurrent,
  saveSuccessMessage,
}) => {
  if (!isOpen) return null;

  // Filter files in Nóminas folder: show PDFs and JSONs
  const payrollFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes('nomina') ||
      f.name.toLowerCase().endsWith('.pdf') ||
      (f.name.toLowerCase().endsWith('.json') && !f.name.includes('_config') && !f.name.includes('turnos_') && !f.name.includes('convenio_'))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl">
              <Folder className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Nóminas en Google Drive</h3>
              <p className="text-xs text-blue-100">Carpeta: <strong>Direxis / Nóminas</strong></p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {nominasFolderUrl && (
              <a
                href={nominasFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                title="Abrir carpeta Direxis / Nóminas en Google Drive"
              >
                <span>Abrir carpeta</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Action: Save current month */}
          <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-900 block">
                  Archivar Nómina Actual ({currentMonthName} {currentYear})
                </span>
                <span className="text-[11px] text-blue-700">
                  Guarda la nómina oficial en PDF y el resumen de datos en tu Drive.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSaveCurrentNomina}
              disabled={isSavingCurrent}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSavingCurrent ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Subiendo a Google Drive...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>Guardar Nómina de {currentMonthName} en Drive</span>
                </>
              )}
            </button>

            {saveSuccessMessage && (
              <div className="p-2.5 bg-emerald-100/90 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{saveSuccessMessage}</span>
              </div>
            )}
          </div>

          {/* List of files in Nóminas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>Archivos guardados en Nóminas ({payrollFiles.length})</span>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {isLoading && payrollFiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-blue-600" />
                <p>Consultando tu carpeta de Google Drive...</p>
              </div>
            ) : payrollFiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
                <Folder className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">Aún no hay nóminas archivadas en esta carpeta</p>
                <p className="text-[11px] text-slate-400">
                  Usa el botón de arriba para guardar la nómina de {currentMonthName} {currentYear}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {payrollFiles.map((file) => {
                  const isPdf = file.name.toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={file.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            isPdf ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <span className="font-bold text-xs text-slate-800 block truncate" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {file.modifiedTime
                              ? new Date(file.modifiedTime).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Guardado en Drive'}
                          </span>
                        </div>
                      </div>

                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 shrink-0 transition-colors"
                          title="Abrir en Google Drive"
                        >
                          <span>Abrir</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
