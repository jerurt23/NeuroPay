import React, { useState, useMemo } from 'react';
import { Plus, History, Save, Check, Loader2, Trash2, Scale, ChevronDown, ChevronUp, Lock, Shield } from 'lucide-react';
import { Transaction, CategoryInfo } from '../types/index.ts';

interface RegistroViewProps {
  transactions: Transaction[];
  categories: CategoryInfo[];
  currencySymbol: string;
  verifyPassword?: (p: string) => boolean;
  onSave: (tx: Transaction) => void;
}

type MainCategory = 'comida' | 'transporte' | 'medicina' | 'ingresos' | 'nueva';
type UnitType = 'kg' | 'g' | 'unidades';

interface PendingItem {
  id: string;
  category: string;
  subcategory: string;
  itemName: string;
  amount: number;
  quantity: number;
  unit: UnitType;
  date: string;
  txType: 'expense' | 'income';
  medicineBrand?: string;
  transportOrigin?: string;
  transportDestination?: string;
  historyAmount?: number;
  historyDate?: string;
}

const DEFAULT_FOOD_ITEMS: Record<string, string[]> = {
  proteina: ['Carne', 'Pollo', 'Pescado', 'Atún'],
  carbohidratos: ['Arroz', 'Papa', 'Fideos', 'Quinua'],
  menestras: ['Frijol', 'Lentejas', 'Garbanzo', 'Pallar'],
  frutas: ['Manzana', 'Plátano', 'Naranja', 'Uva'],
  vegetales: ['Tomate', 'Lechuga', 'Zanahoria', 'Brócoli'],
  chatarra: ['Papas fritas', 'Galletas', 'Chocolate', 'Refresco'],
};

const MEDICINE_SUGGESTIONS = [
  'Paracetamol', 'Ibuprofeno', 'Amoxicilina', 'Omeprazol',
  'Loratadina', 'Diclofenaco', 'Azitromicina', 'Metformina',
  'Losartán', 'Aspirina', 'Vitamina C', 'Complejo B',
];

const MEDICINE_BRANDS = ['Genérico', 'Bayer', 'Pfizer', 'GSK', 'Sanofi', 'Genfar', 'MK', 'Lafed'];

