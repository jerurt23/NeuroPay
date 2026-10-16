import React, { useState } from 'react';
import { 
 PieChart, 
 Plus, 
 AlertTriangle, 
 CheckCircle2, 
 TrendingDown, 
 TrendingUp, 
 ShieldCheck, 
 X,
 Sparkles,
 DollarSign
} from 'lucide-react';
import { Budget, CategoryInfo, Transaction } from '../types/index.ts';
import { evaluateBudgets } from '../utils/budgetCalculations.ts';

interface BudgetViewProps {
 budgets: Budget[];
 transactions: Transaction[];
 categories: CategoryInfo[];
 currencySymbol: string;
 onAddBudget: (b: Budget) => void;
 onDeleteBudget: (id: string) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
 budgets,
 transactions,
 categories,
 currencySymbol,
 onAddBudget,
 onDeleteBudget,
}) => {
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [name, setName] = useState('');
 const [categoryId, setCategoryId] = useState('comida');
 const [monthlyLimit, setMonthlyLimit] = useState('');
 const [alertThreshold, setAlertThreshold] = useState('0.8');

 const currentPeriod = new Date().toISOString().slice(0, 7); // e.g. "2026-10"
 const budgetStatuses = evaluateBudgets(budgets, transactions, currentPeriod);

 const totalBudgeted = budgets.reduce((sum, b) => (b.categoryId !== 'all' ? sum + b.monthlyLimit : sum), 0);
 const totalSpentInBudgets = budgetStatuses.reduce((sum, b) => (b.categoryId !== 'all' ? sum + b.currentSpent : sum), 0);
 const overallPercentage = totalBudgeted > 0 ? (totalSpentInBudgets / totalBudgeted) * 100 : 0;

 const handleCreate = (e: React.FormEvent) => {
 e.preventDefault();
 const limit = parseFloat(monthlyLimit);
 if (isNaN(limit) || limit <= 0) return;

 const newBudget: Budget = {
 id: `b_${Date.now()}`,
 categoryId,
 name: name.trim() || `Presupuesto ${categoryId.toUpperCase()}`,
 monthlyLimit: Number(limit.toFixed(2)),
 currentSpent: 0,
 periodMonth: currentPeriod,
 alertThreshold: parseFloat(alertThreshold) || 0.8,
 };

 onAddBudget(newBudget);
 setName('');
 setMonthlyLimit('');
 setIsModalOpen(false);
 };

 return (
 <div className="space-y-5">
 {/* Overview Card */}
 <div className="p-5 sm:p-6 rounded-3xl ios-glass-card bg-gradient-to-tr from-blue-600/10 via-indigo-500/5 to-transparent border border-blue-500/20">
 <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
 <div>
 <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
 Presupuesto Mensual Activo ({currentPeriod})
 </span>
 <h2 className="text-2xl sm:text-3xl font-extrabold text-main font-mono mt-0.5">
 {currencySymbol}{totalSpentInBudgets.toFixed(2)}{' '}
 <span className="text-sm font-normal text-muted">
 / {currencySymbol}{totalBudgeted.toFixed(2)}
 </span>
 </h2>
 </div>

 <button
 type="button"
 onClick={() => setIsModalOpen(true)}
 className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-transform"
 >
 <Plus className="w-4 h-4" />
 <span>Crear Sobre de Presupuesto</span>
 </button>
 </div>

 {/* Global Progress Bar */}
 <div className="w-full h-3 rounded-full surface-input overflow-hidden relative">
 <div
 style={{ width: `${Math.min(100, overallPercentage)}%` }}
 className={`h-full rounded-full transition-all duration-500 ease-out ${
 overallPercentage > 100
 ? 'bg-rose-500'
 : overallPercentage > 80
 ? 'bg-amber-500'
 : 'bg-gradient-to-r from-blue-500 to-indigo-500'
 }`}
 />
 </div>
 <div className="flex items-center justify-between text-xs text-muted mt-2 font-medium">
 <span>{overallPercentage.toFixed(1)}% ejecutado</span>
 <span>Disponible: {currencySymbol}{Math.max(0, totalBudgeted - totalSpentInBudgets).toFixed(2)}</span>
 </div>
 </div>

 {/* Envelope Cards Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {budgetStatuses.map((status) => {
 const cat = categories.find((c) => c.id === status.categoryId);
 const color = cat?.color || '#0A84FF';

 return (
 <div
 key={status.budgetId}
 className="p-5 rounded-3xl ios-glass-card border border-black/5 space-y-3 hover:-translate-y-0.5 transition-transform"
 >
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2.5">
 <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />
 <h3 className="text-sm font-bold text-main">
 {status.name}
 </h3>
 </div>

 <div className="flex items-center gap-2">
 {status.isExceeded && (
 <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold border border-rose-500/20 flex items-center gap-1">
 <AlertTriangle className="w-3 h-3" />
 Excedido
 </span>
 )}
 {status.isWarning && (
 <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold border border-amber-500/20 flex items-center gap-1">
 <AlertTriangle className="w-3 h-3" />
 {status.percentage}% (Alerta)
 </span>
 )}
 {!status.isWarning && !status.isExceeded && (
 <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
 <CheckCircle2 className="w-3 h-3" />
 Saludable
 </span>
 )}

 <button
 type="button"
 onClick={() => onDeleteBudget(status.budgetId)}
 title="Eliminar presupuesto"
 aria-label="Eliminar presupuesto"
 className="p-1 rounded-full text-zinc-400 hover:text-rose-500 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Numbers */}
 <div className="flex items-baseline justify-between">
 <div>
 <span className="text-xs text-zinc-400 block">Gastado</span>
 <span className="text-lg font-bold font-mono text-main">
 {currencySymbol}{status.currentSpent.toFixed(2)}
 </span>
 </div>
 <div className="text-right">
 <span className="text-xs text-zinc-400 block">Límite Mensual</span>
 <span className="text-lg font-bold font-mono text-muted">
 {currencySymbol}{status.monthlyLimit.toFixed(2)}
 </span>
 </div>
 </div>

 {/* Progress */}
 <div className="w-full h-2 rounded-full surface-input overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${
 status.isExceeded
 ? 'bg-rose-500'
 : status.isWarning
 ? 'bg-amber-500'
 : 'bg-blue-600'
 }`}
 style={{ width: `${Math.min(100, status.percentage)}%` }}
 />
 </div>

 <div className="flex items-center justify-between text-[11px] text-muted pt-1">
 <span>Restante: {currencySymbol}{status.remaining.toFixed(2)}</span>
 <span className="font-semibold">{status.percentage.toFixed(0)}% asignado</span>
 </div>
 </div>
 );
 })}
 </div>

 {/* New Budget Modal */}
 {isModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-2xl">
 <div
 className="w-full max-w-md bg-white/80 rounded-3xl p-6 border border-white/60 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl"
 >
 <div className="flex items-center justify-between">
 <h3 className="text-base font-bold text-main">
 Nuevo Sobre de Presupuesto
 </h3>
 <button
 type="button"
 onClick={() => setIsModalOpen(false)}
 className="p-1 rounded-full text-zinc-400 hover:text-muted"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleCreate} className="space-y-3">
 <div>
 <label htmlFor="budget-name-input" className="block text-xs font-semibold text-muted mb-1">
 Nombre del Sobre
 </label>
 <input
 id="budget-name-input"
 type="text"
 required
 placeholder="Ej. Comida y Supermercado Mensual"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full px-3 py-2 rounded-2xl surface-input text-xs text-main border border-line"
 />
 </div>

 <div>
 <label htmlFor="budget-cat-select" className="block text-xs font-semibold text-muted mb-1">
 Categoría Vinculada
 </label>
 <select
 id="budget-cat-select"
 value={categoryId}
 onChange={(e) => setCategoryId(e.target.value)}
 className="w-full px-3 py-2 rounded-2xl surface-input text-xs text-main border border-line"
 >
 <option value="all">Tope Global (Todas las categorías)</option>
 {categories.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label htmlFor="budget-limit-input" className="block text-xs font-semibold text-muted mb-1">
 Límite Máximo ({currencySymbol})
 </label>
 <input
 id="budget-limit-input"
 type="number"
 step="1"
 min="1"
 required
 placeholder="400"
 value={monthlyLimit}
 onChange={(e) => setMonthlyLimit(e.target.value)}
 className="w-full px-3 py-2 rounded-2xl surface-input text-xs text-main border border-line font-mono"
 />
 </div>

 <div>
 <label htmlFor="budget-alert-select" className="block text-xs font-semibold text-muted mb-1">
 Umbral de Alerta Temprana
 </label>
 <select
 id="budget-alert-select"
 value={alertThreshold}
 onChange={(e) => setAlertThreshold(e.target.value)}
 className="w-full px-3 py-2 rounded-2xl surface-input text-xs text-main border border-line"
 >
 <option value="0.7">70% de consumo</option>
 <option value="0.8">80% de consumo (Recomendado iOS)</option>
 <option value="0.9">90% de consumo</option>
 </select>
 </div>

 <div className="pt-2">
 <button
 type="submit"
 className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25"
 >
 Guardar Sobre
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
};
