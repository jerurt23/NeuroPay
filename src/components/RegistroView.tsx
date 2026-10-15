import React, { useState, useMemo } from 'react';
import { Plus, History, Save, ChevronDown, X } from 'lucide-react';
import { Transaction, CategoryInfo } from '../types/index.ts';

interface RegistroViewProps {
  transactions: Transaction[];
  categories: CategoryInfo[];
  currencySymbol: string;
  onSave: (tx: Transaction) => void;
}

type MainCategory = 'comida' | 'transporte' | 'medicina' | 'nueva';

interface FoodItem {
  id: string;
  name: string;
  category: string;
}

interface RegistroHistory {
  id: string;
  category: string;
  subcategory: string;
  itemName: string;
  amount: number;
  quantity?: number;
  date: string;
  details?: string;
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
  onSave,
}) => {
  const [mainCategory, setMainCategory] = useState<MainCategory | null>(null);
  const [foodSubcategory, setFoodSubcategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [customItem, setCustomItem] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [medicineBrand, setMedicineBrand] = useState('Genérico');
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [customFoodCategory, setCustomFoodCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customItems, setCustomItems] = useState<FoodItem[]>([]);

  const allFoodItems = useMemo(() => {
    return { ...DEFAULT_FOOD_ITEMS };
  }, []);

  const getHistory = (category: string, itemName: string): RegistroHistory | null => {
    const matching = transactions
      .filter(t => t.category === category && t.title.toLowerCase().includes(itemName.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return matching.length > 0 ? {
      id: matching[0].id,
      category: matching[0].category,
      subcategory: '',
      itemName: matching[0].title,
      amount: matching[0].amount,
      date: matching[0].date,
      details: matching[0].notes,
    } : null;
  };

  const lastFoodHistory = useMemo(() => {
    if (!selectedItem) return null;
    return getHistory('comida', selectedItem);
  }, [selectedItem, transactions]);

  const lastTransportHistory = useMemo(() => {
    if (!origin || !destination) return null;
    const matching = transactions
      .filter(t => t.category === 'transporte' && t.transportDetails)
      .filter(t => {
        const od = t.transportDetails!.origin.toLowerCase().includes(origin.toLowerCase()) &&
                   t.transportDetails!.destination.toLowerCase().includes(destination.toLowerCase());
        return od;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return matching.length > 0 ? {
      id: matching[0].id,
      category: 'transporte',
      subcategory: '',
      itemName: `${matching[0].transportDetails!.origin} → ${matching[0].transportDetails!.destination}`,
      amount: matching[0].amount,
      date: matching[0].date,
      details: matching[0].notes,
    } : null;
  }, [origin, destination, transactions]);

  const lastMedicineHistory = useMemo(() => {
    if (!medicineName) return null;
    return getHistory('medicina', medicineName);
  }, [medicineName, transactions]);

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    let title = '';
    let details = '';
    let transportDetails = undefined;
    let medicineDetails = undefined;

    if (mainCategory === 'comida') {
      const itemName = customItem || selectedItem || newItemName || 'Alimento';
      title = itemName;
      details = foodSubcategory ? `${foodSubcategory} - ${itemName}` : itemName;
    } else if (mainCategory === 'transporte') {
      title = `${origin} → ${destination}`;
      details = `Ruta: ${origin} a ${destination}`;
      transportDetails = {
        origin,
        destination,
        distanceKm: undefined,
        transportMethod: 'taxi' as const,
        returnTrip: false,
      };
    } else if (mainCategory === 'medicina') {
      title = medicineName;
      details = `${medicineBrand} - ${medicineName}`;
      medicineDetails = {
        name: medicineName,
        brand: medicineBrand,
      };
    } else if (mainCategory === 'nueva') {
      title = customItem || 'Nuevo registro';
      details = customItem;
    }

    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      title,
      amount: parsedAmount,
      type: 'expense' as const,
      category: mainCategory || 'otro',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      notes: details,
      paymentMethod: 'efectivo' as const,
      tags: [],
      transportDetails,
      medicineDetails,
    };

    onSave(newTx);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    resetForm();
  };

  const resetForm = () => {
    setMainCategory(null);
    setFoodSubcategory(null);
    setSelectedItem('');
    setCustomItem('');
    setAmount('');
    setQuantity('1');
    setOrigin('');
    setDestination('');
    setMedicineName('');
    setMedicineBrand('Genérico');
    setShowNewItemInput(false);
    setNewItemName('');
    setNewItemCategory('');
    setCustomFoodCategory('');
    setShowCustomCategory(false);
  };

  const filteredMedicines = MEDICINE_SUGGESTIONS.filter(m =>
    m.toLowerCase().includes(medicineName.toLowerCase())
  );

  if (!mainCategory) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-zinc-900">Nuevo Registro</h2>
        <p className="text-sm text-zinc-500">Selecciona una categoría</p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'comida' as MainCategory, label: 'Comida', emoji: '🍎' },
            { id: 'transporte' as MainCategory, label: 'Transporte', emoji: '🚗' },
            { id: 'medicina' as MainCategory, label: 'Medicina', emoji: '💊' },
            { id: 'nueva' as MainCategory, label: 'Nueva Categoría', emoji: '✨' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setMainCategory(cat.id)}
              className="p-6 rounded-2xl bg-white border border-zinc-200 hover:border-blue-400 hover:shadow-md transition-all text-center"
            >
              <span className="text-3xl block mb-2">{cat.emoji}</span>
              <span className="font-medium text-zinc-900">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={resetForm}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← Volver
        </button>
        <h2 className="text-lg font-bold text-zinc-900">
          {mainCategory === 'comida' && 'Registrar Comida'}
          {mainCategory === 'transporte' && 'Registrar Transporte'}
          {mainCategory === 'medicina' && 'Registrar Medicina'}
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
                <div className="grid grid-cols-2 gap-2">
                  {(allFoodItems[foodSubcategory] || []).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setSelectedItem(item); setCustomItem(''); }}
                      className={`p-3 rounded-xl text-sm text-left transition-colors ${
                        selectedItem === item
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
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-zinc-200 text-sm"
                    >
                      <option value="">Asignar a categoría...</option>
                      <option value="proteina">Proteína</option>
                      <option value="carbohidratos">Carbohidratos</option>
                      <option value="menestras">Menestras</option>
                      <option value="frutas">Frutas</option>
                      <option value="vegetales">Vegetales</option>
                      <option value="chatarra">Chatarra</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (newItemName.trim()) {
                          setSelectedItem(newItemName);
                          setCustomItem(newItemName);
                          setShowNewItemInput(false);
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">Precio ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {lastFoodHistory && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                    <History className="w-3.5 h-3.5" />
                    <span>Último registro</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700">{lastFoodHistory.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-500 line-through">{currencySymbol}{lastFoodHistory.amount.toFixed(2)}</span>
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

          {lastTransportHistory && origin && destination && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                <History className="w-3.5 h-3.5" />
                <span>Último viaje similar</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700">{lastTransportHistory.date}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 line-through">{currencySymbol}{lastTransportHistory.amount.toFixed(2)}</span>
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

          {lastMedicineHistory && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                <History className="w-3.5 h-3.5" />
                <span>Último registro</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-700">{lastMedicineHistory.date}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 line-through">{currencySymbol}{lastMedicineHistory.amount.toFixed(2)}</span>
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

      {/* NUEVA CATEGORÍA */}
      {mainCategory === 'nueva' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Nombre</label>
            <input
              type="text"
              placeholder="Nombre del registro"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
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
        </div>
      )}

      {/* SAVE BUTTON */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!amount || parseFloat(amount) <= 0}
        className={`w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
      >
        {saved ? (
          <>Guardado</>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Guardar Registro
          </>
        )}
      </button>
    </div>
  );
};
