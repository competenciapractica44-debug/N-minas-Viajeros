import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Sparkles,
  Info,
  ArrowUpRight,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { MonthlySalaryEvolution } from '../types';
import { formatCurrency } from '../utils/exporter';

interface YearlySalaryChartProps {
  data: MonthlySalaryEvolution[];
  selectedMonth: number;
  selectedYear: number;
  onSelectMonth?: (month: number) => void;
}

export const YearlySalaryChart: React.FC<YearlySalaryChartProps> = ({
  data,
  selectedMonth,
  selectedYear,
  onSelectMonth,
}) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [showGrossComparison, setShowGrossComparison] = useState(false);

  // Compute stats
  const stats = useMemo<{
    totalNet: number;
    totalGross: number;
    avgNet: number;
    maxMonth: MonthlySalaryEvolution | null;
    activeMonthData: MonthlySalaryEvolution | null;
  }>(() => {
    let totalNet = 0;
    let totalGross = 0;
    let maxNet = -Infinity;
    let maxMonth: MonthlySalaryEvolution | null = null;
    let activeMonthData: MonthlySalaryEvolution | null = null;

    data.forEach((item) => {
      totalNet += item.netSalary;
      totalGross += item.grossSalary;
      if (item.netSalary > maxNet) {
        maxNet = item.netSalary;
        maxMonth = item;
      }
      if (item.month === selectedMonth) {
        activeMonthData = item;
      }
    });

    const avgNet = data.length > 0 ? totalNet / data.length : 0;

    return {
      totalNet,
      totalGross,
      avgNet,
      maxMonth,
      activeMonthData,
    };
  }, [data, selectedMonth]);

  // Custom Tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: MonthlySalaryEvolution = payload[0].payload;
      const isCurrent = item.month === selectedMonth;

      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-md text-xs space-y-2 min-w-[210px] animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
            <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <span>{item.fullMonthName}</span>
              <span className="text-slate-400 font-normal">{item.year}</span>
            </span>
            {isCurrent && (
              <span className="text-[10px] bg-blue-500/30 text-blue-300 font-semibold px-1.5 py-0.5 rounded border border-blue-400/30">
                Seleccionado
              </span>
            )}
          </div>

          {item.hasExtraPay && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{item.extraPayName || 'Paga Extraordinaria Íntegra'}</span>
            </div>
          )}

          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Salario Neto:
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {formatCurrency(item.netSalary)}
              </span>
            </div>

            {showGrossComparison && (
              <>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Bruto Devengado:
                  </span>
                  <span className="font-mono">{formatCurrency(item.grossSalary)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Deducciones:</span>
                  <span className="font-mono text-rose-300">-{formatCurrency(item.deductions)}</span>
                </div>
              </>
            )}
          </div>

          <div className="pt-1.5 border-t border-slate-800 text-[10px] flex items-center justify-between text-slate-400">
            <span>{item.isProjected ? '📊 Estimación proyectada' : '✅ Cuadrante registrado'}</span>
            <span className="text-blue-400 font-semibold flex items-center">
              Ver nómina <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
            <TrendingUp className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
              <span>Evolución Anual del Salario Neto ({selectedYear})</span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                12 meses
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Cómputo mensual de líquido a percibir, prorratas y pagas extraordinarias
            </p>
          </div>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                chartType === 'area'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Línea</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                chartType === 'bar'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Barras</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGrossComparison(!showGrossComparison)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 ${
              showGrossComparison
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showGrossComparison ? 'Ocultar Bruto' : 'Ver Bruto vs Neto'}</span>
          </button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-0.5">
          <span className="text-[11px] font-medium text-slate-500 block truncate">Total Neto Anual</span>
          <span className="font-extrabold text-sm sm:text-base font-mono text-slate-900 block truncate">
            {formatCurrency(stats.totalNet)}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">Suma 12 mensualidades</span>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-0.5">
          <span className="text-[11px] font-medium text-emerald-800 block truncate">Media Mensual Neta</span>
          <span className="font-extrabold text-sm sm:text-base font-mono text-emerald-700 block truncate">
            {formatCurrency(stats.avgNet)}
          </span>
          <span className="text-[10px] text-emerald-600/80 block truncate">Promedio mensual líquido</span>
        </div>

        <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-0.5">
          <span className="text-[11px] font-medium text-blue-800 block truncate">
            Mes Actual ({stats.activeMonthData?.monthName})
          </span>
          <span className="font-extrabold text-sm sm:text-base font-mono text-blue-700 block truncate">
            {stats.activeMonthData ? formatCurrency(stats.activeMonthData.netSalary) : '0,00 €'}
          </span>
          <span className="text-[10px] text-blue-600/80 block truncate">
            {stats.activeMonthData?.hasExtraPay ? '⭐ Con paga extraordinaria' : 'Nómina ordinaria'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-0.5">
          <span className="text-[11px] font-medium text-amber-800 block truncate">Pico Máximo Anual</span>
          <span className="font-extrabold text-sm sm:text-base font-mono text-amber-800 block truncate">
            {stats.maxMonth ? formatCurrency(stats.maxMonth.netSalary) : '0,00 €'}
          </span>
          <span className="text-[10px] text-amber-700/80 block truncate">
            {stats.maxMonth?.monthName} {stats.maxMonth?.hasExtraPay ? '(Paga Extra)' : ''}
          </span>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="w-full h-64 sm:h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart
              data={data}
              margin={{ top: 12, right: 12, left: -14, bottom: 0 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload.length && onSelectMonth) {
                  onSelectMonth(e.activePayload[0].payload.month);
                }
              }}
            >
              <defs>
                <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="monthName"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${Math.round(val)}€`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              {showGrossComparison && (
                <Area
                  type="monotone"
                  dataKey="grossSalary"
                  name="Salario Bruto"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#grossGradient)"
                />
              )}
              <Area
                type="monotone"
                dataKey="netSalary"
                name="Salario Neto"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#netGradient)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isCurrent = payload.month === selectedMonth;
                  const hasExtra = payload.hasExtraPay;

                  if (isCurrent) {
                    return (
                      <g key={`dot-${payload.month}`}>
                        <circle cx={cx} cy={cy} r={6} fill="#059669" stroke="#ffffff" strokeWidth={2.5} />
                        <circle cx={cx} cy={cy} r={9} fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.6} />
                      </g>
                    );
                  }
                  if (hasExtra) {
                    return (
                      <circle
                        key={`dot-${payload.month}`}
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }
                  return (
                    <circle
                      key={`dot-${payload.month}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 12, right: 12, left: -14, bottom: 0 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload.length && onSelectMonth) {
                  onSelectMonth(e.activePayload[0].payload.month);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="monthName"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${Math.round(val)}€`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              {showGrossComparison && (
                <Bar
                  dataKey="grossSalary"
                  name="Salario Bruto"
                  fill="#93c5fd"
                  radius={[4, 4, 0, 0]}
                />
              )}
              <Bar dataKey="netSalary" name="Salario Neto" radius={[6, 6, 0, 0]}>
                {data.map((entry) => {
                  const isCurrent = entry.month === selectedMonth;
                  const isExtra = entry.hasExtraPay;
                  let color = '#10b981'; // default emerald
                  if (isCurrent) color = '#047857'; // dark emerald for current month
                  else if (isExtra) color = '#f59e0b'; // amber for extra pay month
                  return <Cell key={`cell-${entry.month}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Interactive Month Picker Strip / Legend */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Quick Month Jump Chips */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Meses:
          </span>
          {data.map((item) => {
            const isSelected = item.month === selectedMonth;
            return (
              <button
                key={item.month}
                type="button"
                onClick={() => onSelectMonth && onSelectMonth(item.month)}
                title={`Ver nómina de ${item.fullMonthName}`}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 flex items-center gap-0.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <span>{item.monthName}</span>
                {item.hasExtraPay && <span className="text-amber-400 text-[10px]">★</span>}
              </button>
            );
          })}
        </div>

        {/* Legend notes */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500 shrink-0 flex-wrap justify-end">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            Neto Mensual
          </span>
          {showGrossComparison && (
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              Bruto
            </span>
          )}
          <span className="flex items-center gap-1 text-amber-700">
            <span className="text-amber-500 font-bold">★</span>
            Paga Extra
          </span>
        </div>
      </div>
    </div>
  );
};
