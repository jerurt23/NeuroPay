import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, BarChart3, LineChart, PieChart, Layers } from 'lucide-react';
import { Transaction, CategoryInfo, Budget, BankEmail, ChartType } from '../types/index.ts';
import { calculateTotals } from '../utils/budgetCalculations.ts';
import {
  getCategoryBreakdown,
  getDashboardMeasures,
  sumMeasures,
  MeasureTotal,
} from '../utils/dashboardMeasures.ts';

interface DashboardViewProps {
  transactions: Transaction[];
  categories: CategoryInfo[];
  customCategories?: { id: string; name: string }[];
  dashboardGroups?: Record<string, string>;
  budgets: Budget[];
  bankEmails: BankEmail[];
  currencySymbol: string;
  chartType?: ChartType;
  onChartTypeChange?: (t: ChartType) => void;
  onOpenNewTransaction: () => void;
}

type PeriodFilter = 'day' | 'week' | 'month' | 'year';

/** Un periodo del grafico: un dia, una semana, un mes o un año. */
interface Bucket {
  label: string;
  match: (t: Transaction) => boolean;
}

interface BucketData {
  label: string;
  income: number;
  expense: number;
  measures: Record<string, MeasureTotal>;
}

interface Segment {
  key: string;
  label: string;
  color: string;
  value: number;
}

const INCOME_COLOR = '#34d399';
const EXPENSE_COLOR = '#fb7185';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const RANGE_LABEL: Record<PeriodFilter, string> = {
  day: 'últimos 7 días',
  week: 'últimas 4 semanas',
  month: 'últimos 6 meses',
  year: 'últimos 4 años',
};

function buildBuckets(period: PeriodFilter, now: Date): Bucket[] {
  const out: Bucket[] = [];

  if (period === 'day') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      out.push({
        label: d.toLocaleDateString('es', { weekday: 'short' }),
        match: (t) => t.date === dateStr,
      });
    }
  } else if (period === 'week') {
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start.getTime() + WEEK_MS);
      out.push({
        label: `Sem ${4 - i}`,
        match: (t) => {
          const d = new Date(t.date);
          return d >= start && d < end;
        },
      });
    }
  } else if (period === 'month') {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toISOString().slice(0, 7);
      out.push({
        label: d.toLocaleDateString('es', { month: 'short' }),
        match: (t) => t.date.startsWith(monthStr),
      });
    }
  } else {
    for (let i = 3; i >= 0; i--) {
      const year = String(now.getFullYear() - i);
      out.push({ label: year, match: (t) => t.date.startsWith(year) });
    }
  }

  return out;
}

const sumAmount = (list: Transaction[]) => list.reduce((s, t) => s + t.amount, 0);

/**
 * Reparte un total en ingresos, las medidas (que son parte de los egresos)
 * y el resto de egresos. Asi el apilado y el circular suman bien.
 */
