import React, { useState } from 'react';
import { 
 X, 
 Car, 
 Pill, 
 Utensils, 
 Zap, 
 Home, 
 Film, 
 Smartphone, 
 MoreHorizontal,
 Navigation,
 MapPin,
 Clock,
 Calendar,
 CreditCard,
 Banknote,
 Send,
 Sparkles,
 Check
} from 'lucide-react';
import { 
 Transaction, 
 StandardCategory, 
 TransportMode, 
 CategoryInfo
} from '../types/index.ts';

interface NewTransactionModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (tx: Transaction) => void;
 categories: CategoryInfo[];
 currencySymbol: string;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
 isOpen,
 onClose,
 onSave,
 categories,
 currencySymbol,
}) => {
 const [type, setType] = useState<'expense' | 'income'>('expense');
 const [amount, setAmount] = useState<string>('');
 const [title, setTitle] = useState<string>('');
 const [category, setCategory] = useState<StandardCategory>('transporte');
 const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
 const [paymentMethod, setPaymentMethod] = useState<'tarjeta_credito' | 'tarjeta_debito' | 'transferencia' | 'efectivo' | 'banca_movil'>('banca_movil');
 const [notes, setNotes] = useState<string>('');
 const [tags, setTags] = useState<string>('');

 // Transport Specific
 const [origin, setOrigin] = useState<string>('Miraflores, Lima');
 const [destination, setDestination] = useState<string>('San Isidro Centro Financiero');
 const [distanceKm, setDistanceKm] = useState<string>('6.5');
 const [transportMode, setTransportMode] = useState<TransportMode>('uber_cabify');
 const [returnTrip, setReturnTrip] = useState<boolean>(false);

 // Medicine Specific
 const [pharmacy, setPharmacy] = useState<string>('InkaFarma');
 const [prescriptionNeeded, setPrescriptionNeeded] = useState<boolean>(false);
 const [doseNotes, setDoseNotes] = useState<string>('');

 // Food Specific
 const [placeType, setPlaceType] = useState<'supermercado' | 'restaurante' | 'delivery' | 'cafeteria' | 'mercado'>('restaurante');
 const [meal, setMeal] = useState<'desayuno' | 'almuerzo' | 'cena' | 'snack'>('almuerzo');

 if (!isOpen) return null;

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 const parsedAmount = parseFloat(amount);
 if (isNaN(parsedAmount) || parsedAmount <= 0) return;

 let finalTitle = title.trim();
 if (!finalTitle) {
 if (category === 'transporte') {
 finalTitle = `${origin} -> ${destination}`;
 } else if (category === 'medicina') {
 finalTitle = pharmacy ? `${pharmacy}: Medicinas` : 'Compra en Farmacia';
 } else if (category === 'comida') {
 finalTitle = `${placeType.toUpperCase()}: Consumo de alimentos`;
 } else {
 finalTitle = 'Gasto Registrado';
 }
 }

 const newTx: Transaction = {
 id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
 title: finalTitle,
 amount: Number(parsedAmount.toFixed(2)),
 type,
 category,
 date,
 time: new Date().toTimeString().slice(0, 5),
 paymentMethod,
 notes: notes.trim() || undefined,
 tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
 transportDetails: category === 'transporte' ? {
 origin,
 destination,
 distanceKm: distanceKm ? parseFloat(distanceKm) : undefined,
 transportMode,
 returnTrip,
 } : undefined,
 medicineDetails: category === 'medicina' ? {
 pharmacy,
 prescriptionNeeded,
 doseNotes: doseNotes || undefined,
 } : undefined,
 foodDetails: category === 'comida' ? {
 placeType,
 meal,
 } : undefined,
 synapseWeight: Math.min(100, Math.max(15, Math.round(parsedAmount * 1.2))),
 };

 onSave(newTx);
 onClose();
 };

 return (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
 <div
 className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white900 rounded-t-[32px] sm:rounded-[32px] border border-zinc-200800 shadow-2xl p-5 sm:p-6 animate-in fade-in slide-in-from-bottom duration-300"
 >
 {/* iOS Drag Handle on Mobile */}
 <div className="w-12 h-1 bg-zinc-300700 rounded-full mx-auto mb-4 sm:hidden" />

 {/* Header */}
 <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100800">
 <div>
 <h2 className="text-lg font-bold text-zinc-900100">
 Nuevo Registro Financiero
 </h2>
 <p className="text-xs text-zinc-500400">
 Conectado a la Red Neuronal y Bóveda Cifrada E2EE
 </p>
 </div>
 <button
 type="button"
 onClick={onClose}
 aria-label="Cerrar modal"
 className="p-2 rounded-full bg-zinc-100800 text-zinc-500 hover:text-zinc-800:text-zinc-200"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="space-y-4">
 {/* Segmented Control: Gasto vs Ingreso */}
 <div className="grid grid-cols-2 p-1 bg-zinc-100800 rounded-2xl">
 <button
 type="button"
 onClick={() => setType('expense')}
 className={`py-2 text-xs font-semibold rounded-xl transition-all ${
 type === 'expense'
 ? 'bg-rose-500 text-white shadow-md'
 : 'text-zinc-600400'
 }`}
 >
 Egreso / Compra
 </button>
 <button
 type="button"
 onClick={() => setType('income')}
 className={`py-2 text-xs font-semibold rounded-xl transition-all ${
 type === 'income'
 ? 'bg-emerald-600 text-white shadow-md'
 : 'text-zinc-600400'
 }`}
 >
 Ingreso / Abono
 </button>
 </div>

 {/* Amount Display with Large iOS Style Typography */}
 <div className="p-4 rounded-2xl bg-zinc-50800/50 border border-zinc-200/60700/60 flex items-center justify-between">
 <label htmlFor="tx-amount-input" className="text-xs font-medium text-zinc-500400">
 Monto Total
 </label>
 <div className="flex items-center gap-1">
 <span className="text-xl sm:text-2xl font-bold text-zinc-400 font-mono">
 {currencySymbol}
 </span>
 <input
 id="tx-amount-input"
 type="number"
 step="0.01"
 min="0.01"
 required
 placeholder="0.00"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 className="w-36 sm:w-44 text-right text-2xl sm:text-3xl font-bold bg-transparent border-none text-zinc-900 focus:outline-none font-mono"
 />
 </div>
 </div>

 {/* Category Selector Grid */}
 <div>
 <label className="block text-xs font-semibold text-zinc-600300 mb-2">
 Categoría
 </label>
 <div className="grid grid-cols-4 gap-2">
 {categories.map((cat) => {
 const isSelected = category === cat.id;
 return (
 <button
 key={cat.id}
 type="button"
 onClick={() => setCategory(cat.id as StandardCategory)}
 className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
 isSelected
 ? 'border-blue-500 bg-blue-500/10 text-blue-600400 font-semibold shadow-sm'
 : 'border-zinc-200800 bg-zinc-50/50800/40 text-zinc-600400 hover:border-zinc-300'
 }`}
 >
 <span className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: cat.color }} />
 <span className="text-[11px] truncate max-w-full">{cat.name.split(' ')[0]}</span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Title / Description */}
 <div>
 <label htmlFor="tx-title-input" className="block text-xs font-semibold text-zinc-600300 mb-1">
 Título o Concepto
 </label>
 <input
 id="tx-title-input"
 type="text"
 placeholder="Ej. Almuerzo, Uber a la oficina, Pastillas..."
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-100800 border border-zinc-200700 text-sm text-zinc-900100 focus:outline-none focus:ring-2 focus:ring-blue-500"
 />
 </div>

 {/* CATEGORY SPECIALIZED SECTIONS */}

 {/* 1. TRANSPORTE: Origin to Destination with route and fare */}
 {category === 'transporte' && (
 <div
 className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3 animate-in fade-in duration-200"
 >
 <div className="flex items-center gap-2 text-xs font-bold text-blue-600400">
 <Navigation className="w-4 h-4" />
 <span>Ruta Punto a Punto & Movilidad</span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 <div>
 <label htmlFor="tx-origin-input" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Origen (Punto A)
 </label>
 <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white800 border border-zinc-200700">
 <MapPin className="w-3.5 h-3.5 text-blue-500" />
 <input
 id="tx-origin-input"
 type="text"
 required
 placeholder="Ej. Miraflores"
 value={origin}
 onChange={(e) => setOrigin(e.target.value)}
 className="w-full text-xs bg-transparent border-none text-zinc-900100 focus:outline-none"
 />
 </div>
 </div>

 <div>
 <label htmlFor="tx-dest-input" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Destino (Punto B)
 </label>
 <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white800 border border-zinc-200700">
 <Navigation className="w-3.5 h-3.5 text-indigo-500" />
 <input
 id="tx-dest-input"
 type="text"
 required
 placeholder="Ej. San Isidro"
 value={destination}
 onChange={(e) => setDestination(e.target.value)}
 className="w-full text-xs bg-transparent border-none text-zinc-900100 focus:outline-none"
 />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
 <div>
 <label htmlFor="tx-mode-select" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Medio
 </label>
 <select
 id="tx-mode-select"
 value={transportMode}
 onChange={(e) => setTransportMode(e.target.value as TransportMode)}
 className="w-full px-2.5 py-1.5 rounded-xl bg-white800 border border-zinc-200700 text-xs text-zinc-800200"
 >
 <option value="uber_cabify">Uber / Cabify</option>
 <option value="taxi">Taxi Urbano</option>
 <option value="metro">Metro / Tren</option>
 <option value="bus">Autobús</option>
 <option value="combustible">Gasolina / Auto</option>
 <option value="bicicleta">Bicicleta</option>
 </select>
 </div>

 <div>
 <label htmlFor="tx-distance-input" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Distancia (km)
 </label>
 <input
 id="tx-distance-input"
 type="number"
 step="0.1"
 placeholder="6.5"
 value={distanceKm}
 onChange={(e) => setDistanceKm(e.target.value)}
 className="w-full px-2.5 py-1.5 rounded-xl bg-white800 border border-zinc-200700 text-xs text-zinc-800200"
 />
 </div>

 <div className="flex items-center gap-2 pt-4">
 <input
 type="checkbox"
 id="returnTripCheck"
 checked={returnTrip}
 onChange={(e) => setReturnTrip(e.target.checked)}
 className="w-4 h-4 text-blue-600 rounded"
 />
 <label htmlFor="returnTripCheck" className="text-xs text-zinc-700300">
 Ida y Vuelta
 </label>
 </div>
 </div>
 </div>
 )}

 {/* 2. MEDICINA: Pharmacy, Prescription & Dosage */}
 {category === 'medicina' && (
 <div
 className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3 animate-in fade-in duration-200"
 >
 <div className="flex items-center gap-2 text-xs font-bold text-rose-600400">
 <Pill className="w-4 h-4" />
 <span>Detalles de Farmacia y Salud</span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 <div>
 <label htmlFor="tx-pharmacy-input" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Farmacia / Clínica
 </label>
 <input
 id="tx-pharmacy-input"
 type="text"
 placeholder="Ej. InkaFarma, Mifarma, CVS"
 value={pharmacy}
 onChange={(e) => setPharmacy(e.target.value)}
 className="w-full px-3 py-2 rounded-xl bg-white800 border border-zinc-200700 text-xs text-zinc-800200"
 />
 </div>

 <div>
 <label htmlFor="tx-dose-input" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Dosis o Medicamento
 </label>
 <input
 id="tx-dose-input"
 type="text"
 placeholder="Ej. Paracetamol 500mg c/8h"
 value={doseNotes}
 onChange={(e) => setDoseNotes(e.target.value)}
 className="w-full px-3 py-2 rounded-xl bg-white800 border border-zinc-200700 text-xs text-zinc-800200"
 />
 </div>
 </div>

 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="prescriptionCheck"
 checked={prescriptionNeeded}
 onChange={(e) => setPrescriptionNeeded(e.target.checked)}
 className="w-4 h-4 text-rose-500 rounded"
 />
 <label htmlFor="prescriptionCheck" className="text-xs text-zinc-700300">
 Requiere receta médica archivada
 </label>
 </div>
 </div>
 )}

 {/* 3. COMIDA: Place type & Meal */}
 {category === 'comida' && (
 <div
 className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3 animate-in fade-in duration-200"
 >
 <div className="flex items-center gap-2 text-xs font-bold text-amber-600400">
 <Utensils className="w-4 h-4" />
 <span>Tipo de Consumo Gastronómico</span>
 </div>

 <div className="grid grid-cols-2 gap-2">
 <div>
 <label htmlFor="tx-place-select" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Establecimiento
 </label>
 <select
 id="tx-place-select"
 value={placeType}
 onChange={(e) => setPlaceType(e.target.value as any)}
 className="w-full px-2.5 py-1.5 rounded-xl bg-white800 border border-zinc-200700 text-xs text-zinc-800200"
 >
 <option value="supermercado">Supermercado (Wong, Walmart)</option>
 <option value="restaurante">Restaurante</option>
 <option value="delivery">Delivery (Rappi, PedidosYa)</option>
 <option value="cafeteria">Cafetería (Starbucks)</option>
 <option value="mercado">Mercado Local</option>
 </select>
 </div>

 <div>
 <label htmlFor="tx-meal-select" className="text-[11px] font-medium text-zinc-500400 block mb-0.5">
 Momento del Día
 </label>
 <select
 id="tx-meal-select"
 value={meal}
 onChange={(e) => setMeal(e.target.value as any)}
 className="w-full px-2.5 py-1.5 rounded-xl bg-white800 border border-zinc-200700 text-xs text-zinc-800200"
 >
 <option value="desayuno">Desayuno</option>
 <option value="almuerzo">Almuerzo</option>
 <option value="cena">Cena</option>
 <option value="snack">Snack / Café</option>
 </select>
 </div>
 </div>
 </div>
 )}

 {/* Payment Method & Date */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 <div>
 <label htmlFor="tx-paymethod-select" className="block text-xs font-semibold text-zinc-600300 mb-1">
 Método de Pago
 </label>
 <select
 id="tx-paymethod-select"
 value={paymentMethod}
 onChange={(e) => setPaymentMethod(e.target.value as any)}
 className="w-full px-3 py-2 rounded-2xl bg-zinc-100800 border border-zinc-200700 text-xs text-zinc-800200"
 >
 <option value="banca_movil">Banca Móvil (BBVA / BCP / Nu)</option>
 <option value="tarjeta_credito">Tarjeta de Crédito</option>
 <option value="tarjeta_debito">Tarjeta de Débito</option>
 <option value="transferencia">Transferencia Bancaria</option>
 <option value="efectivo">Efectivo</option>
 </select>
 </div>

 <div>
 <label htmlFor="tx-date-input" className="block text-xs font-semibold text-zinc-600300 mb-1">
 Fecha
 </label>
 <input
 id="tx-date-input"
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="w-full px-3 py-2 rounded-2xl bg-zinc-100800 border border-zinc-200700 text-xs text-zinc-800200"
 />
 </div>
 </div>

 {/* Submit Button */}
 <div className="pt-2">
 <button
 type="submit"
 className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
 >
 <Check className="w-4 h-4" />
 <span>Guardar en Histórico & Red Neuronal</span>
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
