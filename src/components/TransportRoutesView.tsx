import React, { useState } from 'react';
import { 
 Navigation, 
 MapPin, 
 Car, 
 ArrowRight, 
 Clock, 
 DollarSign, 
 Repeat, 
 Plus, 
 Compass, 
 TrendingUp,
 Fuel,
 TrainFront,
 Bus,
 Bike
} from 'lucide-react';
import { Transaction, TransportDetails, TransportMode } from '../types/index.ts';

interface TransportRoutesViewProps {
 transactions: Transaction[];
 currencySymbol: string;
 onRepeatTrip: (tx: Transaction) => void;
 onOpenNewTrip: () => void;
}

const MODE_ICON: Record<TransportMode, React.ReactNode> = {
 uber_cabify: <Car className="w-4 h-4 text-blue-500" />,
 taxi: <Car className="w-4 h-4 text-amber-500" />,
 metro: <TrainFront className="w-4 h-4 text-rose-500" />,
 bus: <Bus className="w-4 h-4 text-emerald-500" />,
 bicicleta: <Bike className="w-4 h-4 text-teal-500" />,
 combustible: <Fuel className="w-4 h-4 text-orange-500" />,
 tren: <TrainFront className="w-4 h-4 text-indigo-500" />,
};

export const TransportRoutesView: React.FC<TransportRoutesViewProps> = ({
 transactions,
 currencySymbol,
 onRepeatTrip,
 onOpenNewTrip,
}) => {
 const [filterMode, setFilterMode] = useState<string>('all');

 // Extract all transport transactions
 const transportTxs = transactions.filter((t) => t.category === 'transporte' && t.transportDetails);

 const totalSpentTransport = transportTxs.reduce((sum, t) => sum + t.amount, 0);
 const totalKm = transportTxs.reduce((sum, t) => sum + (t.transportDetails?.distanceKm || 0), 0);
 const avgCostPerKm = totalKm > 0 ? totalSpentTransport / totalKm : 0;

 // Group frequent routes
 const routeFrequencies = new Map<string, { origin: string; destination: string; count: number; totalCost: number; mode: TransportMode; lastTx: Transaction }>();
 for (const t of transportTxs) {
 if (t.transportDetails) {
 const key = `${t.transportDetails.origin.toLowerCase()}->${t.transportDetails.destination.toLowerCase()}`;
 const existing = routeFrequencies.get(key);
 if (existing) {
 existing.count += 1;
 existing.totalCost += t.amount;
 } else {
 routeFrequencies.set(key, {
 origin: t.transportDetails.origin,
 destination: t.transportDetails.destination,
 count: 1,
 totalCost: t.amount,
 mode: t.transportDetails.transportMode,
 lastTx: t,
 });
 }
 }
 }

 const frequentRoutesList = Array.from(routeFrequencies.values()).sort((a, b) => b.count - a.count);

 return (
 <div className="space-y-5">
 {/* Overview Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div className="p-4 rounded-3xl ios-glass-card">
 <div className="flex items-center justify-between text-zinc-500400 mb-1">
 <span className="text-xs font-medium">Gasto Total en Rutas</span>
 <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-500">
 <Navigation className="w-4 h-4" />
 </div>
 </div>
 <div className="text-2xl font-bold font-mono text-zinc-900100">
 {currencySymbol}{totalSpentTransport.toFixed(2)}
 </div>
 <span className="text-[11px] text-zinc-400">
 {transportTxs.length} viajes registrados
 </span>
 </div>

 <div className="p-4 rounded-3xl ios-glass-card">
 <div className="flex items-center justify-between text-zinc-500400 mb-1">
 <span className="text-xs font-medium">Kilómetros Recorridos</span>
 <div className="p-1.5 rounded-full bg-indigo-500/10 text-indigo-500">
 <Compass className="w-4 h-4" />
 </div>
 </div>
 <div className="text-2xl font-bold font-mono text-zinc-900100">
 {totalKm.toFixed(1)} km
 </div>
 <span className="text-[11px] text-emerald-600400 font-medium">
 Rutas de punto A hacia punto B
 </span>
 </div>

 <div className="p-4 rounded-3xl ios-glass-card">
 <div className="flex items-center justify-between text-zinc-500400 mb-1">
 <span className="text-xs font-medium">Costo Promedio / km</span>
 <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500">
 <TrendingUp className="w-4 h-4" />
 </div>
 </div>
 <div className="text-2xl font-bold font-mono text-zinc-900100">
 {currencySymbol}{avgCostPerKm.toFixed(2)} / km
 </div>
 <span className="text-[11px] text-zinc-400">
 Optimizado según modo de transporte
 </span>
 </div>
 </div>

 {/* Action Header */}
 <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl ios-glass-card">
 <div>
 <h2 className="text-base font-bold text-zinc-900100 flex items-center gap-2">
 Rutas Frecuentes y Repetición de Viajes
 </h2>
 <p className="text-xs text-zinc-500400">
 Registra trayectos recurrentes con un solo toque y calcula el costo exacto por destino.
 </p>
 </div>
 <button
 type="button"
 onClick={onOpenNewTrip}
 className="px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20"
 >
 <Plus className="w-4 h-4" />
 <span>Nuevo Viaje Punto a Punto</span>
 </button>
 </div>

 {/* Frequent Route Cards */}
 <div className="space-y-2">
 <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-2">
 Rutas Más Realizadas
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {frequentRoutesList.map((route, i) => (
 <div
 key={i}
 className="p-4 rounded-2xl ios-glass-card border border-black/5 flex items-center justify-between gap-3 hover:-translate-y-0.5 transition-transform"
 >
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-10 h-10 rounded-2xl bg-zinc-100800 flex items-center justify-center flex-shrink-0">
 {MODE_ICON[route.mode] || <Car className="w-4 h-4 text-blue-500" />}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900100 truncate">
 <span>{route.origin.split(',')[0]}</span>
 <ArrowRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
 <span>{route.destination.split(',')[0]}</span>
 </div>
 <div className="flex items-center gap-2 text-[11px] text-zinc-500400 mt-0.5">
 <span className="font-medium text-blue-600400 font-mono">
 {currencySymbol}{(route.totalCost / route.count).toFixed(2)} por viaje
 </span>
 <span>•</span>
 <span>{route.count} {route.count === 1 ? 'viaje' : 'viajes'}</span>
 </div>
 </div>
 </div>

 <button
 type="button"
 onClick={() => onRepeatTrip(route.lastTx)}
 title="Repetir viaje y registrar costo hoy"
 className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600400 text-xs font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
 >
 <Repeat className="w-3.5 h-3.5" />
 <span>Repetir</span>
 </button>
 </div>
 ))}
 </div>
 </div>

 {/* Complete Historical Transport Log */}
 <div className="p-4 sm:p-5 rounded-3xl ios-glass-card space-y-3">
 <h3 className="text-sm font-bold text-zinc-900100">
 Historial Cronológico de Movilidad
 </h3>
 <div className="divide-y divide-zinc-100800">
 {transportTxs.map((t) => (
 <div key={t.id} className="py-3 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-9 h-9 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
 {t.transportDetails && MODE_ICON[t.transportDetails.transportMode]}
 </div>
 <div className="min-w-0">
 <h4 className="text-xs sm:text-sm font-semibold text-zinc-900100 truncate flex items-center">
 <span>{t.transportDetails?.origin}</span>
 <ArrowRight className="w-3.5 h-3.5 text-blue-500 mx-1.5 flex-shrink-0 inline" />
 <span>{t.transportDetails?.destination}</span>
 </h4>
 <div className="flex items-center gap-2 text-[11px] text-zinc-500400">
 <span>{t.date}</span>
 <span>•</span>
 <span className="capitalize">{t.transportDetails?.transportMode.replace('_', ' ')}</span>
 {t.transportDetails?.distanceKm && (
 <>
 <span>•</span>
 <span>{t.transportDetails.distanceKm} km</span>
 </>
 )}
 </div>
 </div>
 </div>

 <div className="text-right flex-shrink-0">
 <span className="text-sm font-bold font-mono text-zinc-900100">
 {currencySymbol}{t.amount.toFixed(2)}
 </span>
 {t.transportDetails?.returnTrip && (
 <span className="block text-[10px] text-blue-600400 font-medium">
 Ida y vuelta
 </span>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};