function segmentsOf(
  income: number,
  expense: number,
  parts: { key: string; label: string; color: string; amount: number }[]
): Segment[] {
  const measured = parts.reduce((s, p) => s + p.amount, 0);
  return [
    { key: 'income', label: 'Ingresos', color: INCOME_COLOR, value: income },
    ...parts.map((p) => ({ key: p.key, label: p.label, color: p.color, value: p.amount })),
    {
      key: 'other',
      label: parts.length > 0 ? 'Otros egresos' : 'Egresos',
      color: EXPENSE_COLOR,
      value: Math.max(expense - measured, 0),
    },
  ];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  categories,
  customCategories,
  dashboardGroups,
  budgets,
  bankEmails,
  currencySymbol,
  chartType = 'bar',
  onChartTypeChange,
  onOpenNewTransaction,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [showTypePicker, setShowTypePicker] = useState(false);

  const localChartType = chartType;

  // Cerrar el menu con Escape y bloquear el scroll de fondo
  useEffect(() => {
    if (!showTypePicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTypePicker(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showTypePicker]);

  const totals = calculateTotals(transactions);

  // Categorias personalizadas que el usuario eligio mostrar. Cada una es un valor medible.
  const measures = useMemo(
    () => getDashboardMeasures(customCategories, dashboardGroups),
    [customCategories, dashboardGroups]
  );

  // Datos de cada periodo del grafico
  const chartData = useMemo<BucketData[]>(
    () =>
      buildBuckets(periodFilter, new Date()).map((b) => {
        const txs = transactions.filter(b.match);
        return {
          label: b.label,
          income: sumAmount(txs.filter((t) => t.type === 'income')),
          expense: sumAmount(txs.filter((t) => t.type === 'expense')),
          measures: sumMeasures(txs, measures),
        };
      }),
    [transactions, periodFilter, measures]
  );

  // Series para lineas y barras: ingresos, egresos y cada valor medible
  const series = useMemo(
    () => [
      { key: 'income', label: 'Ingresos', color: INCOME_COLOR, value: (d: BucketData) => d.income },
      { key: 'expense', label: 'Egresos', color: EXPENSE_COLOR, value: (d: BucketData) => d.expense },
      ...measures.map((m) => ({
        key: m.id,
        label: m.name,
        color: m.color,
        value: (d: BucketData) => d.measures[m.id]?.amount ?? 0,
      })),
    ],
    [measures]
  );

  const maxChartValue = Math.max(1, ...chartData.flatMap((d) => series.map((s) => s.value(d))));

  // Totales del periodo visible
  const periodTotals = useMemo(() => {
    const income = chartData.reduce((s, d) => s + d.income, 0);
    const expense = chartData.reduce((s, d) => s + d.expense, 0);
    const measureTotals = measures.map((m) => ({
      measure: m,
      amount: chartData.reduce((s, d) => s + (d.measures[m.id]?.amount ?? 0), 0),
      count: chartData.reduce((s, d) => s + (d.measures[m.id]?.count ?? 0), 0),
    }));
    return { income, expense, measureTotals };
  }, [chartData, measures]);

  const rangeSegments = segmentsOf(
    periodTotals.income,
    periodTotals.expense,
    periodTotals.measureTotals.map((x) => ({
      key: x.measure.id,
      label: x.measure.name,
      color: x.measure.color,
      amount: x.amount,
    }))
  );

  const bucketSegments = (d: BucketData) =>
    segmentsOf(
      d.income,
      d.expense,
      measures.map((m) => ({
        key: m.id,
        label: m.name,
        color: m.color,
        amount: d.measures[m.id]?.amount ?? 0,
      }))
    );

  // Circular: el arco de cada segmento empieza donde termina el anterior
  const C = 2 * Math.PI * 60;
  const pieTotal = rangeSegments.reduce((s, x) => s + x.value, 0);
  const arcs: { seg: Segment; len: number; offset: number }[] = [];
  let acc = 0;
  rangeSegments.forEach((seg) => {
    if (seg.value <= 0) return;
    arcs.push({ seg, len: (seg.value / pieTotal) * C, offset: -(acc / pieTotal) * C });
    acc += seg.value;
  });

  // Lineas: coordenadas del SVG
  const svgWidth = Math.max(chartData.length * 60, 300);
  const x = (i: number) => i * 60 + 30;
  const y = (v: number) => 140 - (v / maxChartValue) * 130;

  const legend: { key: string; label: string; color: string }[] =
    localChartType === 'stacked' ? rangeSegments : series;

  const breakdown = useMemo(
    () => getCategoryBreakdown(transactions, categories, customCategories, dashboardGroups),
    [transactions, categories, customCategories, dashboardGroups]
  );

  return (
    <div className="space-y-6">
      {/* Balance Card - Full Width */}
      <div className={`p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white ${showTypePicker ? 'focus-dimmed' : ''}`}>
        <p className="text-sm font-medium text-blue-100">Balance Neto</p>
        <h2 className="text-3xl sm:text-4xl font-bold mt-1">
          {currencySymbol}{totals.netBalance.toFixed(2)}
        </h2>
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
            <div>
              <p className="text-xs text-blue-100">Ingresos</p>
              <p className="font-bold">{currencySymbol}{totals.totalIncome.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-rose-300" />
            <div>
              <p className="text-xs text-blue-100">Egresos</p>
              <p className="font-bold">{currencySymbol}{totals.totalExpense.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className={`p-5 rounded-2xl surface-card border-line relative ${showTypePicker ? 'chart-bubble' : ''}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h3 className="font-bold text-main truncate">Ingresos vs Egresos</h3>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Selector de tipo de grafico */}
            <button
              type="button"
              onClick={() => setShowTypePicker(true)}
              aria-label="Cambiar tipo de grafico"
              aria-expanded={showTypePicker}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showTypePicker ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-muted hover-surface'
              }`}
            >
              {localChartType === 'bar' && <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />}
              {localChartType === 'line' && <LineChart className="w-3.5 h-3.5 flex-shrink-0" />}
              {localChartType === 'stacked' && <Layers className="w-3.5 h-3.5 flex-shrink-0" />}
              {localChartType === 'pie' && <PieChart className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="hidden sm:inline">
                {localChartType === 'bar' ? 'Barras' : localChartType === 'line' ? 'Lineas' : localChartType === 'stacked' ? 'Apiladas' : 'Circular'}
              </span>
            </button>

            {/* Periodo */}
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5 flex-1 sm:flex-none justify-between sm:justify-start">
              {(['day', 'week', 'month', 'year'] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setPeriodFilter(period)}
                  className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    periodFilter === period
                      ? 'surface-card text-blue-600 shadow-sm'
                      : 'text-muted hover-surface'
                  }`}
                >
                  {period === 'day' ? 'Día' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- GRAFICO: LINEAS ---------- */}
        {localChartType === 'line' && (
          <svg viewBox={`0 0 ${svgWidth} 140`} className="w-full h-44" preserveAspectRatio="none">
            {[0, 0.25, 0.5, 0.75, 1].map((p) => (
              <line
                key={p}
                x1="0"
                x2={svgWidth}
                y1={140 - p * 130}
                y2={140 - p * 130}
                stroke="#e4e4e7"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {/* Area bajo la linea de ingresos */}
            <polygon
              fill={INCOME_COLOR}
              fillOpacity="0.12"
              points={`${x(0)},140 ${chartData.map((d, i) => `${x(i)},${y(d.income)}`).join(' ')} ${x(chartData.length - 1)},140`}
            />
            {series.map((s) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                points={chartData.map((d, i) => `${x(i)},${y(s.value(d))}`).join(' ')}
              />
            ))}
            {series.map((s) =>
              chartData.map((d, i) => (
                <circle
                  key={`${s.key}-${i}`}
                  cx={x(i)}
                  cy={y(s.value(d))}
                  r="3"
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              ))
            )}
            {chartData.map((d, i) => (
              <text key={i} x={x(i)} y={139} textAnchor="middle" className="text-[8px] fill-zinc-400">
                {d.label}
              </text>
            ))}
          </svg>
        )}

        {/* ---------- GRAFICO: BARRAS ---------- */}
        {localChartType === 'bar' && (
          <div className="flex items-stretch justify-between gap-1 sm:gap-2 h-44 pt-2">
            {chartData.map((d, i) => {
              const hasData = series.some((s) => s.value(d) > 0);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {/* flex-1 + min-h-0: el area de barras ocupa todo el alto disponible */}
                  <div className="flex-1 min-h-0 w-full flex items-end justify-center gap-px">
                    {series.map((s) => {
                      const v = s.value(d);
                      return (
                        <div
                          key={s.key}
                          className="flex-1 max-w-4 rounded-t-sm transition-all duration-500"
                          style={{
                            height: `${v > 0 ? Math.max((v / maxChartValue) * 100, 1) : 0}%`,
                            backgroundColor: s.color,
                          }}
                          title={`${s.label}: ${currencySymbol}${v.toFixed(2)}`}
                        />
                      );
                    })}
                  </div>
                  <span className={`text-[10px] truncate w-full text-center ${hasData ? 'text-muted' : 'text-zinc-300'}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- GRAFICO: APILADAS ---------- */}
        {localChartType === 'stacked' && (
          <div className="space-y-3 pt-1">
            {chartData.map((d, idx) => {
              const segs = bucketSegments(d);
              const total = segs.reduce((s, x) => s + x.value, 0);
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-12 flex-shrink-0">{d.label}</span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden bg-zinc-100 flex">
                    {total > 0 ? (
                      segs
                        .filter((s) => s.value > 0)
                        .map((s) => {
                          const pct = (s.value / total) * 100;
                          return (
                            <div
                              key={s.key}
                              className="h-full flex items-center justify-center overflow-hidden text-[9px] font-bold text-white transition-all duration-300"
                              style={{ width: `${pct}%`, backgroundColor: s.color }}
                              title={`${s.label}: ${currencySymbol}${s.value.toFixed(2)}`}
                            >
                              {pct > 15 ? `${pct.toFixed(0)}%` : ''}
                            </div>
                          );
                        })
                    ) : (
                      <div className="w-full text-[9px] text-zinc-400 flex items-center justify-center">Sin datos</div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted w-16 text-right flex-shrink-0">
                    {total > 0 ? `${currencySymbol}${total.toFixed(0)}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- GRAFICO: CIRCULAR ---------- */}
        {localChartType === 'pie' &&
          (pieTotal <= 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-muted">
              Sin datos para el periodo seleccionado
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="relative w-40 h-40 flex-shrink-0">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                  {arcs.map(({ seg, len, offset }) => (
                    <circle
                      key={seg.key}
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="28"
                      strokeDasharray={`${len} ${C}`}
                      strokeDashoffset={offset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted">Total</span>
                  <span className="text-sm font-bold text-main">{currencySymbol}{pieTotal.toFixed(0)}</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                {rangeSegments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-xs text-muted truncate">{s.label}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-bold text-main">{currencySymbol}{s.value.toFixed(2)}</span>
                        <span className="text-[10px] text-muted ml-1">{((s.value / pieTotal) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                <div className="h-px bg-zinc-100" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-main">Balance</span>
                  <span
                    className={`text-sm font-bold ${
                      periodTotals.income - periodTotals.expense >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {currencySymbol}{(periodTotals.income - periodTotals.expense).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}

        {/* Leyenda (no aplica al circular, que ya lista sus partes) */}
        {localChartType !== 'pie' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-zinc-100">
            {legend.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-muted">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Valores medibles: las categorias que el usuario eligio mostrar */}
        {periodTotals.measureTotals.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-100">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
              Valores medibles · {RANGE_LABEL[periodFilter]}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {periodTotals.measureTotals.map(({ measure, amount, count }) => {
                const share = periodTotals.expense > 0 ? (amount / periodTotals.expense) * 100 : 0;
                return (
                  <div
                    key={measure.id}
                    className="rounded-xl p-3 border border-line min-w-0"
                    style={{ backgroundColor: `${measure.color}14` }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: measure.color }} />
                      <span className="text-xs font-medium text-main truncate">{measure.name}</span>
                    </div>
                    <p className="text-base font-bold text-main mt-1 truncate">
                      {currencySymbol}{amount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      {count} registro(s) · {share.toFixed(0)}% de egresos
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className={`p-5 rounded-2xl bg-white border border-line ${showTypePicker ? 'focus-dimmed' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-main">Últimos Movimientos</h3>
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium"
          >
            + Nuevo
          </button>
        </div>
        <div className="divide-y divide-zinc-100">
          {transactions.slice(0, 5).map((tx) => {
            const cat = categories.find((c) => c.id === tx.category);
            return (
              <div key={tx.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ backgroundColor: cat?.color || '#8E8E93' }}
                  >
                    {tx.title.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-main truncate">{tx.title}</p>
                    <p className="text-xs text-muted">{tx.date}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'expense' ? 'text-main' : 'text-emerald-600'}`}>
                  {tx.type === 'expense' ? '-' : '+'}{currencySymbol}{tx.amount.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gastos por categoria: las base siempre; las personalizadas solo si se eligieron */}
      {breakdown.length > 0 && (
        <div className={`p-5 rounded-2xl surface-card border-line ${showTypePicker ? 'focus-dimmed' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h3 className="font-bold text-main">Gastos por categoría</h3>
          </div>

          <div className="space-y-3">
            {breakdown.map((g) => {
              const pct = totals.totalExpense > 0 ? (g.amount / totals.totalExpense) * 100 : 0;
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                      <span className="text-sm text-main truncate">{g.name}</span>
                      <span className="text-[10px] text-muted flex-shrink-0">
                        {g.count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-sm font-bold text-main flex-shrink-0">
                      {currencySymbol}
                      {g.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: g.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu central de tipos de grafico */}
      {showTypePicker && (
        <div
          className="fixed inset-0 z-[60] safe-overlay flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tipo de grafico"
        >
          {/* Fondo con blur: al pulsarlo se cierra */}
          <div className="absolute inset-0 bg-zinc-900/25 backdrop-blur-sm" onClick={() => setShowTypePicker(false)} />

          <div className="chart-menu-pop relative w-full max-w-[min(18rem,100%)] p-2 surface-card border-line rounded-2xl shadow-2xl">
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold text-muted uppercase tracking-wide">
              Tipo de grafico
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { v: 'bar' as ChartType, label: 'Barras', Icon: BarChart3 },
                { v: 'line' as ChartType, label: 'Lineas', Icon: LineChart },
                { v: 'stacked' as ChartType, label: 'Apiladas', Icon: Layers },
                { v: 'pie' as ChartType, label: 'Circular', Icon: PieChart },
              ]).map(({ v, label, Icon }) => {
                const active = localChartType === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      onChartTypeChange?.(v);
                      setShowTypePicker(false);
                    }}
                    aria-pressed={active}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all ${
                      active ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 text-main hover-surface active:scale-95'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate w-full text-center">{label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowTypePicker(false)}
              className="w-full mt-1.5 py-2 rounded-xl text-xs font-medium text-muted hover-surface"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
