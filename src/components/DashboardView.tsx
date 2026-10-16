import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, BarChart3, LineChart, PieChart, Layers } from 'lucide-react';
import { Transaction, CategoryInfo, Budget, BankEmail, ChartType } from '../types/index.ts';
import { calculateTotals } from '../utils/budgetCalculations.ts';

interface DashboardViewProps {
  transactions: Transaction[];
  categories: CategoryInfo[];
  budgets: Budget[];
  bankEmails: BankEmail[];
  currencySymbol: string;
  chartType?: ChartType;
  onChartTypeChange?: (t: ChartType) => void;
  onOpenNewTransaction: () => void;
}

type PeriodFilter = 'day' | 'week' | 'month' | 'year';

const INCOME_COLOR = '#34d399';
const EXPENSE_COLOR = '#fb7185';

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  categories,
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

  const totals = calculateTotals(transactions);

  const chartData = useMemo(() => {
    const now = new Date();
    const data: { label: string; income: number; expense: number }[] = [];

    if (periodFilter === 'day') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayTxs = transactions.filter(t => t.date === dateStr);
        data.push({
          label: d.toLocaleDateString('es', { weekday: 'short' }),
          income: dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expense: dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        });
      }
    } else if (periodFilter === 'week') {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekTxs = transactions.filter(t => {
          const txDate = new Date(t.date);
          return txDate >= weekStart && txDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        });
        data.push({
          label: `Sem ${4 - i}`,
          income: weekTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expense: weekTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        });
      }
    } else if (periodFilter === 'month') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = d.toISOString().slice(0, 7);
        const monthTxs = transactions.filter(t => t.date.startsWith(monthStr));
        data.push({
          label: d.toLocaleDateString('es', { month: 'short' }),
          income: monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expense: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        });
      }
    } else {
      for (let i = 3; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const yearTxs = transactions.filter(t => t.date.startsWith(String(year)));
        data.push({
          label: String(year),
          income: yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expense: yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        });
      }
    }

    return data;
  }, [transactions, periodFilter]);

  const maxChartValue = Math.max(...chartData.flatMap(d => [d.income, d.expense]), 1);

  return (
    <div className="space-y-6">
      {/* Balance Card - Full Width */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
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
      <div className="p-5 rounded-2xl surface-card border-line">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-main">Ingresos vs Egresos</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Selector de tipo de grafico */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTypePicker((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 text-muted hover-surface text-xs font-medium transition-colors"
                aria-label="Cambiar tipo de grafico"
              >
                {localChartType === 'bar' && <BarChart3 className="w-3.5 h-3.5" />}
                {localChartType === 'line' && <LineChart className="w-3.5 h-3.5" />}
                {localChartType === 'stacked' && <Layers className="w-3.5 h-3.5" />}
                {localChartType === 'pie' && <PieChart className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {localChartType === 'bar' ? 'Barras' : localChartType === 'line' ? 'Lineas' : localChartType === 'stacked' ? 'Apiladas' : 'Circular'}
                </span>
              </button>
              {showTypePicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTypePicker(false)} />
                  <div className="absolute right-0 mt-1 z-20 w-40 surface-card border-line rounded-xl shadow-xl overflow-hidden">
                    {([
                      { v: 'bar' as ChartType, label: 'Barras', Icon: BarChart3 },
                      { v: 'line' as ChartType, label: 'Lineas', Icon: LineChart },
                      { v: 'stacked' as ChartType, label: 'Apiladas', Icon: Layers },
                      { v: 'pie' as ChartType, label: 'Circular', Icon: PieChart },
                    ]).map(({ v, label, Icon }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { onChartTypeChange?.(v); setShowTypePicker(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                          localChartType === v ? 'bg-blue-50 text-blue-600' : 'text-main hover-surface'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Periodo */}
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5">
              {(['day', 'week', 'month', 'year'] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setPeriodFilter(period)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
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
          <div className="relative">
            <svg viewBox={`0 0 ${Math.max(chartData.length * 60, 300)} 140`} className="w-full h-44" preserveAspectRatio="none">
              {/* Lineas de guia */}
              {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                <line
                  key={p}
                  x1="0"
                  x2={Math.max(chartData.length * 60, 300)}
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
                points={`0,140 ${chartData.map((d, i) => `${i * 60 + 30},${140 - (d.income / maxChartValue) * 130}`).join(' ')} ${(chartData.length - 1) * 60 + 30},140`}
              />
              {/* Lineas */}
              <polyline
                fill="none"
                stroke={INCOME_COLOR}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                points={chartData.map((d, i) => `${i * 60 + 30},${140 - (d.income / maxChartValue) * 130}`).join(' ')}
              />
              <polyline
                fill="none"
                stroke={EXPENSE_COLOR}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                points={chartData.map((d, i) => `${i * 60 + 30},${140 - (d.expense / maxChartValue) * 130}`).join(' ')}
              />
              {/* Puntos y etiquetas */}
              {chartData.map((d, i) => (
                <g key={i}>
                  <circle cx={i * 60 + 30} cy={140 - (d.income / maxChartValue) * 130} r="3.5" fill="#fff" stroke={INCOME_COLOR} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <circle cx={i * 60 + 30} cy={140 - (d.expense / maxChartValue) * 130} r="3.5" fill="#fff" stroke={EXPENSE_COLOR} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <text x={i * 60 + 30} y={139} textAnchor="middle" className="text-[8px] fill-zinc-400">
                    {d.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* ---------- GRAFICO: BARRAS (agrupadas) ---------- */}
        {localChartType === 'bar' && (
          <div className="flex items-stretch justify-between gap-1 sm:gap-2 h-44 pt-2">
            {chartData.map((d, i) => {
              const hInc = (d.income / maxChartValue) * 100;
              const hExp = (d.expense / maxChartValue) * 100;
              const hasData = d.income > 0 || d.expense > 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {/* flex-1 + min-h-0: el area de barras ocupa todo el alto disponible */}
                  <div className="flex-1 min-h-0 w-full flex items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 max-w-5 rounded-t-md transition-all duration-500"
                      style={{ height: `${Math.max(hInc, 1)}%`, backgroundColor: INCOME_COLOR }}
                      title={`Ingresos: ${currencySymbol}${d.income.toFixed(2)}`}
                    />
                    <div
                      className="w-1/2 max-w-5 rounded-t-md transition-all duration-500"
                      style={{ height: `${Math.max(hExp, 1)}%`, backgroundColor: EXPENSE_COLOR }}
                      title={`Egresos: ${currencySymbol}${d.expense.toFixed(2)}`}
                    />
                  </div>
                  <span
                    className={`text-[10px] truncate w-full text-center ${
                      hasData ? 'text-muted' : 'text-zinc-300'
                    }`}
                  >
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
            {chartData.map((item, idx) => {
              const total = item.income + item.expense;
              const pctInc = total > 0 ? (item.income / total) * 100 : 0;
              const pctExp = total > 0 ? (item.expense / total) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-12 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden bg-zinc-100 flex">
                    {total > 0 ? (
                      <>
                        <div
                          className="h-full flex items-center justify-end pr-1 text-[9px] font-bold text-white transition-all duration-300"
                          style={{ width: `${pctInc}%`, backgroundColor: INCOME_COLOR }}
                          title={`Ingresos: ${currencySymbol}${item.income.toFixed(2)}`}
                        >
                          {pctInc > 15 ? `${pctInc.toFixed(0)}%` : ''}
                        </div>
                        <div
                          className="h-full flex items-center pl-1 text-[9px] font-bold text-white transition-all duration-300"
                          style={{ width: `${pctExp}%`, backgroundColor: EXPENSE_COLOR }}
                          title={`Egresos: ${currencySymbol}${item.expense.toFixed(2)}`}
                        >
                          {pctExp > 15 ? `${pctExp.toFixed(0)}%` : ''}
                        </div>
                      </>
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
        {localChartType === 'pie' && (() => {
          const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
          const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);
          const total = totalIncome + totalExpense;

          if (total <= 0) {
            return (
              <div className="h-44 flex items-center justify-center text-sm text-muted">
                Sin datos para el periodo seleccionado
              </div>
            );
          }

          const pctInc = (totalIncome / total) * 100;
          // Circunferencia del circulo (r=60)
          const C = 2 * Math.PI * 60;

          return (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="relative w-40 h-40 flex-shrink-0">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="60" fill="none" stroke={INCOME_COLOR} strokeWidth="28"
                    strokeDasharray={`${(C * pctInc) / 100} ${C}`} />
                  <circle cx="80" cy="80" r="60" fill="none" stroke={EXPENSE_COLOR} strokeWidth="28"
                    strokeDasharray={`${(C * (100 - pctInc)) / 100} ${C}`}
                    strokeDashoffset={`${-(C * pctInc) / 100}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted">Total</span>
                  <span className="text-sm font-bold text-main">
                    {currencySymbol}{total.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: INCOME_COLOR }} />
                    <span className="text-xs text-muted">Ingresos</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-bold text-main">{currencySymbol}{totalIncome.toFixed(2)}</span>
                    <span className="text-[10px] text-muted ml-1">{pctInc.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-px bg-zinc-100" />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: EXPENSE_COLOR }} />
                    <span className="text-xs text-muted">Egresos</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-bold text-main">{currencySymbol}{totalExpense.toFixed(2)}</span>
                    <span className="text-[10px] text-muted ml-1">{(100 - pctInc).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-px bg-zinc-100" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-main">Balance</span>
                  <span className={`text-sm font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {currencySymbol}{(totalIncome - totalExpense).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Leyenda (solo para barras, lineas y apiladas) */}
        {localChartType !== 'pie' && (
          <div className="flex items-center gap-4 mt-4 pt-3 border-t divide-line">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} />
              <span className="text-xs text-muted">Ingresos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} />
              <span className="text-xs text-muted">Egresos</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="p-5 rounded-2xl bg-white border border-line">
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
            const cat = categories.find(c => c.id === tx.category);
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
    </div>
  );
};
