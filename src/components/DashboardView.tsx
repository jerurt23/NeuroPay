import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, TrendingUp } from 'lucide-react';
import { Transaction, CategoryInfo, Budget, BankEmail } from '../types/index.ts';
import { calculateTotals } from '../utils/budgetCalculations.ts';

interface DashboardViewProps {
  transactions: Transaction[];
  categories: CategoryInfo[];
  budgets: Budget[];
  bankEmails: BankEmail[];
  currencySymbol: string;
  chartType?: 'bar' | 'line';
  onOpenNewTransaction: () => void;
}

type PeriodFilter = 'day' | 'week' | 'month' | 'year';

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  categories,
  budgets,
  bankEmails,
  currencySymbol,
  chartType = 'bar',
  onOpenNewTransaction,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');

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
      <div className="p-5 rounded-2xl bg-white border border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-zinc-900">Ingresos vs Egresos</h3>
          </div>
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5">
            {(['day', 'week', 'month', 'year'] as PeriodFilter[]).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setPeriodFilter(period)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  periodFilter === period
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {period === 'day' ? 'Día' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>

        {chartType === 'line' ? (
          <svg viewBox={`0 0 ${chartData.length * 60} 120`} className="w-full h-40">
            {/* income line */}
            <polyline
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              points={chartData.map((d, i) => `${i * 60 + 30},${120 - (d.income / maxChartValue) * 100}`).join(' ')}
            />
            {/* expense line */}
            <polyline
              fill="none"
              stroke="#fb7185"
              strokeWidth="2"
              points={chartData.map((d, i) => `${i * 60 + 30},${120 - (d.expense / maxChartValue) * 100}`).join(' ')}
            />
            {chartData.map((d, i) => (
              <g key={i}>
                <circle cx={i * 60 + 30} cy={120 - (d.income / maxChartValue) * 100} r="3" fill="#34d399" />
                <circle cx={i * 60 + 30} cy={120 - (d.expense / maxChartValue) * 100} r="3" fill="#fb7185" />
                <text x={i * 60 + 30} y={118} textAnchor="middle" className="text-[8px] fill-zinc-500">
                  {d.label}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div className="space-y-3">
            {chartData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-12 flex-shrink-0">{item.label}</span>
                <div className="flex-1 flex items-center gap-1 h-6">
                  <div
                    className="h-full bg-emerald-400 rounded-l transition-all duration-300"
                    style={{ width: `${(item.income / maxChartValue) * 100}%` }}
                  />
                  <div
                    className="h-full bg-rose-400 rounded-r transition-all duration-300"
                    style={{ width: `${(item.expense / maxChartValue) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400 w-16 text-right flex-shrink-0">
                  {item.income > 0 || item.expense > 0 ? `${currencySymbol}${(item.income + item.expense).toFixed(0)}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-100">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-400" />
            <span className="text-xs text-zinc-500">Ingresos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-rose-400" />
            <span className="text-xs text-zinc-500">Egresos</span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-zinc-900">Últimos Movimientos</h3>
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
                    <p className="text-sm font-medium text-zinc-900 truncate">{tx.title}</p>
                    <p className="text-xs text-zinc-500">{tx.date}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'expense' ? 'text-zinc-900' : 'text-emerald-600'}`}>
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