export const RegistroView: React.FC<RegistroViewProps> = ({
  transactions,
  categories,
  currencySymbol,
  verifyPassword,
  onSave,
}) => {
  const [mainCategory, setMainCategory] = useState<MainCategory | null>(null);
  const [foodSubcategory, setFoodSubcategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [customItem, setCustomItem] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<UnitType>('unidades');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [medicineBrand, setMedicineBrand] = useState('Genérico');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle');

  // password protection for incomes
  const [securityOpen, setSecurityOpen] = useState(false);
  const [protectEnabled, setProtectEnabled] = useState(false);
  const [gatePassword, setGatePassword] = useState('');
  const [enteredGatePassword, setEnteredGatePassword] = useState('');
  const [unlocked, setUnlocked] = useState(true);

  const getHistory = (category: MainCategory, itemName: string) => {
    const matching = transactions
      .filter((t) => {
        if (category === 'ingresos') return t.type === 'income' && t.title.toLowerCase().includes(itemName.toLowerCase());
        return t.category === category && t.title.toLowerCase().includes(itemName.toLowerCase());
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return matching.length > 0
      ? { amount: matching[0].amount, date: matching[0].date }
      : null;
  };

  const lastHistory = useMemo(() => {
    if (mainCategory === 'comida' && selectedItem) return getHistory('comida', selectedItem);
    if (mainCategory === 'comida' && customTitle) return getHistory('comida', customTitle);
    if (mainCategory === 'transporte' && origin && destination) {
      const matching = transactions
        .filter((t) => t.category === 'transporte' && t.transportDetails)
        .filter((t) => {
          const td = t.transportDetails!;
          return td.origin.toLowerCase().includes(origin.toLowerCase()) &&
            td.destination.toLowerCase().includes(destination.toLowerCase());
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return matching.length > 0 ? { amount: matching[0].amount, date: matching[0].date } : null;
    }
    if (mainCategory === 'medicina' && medicineName) return getHistory('medicina', medicineName);
    if (mainCategory === 'ingresos' && customTitle) return getHistory('ingresos', customTitle);
    return null;
  }, [mainCategory, selectedItem, customTitle, origin, destination, medicineName, transactions]);

  const filteredMedicines = MEDICINE_SUGGESTIONS.filter((m) =>
    m.toLowerCase().includes(medicineName.toLowerCase())
  );

  const incomeLocked = protectEnabled && !!gatePassword && !unlocked;

  const handleAddToList = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (mainCategory === 'ingresos' && incomeLocked) return;

    let itemName = '';
    let category = mainCategory || 'otro';
    let subcat = '';
    let originVal = '';
    let destVal = '';
    let brand = '';
    const hist = lastHistory;
    let txType: 'expense' | 'income' = 'expense';

    if (mainCategory === 'comida') {
      itemName = customTitle || selectedItem || newItemName || 'Alimento';
      subcat = foodSubcategory || '';
      category = 'comida';
    } else if (mainCategory === 'transporte') {
      itemName = `${origin} → ${destination}`;
      originVal = origin;
      destVal = destination;
      category = 'transporte';
    } else if (mainCategory === 'medicina') {
      itemName = medicineName;
      brand = medicineBrand;
      category = 'medicina';
    } else if (mainCategory === 'ingresos') {
      itemName = customTitle || 'Ingreso';
      category = 'otro';
      txType = 'income';
    } else {
      itemName = customTitle || 'Registro';
      category = 'otro';
    }

    const newItem: PendingItem = {
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      category,
      subcategory: subcat,
      itemName,
      amount: parsedAmount,
      quantity: parseFloat(quantity) || 1,
      unit,
      date: new Date().toISOString().split('T')[0],
      txType,
      medicineBrand: brand,
      transportOrigin: originVal,
      transportDestination: destVal,
      historyAmount: hist?.amount,
      historyDate: hist?.date,
    };

    setPendingItems((prev) => [...prev, newItem]);

    setAmount('');
    setQuantity('1');
    setSelectedItem('');
    setCustomItem('');
    setCustomTitle('');
    setOrigin('');
    setDestination('');
    setMedicineName('');
    setNewItemName('');
    setShowNewItemInput(false);
  };

  const handleRemovePending = (id: string) => {
    setPendingItems((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveAll = () => {
    if (pendingItems.length === 0 || saveState !== 'idle') return;
    setSaveState('saving');

    pendingItems.forEach((item, index) => {
      setTimeout(() => {
        const transportDetails = item.category === 'transporte' && item.transportOrigin ? {
          origin: item.transportOrigin,
          destination: item.transportDestination || '',
          distanceKm: undefined as number | undefined,
          transportMode: 'taxi' as const,
          returnTrip: false,
        } : undefined;

        const medicineDetails = item.category === 'medicina' ? {
          pharmacy: item.itemName,
          doseNotes: item.medicineBrand,
        } : undefined;

        const tx: Transaction = {
          id: `tx_${Date.now()}_${index}`,
          title: item.itemName,
          amount: item.amount,
          type: item.txType,
          category: item.category || 'otro',
          date: item.date,
          time: new Date().toTimeString().slice(0, 5),
          quantity: item.quantity,
          unit: item.unit,
          notes: item.medicineBrand ? `${item.medicineBrand}` : undefined,
          paymentMethod: 'efectivo' as const,
          tags: item.subcategory ? [item.subcategory] : [],
          transportDetails,
          medicineDetails,
        };

        onSave(tx);
      }, index * 120);
    });

    setTimeout(() => {
      setSaveState('done');
      setTimeout(() => {
        setSaveState('idle');
        setPendingItems([]);
      }, 1800);
    }, pendingItems.length * 120 + 300);
  };

  const canAdd = amount && parseFloat(amount) > 0 && (
    (mainCategory === 'comida' && (selectedItem || customItem || newItemName || customTitle)) ||
    (mainCategory === 'transporte' && origin && destination) ||
    (mainCategory === 'medicina' && medicineName) ||
    (mainCategory === 'ingresos' && true) ||
    (mainCategory === 'nueva' && customTitle)
  );

  const renderPendingItems = () => {
    if (pendingItems.length === 0) return null;
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-600 mb-1 block">
          Registros acumulados ({pendingItems.length})
        </label>
        {pendingItems.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-zinc-200">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{item.itemName}</p>
              <p className="text-xs text-zinc-500">
                {item.quantity} {item.unit} · {currencySymbol}{item.amount.toFixed(2)}
                {item.txType === 'income' && <span className="ml-1 text-emerald-600">(ingreso)</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleRemovePending(item.id)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  if (!mainCategory) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-zinc-900">Nuevo Registro</h2>
        <p className="text-sm text-zinc-500">Selecciona una categoría</p>
        <div className="flex flex-col gap-3">
          {[
            { id: 'comida' as MainCategory, label: 'Comida', emoji: '🍎' },
            { id: 'transporte' as MainCategory, label: 'Transporte', emoji: '🚗' },
            { id: 'medicina' as MainCategory, label: 'Medicina', emoji: '💊' },
            { id: 'ingresos' as MainCategory, label: 'Ingresos', emoji: '📈' },
            { id: 'nueva' as MainCategory, label: 'Nueva', emoji: '✨' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setMainCategory(cat.id)}
              className="p-5 rounded-2xl bg-white border border-zinc-200 hover:border-blue-400 hover:shadow-md transition-all text-center"
            >
              <span className="text-2xl block mb-1">{cat.emoji}</span>
              <span className="font-medium text-zinc-900 text-sm">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const historyFilter = (tx: Transaction) => {
    if (mainCategory === 'ingresos') return tx.type === 'income';
    if (mainCategory === 'nueva') return false;
    return tx.category === mainCategory;
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setMainCategory(null); setPendingItems([]); }}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← Volver
        </button>
        <h2 className="text-lg font-bold text-zinc-900">
          {mainCategory === 'comida' && 'Registrar Comida'}
          {mainCategory === 'transporte' && 'Registrar Transporte'}
          {mainCategory === 'medicina' && 'Registrar Medicina'}
          {mainCategory === 'ingresos' && 'Registrar Ingreso'}
          {mainCategory === 'nueva' && 'Nueva Categoría'}
        </h2>
      </div>

      {/* COMIDA */}
      {mainCategory === 'comida' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-2 block">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'proteina', label: 'Proteína' },
                { id: 'carbohidratos', label: 'Carbohidratos' },
                { id: 'menestras', label: 'Menestras' },
                { id: 'frutas', label: 'Frutas' },
                { id: 'vegetales', label: 'Vegetales' },
                { id: 'chatarra', label: 'Chatarra' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => { setFoodSubcategory(sub.id); setSelectedItem(''); setCustomItem(''); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    foodSubcategory === sub.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {foodSubcategory && (
            <>
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-2 block">Alimento</label>
                <div className="flex flex-col gap-2">
                  {(DEFAULT_FOOD_ITEMS[foodSubcategory] || []).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setSelectedItem(item); setCustomItem(''); setCustomTitle(''); }}
                      className={`p-3 rounded-xl text-sm text-left transition-colors ${
                        selectedItem === item && !customItem
                          ? 'bg-blue-50 border-blue-500 border text-blue-700 font-medium'
                          : 'bg-zinc-50 border border-zinc-200 text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNewItemInput(true)}
                    className="p-3 rounded-xl text-sm text-left bg-zinc-50 border border-dashed border-zinc-300 text-zinc-500 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Nuevo
                  </button>
                </div>
              </div>

              {showNewItemInput && (
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <input
                    type="text"
                    placeholder="Nombre del nuevo alimento"
                    value={newItemName}
                    onChange={(e) => { setNewItemName(e.target.value); setCustomTitle(e.target.value); }}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-zinc-200 text-sm"
                    >
                      <option value="">Asignar a...</option>
                      <option value="proteina">Proteína</option>
                      <option value="carbohidratos">Carbohidratos</option>
                      <option value="menestras">Menestras</option>
                      <option value="frutas">Frutas</option>
                      <option value="vegetales">Vegetales</option>
                      <option value="chatarra">Chatarra</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewItemInput(false)}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">Cantidad y Unidad</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-l-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <div className="flex gap-0.5 rounded-r-xl overflow-hidden border border-l-0 border-zinc-200">
                    {(['unidades', 'kg', 'g'] as UnitType[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`px-3 py-2.5 text-xs font-medium transition-colors ${
                          unit === u
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        {u === 'unidades' ? 'ud' : u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">Precio unitario ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {lastHistory && selectedItem && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                    <History className="w-3.5 h-3.5" />
                    <span>Último registro</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700">{lastHistory.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-500 line-through">{currencySymbol}{lastHistory.amount.toFixed(2)}</span>
                      {amount && (
                        <span className="text-sm font-bold text-blue-600">
                          {currencySymbol}{parseFloat(amount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TRANSPORTE */}
      {mainCategory === 'transporte' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Origen</label>
            <input
              type="text"
              placeholder="Punto de partida"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Destino</label>
            <input
              type="text"
              placeholder="Punto de llegada"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Precio ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          {lastHistory && origin && destination && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                <History className="w-3.5 h-3.5" />
                <span>Último viaje similar</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700">{lastHistory.date}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 line-through">{currencySymbol}{lastHistory.amount.toFixed(2)}</span>
                  {amount && (
                    <span className="text-sm font-bold text-blue-600">
                      {currencySymbol}{parseFloat(amount).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MEDICINA */}
      {mainCategory === 'medicina' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Nombre</label>
            <input
              type="text"
              placeholder="Paracetamol, Ibuprofeno..."
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            {medicineName && filteredMedicines.length > 0 && (
              <div className="mt-1 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                {filteredMedicines.slice(0, 5).map((med) => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => setMedicineName(med)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    {med}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Marca / Genérico</label>
            <select
              value={medicineBrand}
              onChange={(e) => setMedicineBrand(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm"
            >
              {MEDICINE_BRANDS.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Precio ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          {lastHistory && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                <History className="w-3.5 h-3.5" />
                <span>Último registro</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700">{lastHistory.date}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 line-through">{currencySymbol}{lastHistory.amount.toFixed(2)}</span>
                  {amount && (
                    <span className="text-sm font-bold text-blue-600">
                      {currencySymbol}{parseFloat(amount).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INGRESOS */}
      {mainCategory === 'ingresos' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Concepto</label>
            <input
              type="text"
              placeholder="Sueldo, honorarios, venta..."
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Monto ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          {lastHistory && customTitle && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 text-xs text-emerald-600 mb-1">
                <History className="w-3.5 h-3.5" />
                <span>Último ingreso similar</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700">{lastHistory.date}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 line-through">{currencySymbol}{lastHistory.amount.toFixed(2)}</span>
                  {amount && (
                    <span className="text-sm font-bold text-emerald-600">
                      {currencySymbol}{parseFloat(amount).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NUEVA CATEGORÍA */}
      {mainCategory === 'nueva' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Nombre</label>
            <input
              type="text"
              placeholder="Nombre del registro"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Precio ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Cantidad</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-l-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <div className="flex gap-0.5 rounded-r-xl overflow-hidden border border-l-0 border-zinc-200">
                {(['unidades', 'kg', 'g'] as UnitType[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-3 py-2.5 text-xs font-medium transition-colors ${
                      unit === u
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {u === 'unidades' ? 'ud' : u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security collapsible */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setSecurityOpen(!securityOpen)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-zinc-900">Seguridad (contraseña)</span>
          </div>
          {securityOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>
        {securityOpen && (
          <div className="px-3 pb-3 border-t border-zinc-100 pt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={protectEnabled}
                onChange={(e) => { setProtectEnabled(e.target.checked); if (!e.target.checked) { setUnlocked(true); setGatePassword(''); } }}
                className="w-4 h-4"
              />
              Proteger ingresos con contraseña
            </label>
            {protectEnabled && (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Contraseña de registro</label>
                  <input
                    type="password"
                    placeholder="Establecer contraseña"
                    value={gatePassword}
                    onChange={(e) => setGatePassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
                  />
                </div>
                {incomeLocked && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Desbloquear para registrar ingreso</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Contraseña"
                        value={enteredGatePassword}
                        onChange={(e) => setEnteredGatePassword(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const ok = (verifyPassword ? verifyPassword(enteredGatePassword) : enteredGatePassword === gatePassword);
                          if (ok) setUnlocked(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    </div>
                    {!unlocked && enteredGatePassword && <p className="text-xs text-rose-500 mt-1">Contraseña incorrecta</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {pendingItems.length > 0 && renderPendingItems()}

      <button
        type="button"
        onClick={handleAddToList}
        disabled={!canAdd || (mainCategory === 'ingresos' && incomeLocked)}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        Agregar a la lista
      </button>

      {/* SAVE BUTTON WITH ANIMATION */}
      <button
        type="button"
        onClick={handleSaveAll}
        disabled={pendingItems.length === 0 || saveState !== 'idle'}
        className={`relative w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all overflow-hidden ${
          saveState === 'done'
            ? 'bg-emerald-500 text-white cursor-default'
            : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
      >
        {saveState === 'saving' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </span>
        )}
        {saveState === 'done' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Check className="w-6 h-6 animate-in zoom-in-75 duration-300 text-white" />
          </span>
        )}
        <span className={`flex items-center gap-2 transition-opacity duration-200 ${
          saveState !== 'idle' ? 'opacity-0' : 'opacity-100'
        }`}>
          <Save className="w-4 h-4" />
          Guardar {pendingItems.length > 0 ? `(${pendingItems.length})` : ''}
        </span>
      </button>

      {/* Purchase History */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-zinc-900">
            Historial
            {mainCategory === 'comida' && ' de Comida'}
            {mainCategory === 'transporte' && ' de Transporte'}
            {mainCategory === 'medicina' && ' de Medicina'}
            {mainCategory === 'ingresos' && ' de Ingresos'}
            {mainCategory === 'nueva' && ' General'}
          </h3>
          <span className="text-xs text-zinc-500">
            {transactions.filter((tx) => historyFilter(tx)).length} registros
          </span>
        </div>
        <div className="divide-y divide-zinc-100">
          {transactions
            .filter((tx) => historyFilter(tx))
            .map((tx) => (
            <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                  style={{ backgroundColor: categories.find((c) => c.id === tx.category)?.color || '#8E8E93' }}
                >
                  {tx.title.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{tx.title}</p>
                  <p className="text-xs text-zinc-500">
                    {tx.date}{tx.quantity ? ` · ${tx.quantity} ${tx.unit || 'ud'}` : ''}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-bold flex-shrink-0 ${tx.type === 'expense' ? 'text-zinc-900' : 'text-emerald-600'}`}>
                {tx.type === 'expense' ? '-' : '+'}{currencySymbol}{tx.amount.toFixed(2)}
              </span>
            </div>
          ))}
          {transactions.filter((tx) => historyFilter(tx)).length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">Sin registros aún</p>
          )}
        </div>
      </div>
    </div>
  );
};

