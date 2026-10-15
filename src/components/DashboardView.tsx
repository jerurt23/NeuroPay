import React, { useState } from 'react';
import { 
 ArrowUpRight, 
 ArrowDownLeft, 
 ArrowRight,
 TrendingUp, 
 ShieldCheck, 
 Filter, 
 Search, 
 Plus, 
 Mail, 
 Navigation, 
 Pill, 
 Utensils, 
 Layers, 
 SlidersHorizontal,
 ChevronRight,
 Sparkles,
 Repeat,
 Zap,
 MoreVertical,
 Maximize2
} from 'lucide-react';
import { 
 Transaction, 
 CategoryInfo, 
 WidgetConfig, 
 Budget, 
 BankEmail, 
 StandardCategory 
} from '../types/index.ts';
import { calculateTotals, calculateCategoryBreakdown, evaluateBudgets } from '../utils/budgetCalculations.ts';

interface DashboardViewProps {
 transactions: Transaction[];
 categories: CategoryInfo[];
 budgets: Budget[];
 bankEmails: BankEmail[];
 widgets: WidgetConfig[];
 currencySymbol: string;
 onOpenNewTransaction: () => void;
 onNavigateTab: (tabId: string) => void;
 onRepeatTrip: (tx: Transaction) => void;
 onConfigureWidgets: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
 transactions,
 categories,
 budgets,
 bankEmails,
 widgets,
 currencySymbol,
 onOpenNewTransaction,
 onNavigateTab,
 onRepeatTrip,
 onConfigureWidgets,
}) => {
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState<string>('');

 // Filter transactions
 const filteredTransactions = transactions.filter((t) => {
 const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
 const matchesSearch = !searchQuery || 
 t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
 t.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
 t.transportDetails?.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
 t.transportDetails?.destination.toLowerCase().includes(searchQuery.toLowerCase());
 return matchesCategory && matchesSearch;
 });

 const totals = calculateTotals(transactions);
 const currentPeriod = new Date().toISOString().slice(0, 7);
 const budgetStatuses = evaluateBudgets(budgets, transactions, currentPeriod);
 const categoryBreakdown = calculateCategoryBreakdown(transactions);
 const pendingEmails = bankEmails.filter((e) => e.status === 'pending');
 const transportTxs = transactions.filter((t) => t.category === 'transporte' && t.transportDetails);

 // Enabled widgets sorted by order
 const activeWidgets = widgets
 .filter((w) => w.enabled)
 .sort((a, b) => a.order - b.order);

 return (
 <div className="space-y-5">
 {/* Search & Filter Bar */}
 <div className="p-3 sm:p-4 rounded-3xl ios-glass-card flex flex-col sm:flex-row items-center justify-between gap-3">
 {/* Search Input */}
 <div className="relative w-full sm:w-72">
 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
 <input
 type="text"
 placeholder="Buscar compras, medicinas, rutas..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-9 pr-4 py-2 rounded-2xl bg-zinc-100800/80 text-xs text-zinc-900100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-black/5"
 />
 </div>

 {/* Category Filter Pills Scrollable */}
 <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
 <button
 type="button"
 onClick={() => setSelectedCategory('all')}
 className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
 selectedCategory === 'all'
 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
 : 'bg-zinc-100800 text-zinc-600400 hover:bg-zinc-200'
 }`}
 >
 Todas ({transactions.length})
 </button>
 {categories.map((cat) => {
 const isSelected = selectedCategory === cat.id;
 return (
 <button
 key={cat.id}
 type="button"
 onClick={() => setSelectedCategory(cat.id)}
 className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
 isSelected
 ? 'bg-zinc-900 text-white100900 shadow-md'
 : 'bg-zinc-100800 text-zinc-600400 hover:bg-zinc-200'
 }`}
 >
 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
 <span>{cat.name.split(' ')[0]}</span>
 </button>
 );
 })}
 </div>

 {/* Configure Widgets Button */}
 <button
 type="button"
 onClick={onConfigureWidgets}
 title="Personalizar Widgets del Tablero"
 className="p-2 rounded-2xl bg-zinc-100800 text-zinc-600300 hover:bg-zinc-200:bg-zinc-700 transition-colors flex-shrink-0"
 >
 <SlidersHorizontal className="w-4 h-4" />
 </button>
 </div>

 {/* Dynamic Configurable Widgets Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {activeWidgets.map((widget) => {
 // Render widget according to type and size
 const colSpan = widget.size === 'large' 
 ? 'col-span-1 md:col-span-2 lg:col-span-4' 
 : widget.size === 'medium'
 ? 'col-span-1 md:col-span-2'
 : 'col-span-1';

 return (
 <div
 key={widget.id}
 className={`${colSpan} p-5 rounded-3xl ios-glass-card border border-black/5 flex flex-col justify-between relative overflow-hidden transition-all duration-300`}
 >
 {/* Widget: Balance General & Flujo */}
 {widget.type === 'balance' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
 Balance Neto Acumulado
 </span>
 <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900100 font-mono">
 {currencySymbol}{totals.netBalance.toFixed(2)}
 </h3>
 </div>
 <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500">
 <ShieldCheck className="w-5 h-5" />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100800">
 <div className="p-3 rounded-2xl bg-emerald-500/10">
 <span className="text-[10px] font-semibold text-emerald-700300 flex items-center gap-1">
 <ArrowDownLeft className="w-3.5 h-3.5" /> Ingresos
 </span>
 <span className="text-base font-bold font-mono text-emerald-600400">
 {currencySymbol}{totals.totalIncome.toFixed(2)}
 </span>
 </div>

 <div className="p-3 rounded-2xl bg-rose-500/10">
 <span className="text-[10px] font-semibold text-rose-700300 flex items-center gap-1">
 <ArrowUpRight className="w-3.5 h-3.5" /> Egresos
 </span>
 <span className="text-base font-bold font-mono text-rose-600400">
 {currencySymbol}{totals.totalExpense.toFixed(2)}
 </span>
 </div>
 </div>
 </div>
 )}

 {/* Widget: Red Neuronal Mini Teaser */}
 {widget.type === 'neural' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500">
 <Zap className="w-4 h-4 animate-pulse" />
 </div>
 <div>
 <h4 className="text-sm font-bold text-zinc-900100">
 Red Neuronal de Sinapsis Financiera
 </h4>
 <p className="text-[11px] text-zinc-400">
 {transactions.length} nodos activos y conexiones interconectadas
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => onNavigateTab('neural')}
 className="text-xs font-semibold text-blue-600400 flex items-center gap-1 hover:underline"
 >
 <span>Abrir Red</span>
 <ChevronRight className="w-3.5 h-3.5" />
 </button>
 </div>

 {/* Visual synaptic representation */}
 <div 
 onClick={() => onNavigateTab('neural')}
 className="h-28 rounded-2xl bg-slate-900950 p-3 flex items-center justify-around cursor-pointer border border-slate-700800 relative overflow-hidden group"
 >
 <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 opacity-50 group-hover:opacity-80 transition-opacity" />
 
 {/* Pulsing Synapse nodes */}
 <div className="relative z-10 flex flex-col items-center">
 <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold shadow-lg shadow-blue-500/50 animate-pulse">
 Cerebro
 </div>
 <span className="text-[9px] text-zinc-400 mt-1">E2EE Core</span>
 </div>

 <div className="h-0.5 w-16 bg-gradient-to-r from-blue-500 to-amber-500 relative">
 <span className="w-2 h-2 rounded-full bg-white absolute -top-[3px] left-1/2 -translate-x-1/2 animate-ping" />
 </div>

 <div className="relative z-10 flex flex-col items-center">
 <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-[9px] font-bold shadow-lg shadow-amber-500/50">
 Comida
 </div>
 <span className="text-[9px] text-zinc-400 mt-1">
 {currencySymbol}{categoryBreakdown.find((c) => c.category === 'comida')?.totalSpent.toFixed(0) || '0'}
 </span>
 </div>

 <div className="h-0.5 w-16 bg-gradient-to-r from-blue-500 to-rose-500" />

 <div className="relative z-10 flex flex-col items-center">
 <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center text-white text-[9px] font-bold shadow-lg shadow-rose-500/50">
 Salud
 </div>
 <span className="text-[9px] text-zinc-400 mt-1">
 {currencySymbol}{categoryBreakdown.find((c) => c.category === 'medicina')?.totalSpent.toFixed(0) || '0'}
 </span>
 </div>

 <div className="h-0.5 w-16 bg-gradient-to-r from-blue-500 to-cyan-500" />

 <div className="relative z-10 flex flex-col items-center">
 <div className="w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center text-white text-[9px] font-bold shadow-lg shadow-cyan-500/50">
 Rutas
 </div>
 <span className="text-[9px] text-zinc-400 mt-1">
 {currencySymbol}{categoryBreakdown.find((c) => c.category === 'transporte')?.totalSpent.toFixed(0) || '0'}
 </span>
 </div>
 </div>
 </div>
 )}

 {/* Widget: Rutas Frecuentes */}
 {widget.type === 'routes' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
 <Navigation className="w-4 h-4" />
 </div>
 <h4 className="text-sm font-bold text-zinc-900100 flex items-center gap-1">
 <span>Rutas Frecuentes (Punto A</span>
 <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
 <span>B)</span>
 </h4>
 </div>
 <button
 type="button"
 onClick={() => onNavigateTab('routes')}
 className="text-xs text-blue-600400 hover:underline flex items-center gap-0.5 font-medium"
 >
 Ver todas <ChevronRight className="w-3 h-3" />
 </button>
 </div>

 <div className="space-y-2">
 {transportTxs.slice(0, 3).map((t) => (
 <div
 key={t.id}
 className="p-2.5 rounded-2xl bg-zinc-50800/60 flex items-center justify-between gap-2 text-xs"
 >
 <div className="min-w-0">
 <span className="font-bold text-zinc-900100 truncate flex items-center">
 <span>{t.transportDetails?.origin.split(',')[0]}</span>
 <ArrowRight className="w-3 h-3 text-blue-500 mx-1 flex-shrink-0 inline" />
 <span>{t.transportDetails?.destination.split(',')[0]}</span>
 </span>
 <span className="text-[10px] text-zinc-400 capitalize">
 {t.transportDetails?.transportMode.replace('_', ' ')} • {t.transportDetails?.distanceKm || 5} km
 </span>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <span className="font-bold font-mono text-zinc-900100">
 {currencySymbol}{t.amount.toFixed(2)}
 </span>
 <button
 type="button"
 onClick={() => onRepeatTrip(t)}
 title="Repetir viaje"
 className="p-1 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
 >
 <Repeat className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Widget: Correos Bancarios Alertas */}
 {widget.type === 'bank_sync' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
 <Mail className="w-4 h-4" />
 </div>
 <div>
 <h4 className="text-sm font-bold text-zinc-900100">
 Alertas de Bancas Móviles
 </h4>
 <span className="text-[10px] text-zinc-400">
 {pendingEmails.length} por confirmar
 </span>
 </div>
 </div>
 <button
 type="button"
 onClick={() => onNavigateTab('email_sync')}
 className="text-xs text-indigo-600400 hover:underline flex items-center gap-0.5 font-medium"
 >
 Bandeja <ChevronRight className="w-3 h-3" />
 </button>
 </div>

 <div className="space-y-2">
 {bankEmails.slice(0, 2).map((e) => (
 <div
 key={e.id}
 className="p-2.5 rounded-2xl bg-zinc-50800/60 flex items-center justify-between gap-2 text-xs"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="font-bold text-zinc-900100 truncate">
 {e.parsedMerchant}
 </span>
 <span className="text-[9px] px-1 py-0.2 rounded-md bg-zinc-200700 text-zinc-500">
 {e.bankName}
 </span>
 </div>
 <span className="text-[10px] text-zinc-400 truncate block">
 {e.subject}
 </span>
 </div>
 <span className="font-bold font-mono text-zinc-900100 flex-shrink-0">
 {e.parsedCurrency} {e.parsedAmount.toFixed(2)}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Widget: Sobres de Presupuesto */}
 {widget.type === 'budget' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <h4 className="text-sm font-bold text-zinc-900100">
 Presupuestos Activos
 </h4>
 <button
 type="button"
 onClick={() => onNavigateTab('budgets')}
 className="text-xs text-blue-600400 hover:underline flex items-center gap-0.5 font-medium"
 >
 Detalle <ChevronRight className="w-3 h-3" />
 </button>
 </div>

 <div className="space-y-2.5">
 {budgetStatuses.slice(0, 2).map((b) => (
 <div key={b.budgetId} className="space-y-1">
 <div className="flex items-center justify-between text-xs">
 <span className="font-semibold text-zinc-800200 truncate">
 {b.name}
 </span>
 <span className="font-mono text-zinc-500400">
 {currencySymbol}{b.currentSpent.toFixed(0)} / {currencySymbol}{b.monthlyLimit.toFixed(0)}
 </span>
 </div>
 <div className="w-full h-1.5 rounded-full bg-zinc-100800 overflow-hidden">
 <div
 className={`h-full rounded-full ${
 b.isExceeded ? 'bg-rose-500' : b.isWarning ? 'bg-amber-500' : 'bg-blue-600'
 }`}
 style={{ width: `${Math.min(100, b.percentage)}%` }}
 />
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Widget: Top Categoría */}
 {widget.type === 'top_category' && (
 <div className="space-y-2">
 <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
 Rubro Principal
 </span>
 <div className="text-xl font-bold text-zinc-900100 capitalize">
 {categoryBreakdown[0]?.category || 'Ninguna'}
 </div>
 <div className="text-sm font-mono text-blue-600400 font-bold">
 {currencySymbol}{categoryBreakdown[0]?.totalSpent.toFixed(2) || '0.00'}
 </div>
 <span className="text-[10px] text-zinc-400 block">
 {categoryBreakdown[0]?.percentageOfTotal || 0}% de los egresos
 </span>
 </div>
 )}

 {/* Widget: Métricas de Ahorro */}
 {widget.type === 'metrics' && (
 <div className="space-y-2">
 <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
 Tasa de Ahorro
 </span>
 <div className="text-xl font-bold text-emerald-600400">
 {totals.savingsRate}%
 </div>
 <div className="text-xs text-zinc-500400">
 Retención de ingresos
 </div>
 <span className="text-[10px] text-zinc-400 block">
 Finanzas saludables
 </span>
 </div>
 )}

 {/* Widget: Últimos Movimientos List */}
 {widget.type === 'recent' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <h4 className="text-base font-bold text-zinc-900100">
 Histórico de Compras y Movimientos
 </h4>
 <p className="text-xs text-zinc-500400">
 Mostrando {filteredTransactions.length} registros filtrados
 </p>
 </div>

 <button
 type="button"
 onClick={onOpenNewTransaction}
 className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>Nuevo Registro</span>
 </button>
 </div>

 <div className="divide-y divide-zinc-100800">
 {filteredTransactions.slice(0, 6).map((tx) => {
 const cat = categories.find((c) => c.id === tx.category);
 const isExpense = tx.type === 'expense';

 return (
 <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <div
 className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
 style={{ backgroundColor: `${cat?.color || '#0A84FF'}22` }}
 >
 {tx.category === 'transporte' ? (
 <Navigation className="w-4 h-4 text-blue-500" />
 ) : tx.category === 'medicina' ? (
 <Pill className="w-4 h-4 text-rose-500" />
 ) : tx.category === 'comida' ? (
 <Utensils className="w-4 h-4 text-amber-500" />
 ) : (
 <Layers className="w-4 h-4 text-zinc-500" />
 )}
 </div>

 <div className="min-w-0">
 <h5 className="text-xs sm:text-sm font-semibold text-zinc-900100 truncate">
 {tx.title}
 </h5>
 <div className="flex items-center gap-2 text-[11px] text-zinc-500400">
 <span>{tx.date}</span>
 <span>•</span>
 <span className="capitalize">{tx.category}</span>
 {tx.bankSyncMeta && (
 <>
 <span>•</span>
 <span className="text-indigo-500 font-medium">
 {tx.bankSyncMeta.bankName}
 </span>
 </>
 )}
 </div>
 </div>
 </div>

 <div className="text-right flex-shrink-0">
 <span
 className={`text-sm font-bold font-mono ${
 isExpense ? 'text-zinc-900100' : 'text-emerald-600400'
 }`}
 >
 {isExpense ? '-' : '+'}{currencySymbol}{tx.amount.toFixed(2)}
 </span>
 <span className="block text-[10px] text-zinc-400 capitalize">
 {tx.paymentMethod.replace('_', ' ')}
 </span>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
};
