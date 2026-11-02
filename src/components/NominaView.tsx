import React from 'react';
import {
  FileText,
  Table as TableIcon,
  Download,
  ShieldCheck,
  TrendingUp,
  Percent,
  Sliders,
  AlertCircle,
  Clock,
  Coins,
} from 'lucide-react';
import {
  PayrollBreakdown,
  WorkerProfile,
  ConvenioInfo,
} from '../types';
import { formatCurrency } from '../utils/exporter';

interface NominaViewProps {
  payroll: PayrollBreakdown;
  profile: WorkerProfile;
  convenio: ConvenioInfo;
  monthName: string;
  onUpdateProfile: (partial: Partial<WorkerProfile>) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

export const NominaView: React.FC<NominaViewProps> = ({
  payroll,
  profile,
  convenio,
  monthName,
  onUpdateProfile,
  onExportPDF,
  onExportExcel,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* Hero Card: Líquido Total a Percibir (Net Pay) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Líquido Total a Percibir (Neto)
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
              {formatCurrency(payroll.liquidoPercibir)}
            </div>
            <p className="text-xs text-slate-300">
              Período: <strong>{monthName} {payroll.year}</strong> · {payroll.workedDays} jornadas computadas
            </p>
          </div>

          {/* Quick Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onExportPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={onExportExcel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/15 transition-colors"
            >
              <TableIcon className="w-4 h-4 text-emerald-400" />
              <span>Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Mini KPI row inside hero card */}
        <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 text-[11px] block">Total Bruto Devengado</span>
            <span className="font-bold text-white font-mono text-sm">{formatCurrency(payroll.totalDevengado)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Total Deducciones</span>
            <span className="font-bold text-rose-300 font-mono text-sm">-{formatCurrency(payroll.totalDeducido)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Base Cotización S.S.</span>
            <span className="font-bold text-slate-200 font-mono text-sm">{formatCurrency(payroll.baseCotizacionSS)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block">Horas Nocturnas (22-06h)</span>
            <span className="font-bold text-amber-300 font-mono text-sm">{payroll.nightHours} horas</span>
          </div>
        </div>
      </div>

      {/* Interactive IRPF Withholding Control */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900">
              Retención de I.R.P.F. Trabajador
            </span>
          </div>
          <span className="font-bold font-mono text-sm text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200/60">
            {profile.irpfPercentage.toFixed(1)}% ({formatCurrency(payroll.retencionIrpfImporte)})
          </span>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <span className="text-[10px] text-slate-400 font-mono">2%</span>
          <input
            type="range"
            min={2}
            max={28}
            step={0.5}
            value={profile.irpfPercentage}
            onChange={(e) => onUpdateProfile({ irpfPercentage: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 font-mono">28%</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Ajusta tu porcentaje de retención para calcular el impacto inmediato en el líquido mensual a percibir.
        </p>
      </div>

      {/* Detailed Section: Devengos vs Deducciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DEVENGOS (Percepciones Salariales) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" /> I. Devengos Salariales
            </h3>
            <span className="text-xs font-extrabold text-emerald-700 font-mono">
              {formatCurrency(payroll.totalDevengado)}
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-semibold text-slate-800">Salario Base Convenio</p>
                <p className="text-[10px] text-slate-400">{payroll.workedDays} días x {formatCurrency(convenio.ratesByYear[payroll.year]?.salarioBaseDia || 50.37)}</p>
              </div>
              <span className="font-bold font-mono text-slate-900">{formatCurrency(payroll.salarioBase)}</span>
            </div>

            {payroll.plusTomaDeje > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Toma y Deje / Tarifa BD</p>
                  <p className="text-[10px] text-slate-400">Inspección, tacógrafo y repostaje</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusTomaDeje)}</span>
              </div>
            )}

            {payroll.plusConductorPerceptor > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Conductor-Perceptor (Art. 19)</p>
                  <p className="text-[10px] text-slate-400">6,27 € por jornada completa</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusConductorPerceptor)}</span>
              </div>
            )}

            {payroll.plusQuebrantoMoneda > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Quebranto de Moneda (Art. 20)</p>
                  <p className="text-[10px] text-slate-400">1,89 € por día de cobro/taquilla</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusQuebrantoMoneda)}</span>
              </div>
            )}

            {payroll.plusNocturnidad > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Nocturnidad (Art. 18)</p>
                  <p className="text-[10px] text-slate-400">{payroll.nightHours}h en tramo 22:00-06:00 x 2,48 €/h</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusNocturnidad)}</span>
              </div>
            )}

            {payroll.plusFestivos > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Plus Festivos y Domingos (Art. 17)</p>
                  <p className="text-[10px] text-slate-400">{payroll.holidayDays} festivos / domingos trabajados</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.plusFestivos)}</span>
              </div>
            )}

            {payroll.prorrataPagasExtra > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Prorrata Pagas Extras (Art. 11)</p>
                  <p className="text-[10px] text-slate-400">3 pagas anuales (Marzo, Julio, Navidad)</p>
                </div>
                <span className="font-bold font-mono text-emerald-700">+{formatCurrency(payroll.prorrataPagasExtra)}</span>
              </div>
            )}

            {payroll.totalExtrasFueraConvenio > 0 && (
              <div className="flex items-center justify-between pt-2 bg-amber-50/50 p-2 rounded-xl">
                <div>
                  <p className="font-semibold text-amber-900">Complementos Fuera de Convenio</p>
                  <p className="text-[10px] text-amber-700">Conceptos pactados asignados</p>
                </div>
                <span className="font-bold font-mono text-amber-800">+{formatCurrency(payroll.totalExtrasFueraConvenio)}</span>
              </div>
            )}
          </div>
        </div>

        {/* DEDUCCIONES (Impuestos y Seguridad Social) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-rose-600" /> II. Deducciones y Tributos
            </h3>
            <span className="text-xs font-extrabold text-rose-700 font-mono">
              -{formatCurrency(payroll.totalDeducido)}
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-semibold text-slate-800">Contingencias Comunes</p>
                <p className="text-[10px] text-slate-400">4,70% sobre base {formatCurrency(payroll.baseCotizacionSS)}</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.contingenciasComunes)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Desempleo Trabajador</p>
                <p className="text-[10px] text-slate-400">{profile.contractType === 'temporal' ? '1,60%' : '1,55%'} (Régimen General)</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.desempleo)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Formación Profesional</p>
                <p className="text-[10px] text-slate-400">0,10% sobre base</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.formacionProfesional)}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-slate-800">Mecanismo Equidad Intergeneracional (MEI)</p>
                <p className="text-[10px] text-slate-400">Cotización obligatoria de pensiones</p>
              </div>
              <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.mei)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 bg-blue-50/50 p-2 rounded-xl">
              <div>
                <p className="font-semibold text-blue-900">Retención I.R.P.F.</p>
                <p className="text-[10px] text-blue-700">{payroll.retencionIrpf}% sobre base tributable</p>
              </div>
              <span className="font-bold font-mono text-blue-800">-{formatCurrency(payroll.retencionIrpfImporte)}</span>
            </div>

            {payroll.cuotaSindical > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-slate-800">Cuota Sindical (Art. 36)</p>
                  <p className="text-[10px] text-slate-400">Deducción nómina autorizada</p>
                </div>
                <span className="font-bold font-mono text-slate-900">-{formatCurrency(payroll.cuotaSindical)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coste Empresa Informativo Card */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 uppercase tracking-wide">
            Coste Total Empresa Estimado (Aportación Patronal)
          </span>
          <span className="font-extrabold font-mono text-slate-900">
            {formatCurrency(payroll.totalCosteEmpresa)}
          </span>
        </div>
        <p className="text-slate-500 leading-relaxed text-[11px]">
          Incluye cotizaciones empresariales a la Seguridad Social (23,60% CC + 5,50% Desempleo + 0,60% FP + 0,20% FOGASA + MEI).
        </p>
      </div>
    </div>
  );
};
