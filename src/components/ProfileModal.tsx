import React, { useState } from 'react';
import { X, Upload, Lock, Key, LogOut, Check, Camera, ChevronDown, ChevronUp, BarChart3, LineChart, Layers, PieChart, Coins, User, Trash2, Mail, RotateCcw } from 'lucide-react';
import { UserSettings, Transaction, CategoryInfo } from '../types/index.ts';
import { GmailSyncPanel } from './GmailSyncPanel.tsx';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  transactions?: Transaction[];
  categories?: CategoryInfo[];
  currentPassword: string;
  onUpdateSettings: (s: Partial<UserSettings>) => void;
  onChangePassword: (oldP: string, newP: string) => boolean;
  onDeleteCustomCategory?: (id: string, deriveTo?: string) => void;
  onLogout: () => void;
  /** Borra todo en la nube y en este dispositivo. Devuelve un aviso si quedó algo pendiente. */
  onResetAll: () => Promise<string | null>;
  /** Token de sesión de NEUROPAY, para hablar con el servidor. */
  getIdToken: () => Promise<string>;
  onImportTransactions: (txs: Transaction[]) => void;
}

const COUNTRY_CURRENCIES = [
  { code: 'PE', name: 'Perú', symbol: 'S/' },
  { code: 'US', name: 'Estados Unidos', symbol: '$' },
  { code: 'ES', name: 'España', symbol: '€' },
  { code: 'MX', name: 'México', symbol: 'MX$' },
  { code: 'AR', name: 'Argentina', symbol: 'ARS$' },
  { code: 'CL', name: 'Chile', symbol: 'CLP$' },
  { code: 'CO', name: 'Colombia', symbol: 'COL$' },
];

type Section = 'chart' | 'currency' | 'account' | 'gmail' | 'theme';

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  onClose,
  settings,
  transactions = [],
  categories = [],
  currentPassword,
  onUpdateSettings,
  onChangePassword,
  onDeleteCustomCategory,
  onLogout,
  onResetAll,
  getIdToken,
  onImportTransactions,
}) => {
  const [name, setName] = useState(settings.userName || '');
  const [email, setEmail] = useState(settings.userEmail || '');
  const [photo, setPhoto] = useState<string | null>(settings.userPhoto || null);
  const [savedBasic, setSavedBasic] = useState(false);
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set());
  const [openCatEdit, setOpenCatEdit] = useState(false);
  const [deriveTargets, setDeriveTargets] = useState<Record<string, string>>({});

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [resetTexto, setResetTexto] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetAviso, setResetAviso] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  if (!open) return null;

  const toggleSection = (s: Section) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhoto(result);
      onUpdateSettings({ userPhoto: result });
    };
    reader.readAsDataURL(file);
  };

  const saveBasic = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ userName: name, userEmail: email });
    setSavedBasic(true);
    setTimeout(() => setSavedBasic(false), 1500);
  };

  const handleChangePassword = () => {
    setPassError(null);
    setPassMsg(null);
    if (!oldPass || !newPass) {
      setPassError('Completa todos los campos.');
      return;
    }
    if (newPass.length < 6) {
      setPassError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('Las contraseñas nuevas no coinciden.');
      return;
    }
    const ok = onChangePassword(oldPass, newPass);
    if (!ok) {
      setPassError('La contraseña actual es incorrecta.');
      return;
    }
    setPassMsg('Contraseña cambiada correctamente.');
    setOldPass(''); setNewPass(''); setConfirmPass('');
  };

  const handleResetAll = async () => {
    setResetError(null);
    setResetAviso(null);
    setResetBusy(true);
    try {
      const aviso = await onResetAll();
      if (aviso) {
        setResetAviso(aviso);
      } else {
        setResetTexto('');
        onClose();
      }
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'No se pudo resetear. Intenta de nuevo.');
    } finally {
      setResetBusy(false);
    }
  };

  const isBasicOpen = true;

  return (
    <div
      className="fixed inset-0 z-50 safe-overlay flex items-center justify-center p-4 bg-white/40 backdrop-blur-2xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white/90 rounded-3xl p-6 border border-white/60 shadow-2xl space-y-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-main">Perfil de Usuario</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-zinc-400 hover:text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Basic info */}
        {isBasicOpen && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3">
              <label className="relative cursor-pointer group">
                {photo ? (
                  <img src={photo} alt="Perfil" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold flex items-center justify-center">
                    {name ? name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 p-1.5 bg-blue-600 text-white rounded-full group-hover:scale-110 transition-transform">
                  <Camera className="w-3.5 h-3.5" />
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
              <span className="text-xs text-muted">Toca para cambiar foto</span>
            </div>

            <form onSubmit={saveBasic} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-line text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                {savedBasic ? <Check className="w-4 h-4" /> : <User className="w-4 h-4" />}
                {savedBasic ? 'Guardado' : 'Guardar perfil'}
              </button>
            </form>
          </div>
        )}

        {/* Settings container */}
        <div className="pt-3 border-t border-zinc-100">
          <p className="text-xs font-semibold text-muted uppercase mb-2">Configuración</p>

          {/* Graficos */}
          <div className="rounded-xl border border-line overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('chart')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-main">Gráficos</span>
              </div>
              {openSections.has('chart') ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {openSections.has('chart') && (
              <div className="px-3 pb-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
                {([
                  { v: 'bar' as const, label: 'Barras', Icon: BarChart3 },
                  { v: 'line' as const, label: 'Líneas', Icon: LineChart },
                  { v: 'stacked' as const, label: 'Apiladas', Icon: Layers },
                  { v: 'pie' as const, label: 'Circular', Icon: PieChart },
                ]).map(({ v, label, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdateSettings({ chartType: v })}
                    className={`py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                      (settings.chartType || 'bar') === v
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-100 text-muted hover-surface'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Moneda */}
          <div className="rounded-xl border border-line overflow-hidden mt-2">
            <button
              type="button"
              onClick={() => toggleSection('currency')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-main">Tipo de Moneda</span>
              </div>
              {openSections.has('currency') ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {openSections.has('currency') && (
              <div className="px-3 pb-3 border-t border-zinc-100 pt-3 space-y-2">
                {COUNTRY_CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onUpdateSettings({ countryCode: c.code, currencySymbol: c.symbol })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      settings.countryCode === c.code
                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                        : 'bg-zinc-50 text-muted hover:bg-zinc-100'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="font-bold">{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sincronizar con correo */}
          <div className="rounded-xl border border-line overflow-hidden mt-2">
            <button
              type="button"
              onClick={() => toggleSection('gmail')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-rose-500" />
                <span className="text-sm font-medium text-main">Sincronizar con correo</span>
              </div>
              {openSections.has('gmail') ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {openSections.has('gmail') && (
              <div className="px-3 pb-3 border-t border-zinc-100 pt-3">
                <GmailSyncPanel
                  getIdToken={getIdToken}
                  transactions={transactions}
                  onImport={onImportTransactions}
                />
              </div>
            )}
          </div>

          {/* Cuenta */}
          <div className="rounded-xl border border-line overflow-hidden mt-2">
            <button
              type="button"
              onClick={() => toggleSection('account')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-main">Cuenta</span>
              </div>
              {openSections.has('account') ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {openSections.has('account') && (
              <div className="px-3 pb-3 border-t border-zinc-100 pt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Nombre de usuario</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Correo</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { onUpdateSettings({ userName: name, userEmail: email }); }}
                  className="w-full py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-muted text-sm font-medium"
                >
                  Guardar datos de cuenta
                </button>

                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <p className="text-xs font-medium text-muted">Cambiar contraseña</p>
                  <input
                    type="password"
                    placeholder="Contraseña actual"
                    value={oldPass}
                    onChange={(e) => setOldPass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Confirmar"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-line text-sm"
                  />
                  {passError && <p className="text-xs text-rose-500">{passError}</p>}
                  {passMsg && <p className="text-xs text-emerald-600">{passMsg}</p>}
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    className="w-full py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium"
                  >
                    Actualizar contraseña
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-line overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenCatEdit((v) => !v)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-muted" />
              <h3 className="font-bold text-main">Edicion de Categorias</h3>
            </div>
            <span className="text-xs text-zinc-400">{openCatEdit ? '^' : 'v'}</span>
          </button>
          {openCatEdit && (
            <div className="px-5 pb-5 space-y-3 border-t border-zinc-100">
              <p className="text-xs text-muted pt-3">
                Verifica enlaces, deriva datos a otra categoria y elimina.
              </p>
              {(settings.customCategories || []).length === 0 && (
                <p className="text-sm text-zinc-400">No hay categorias personalizadas.</p>
              )}
              {(settings.customCategories || []).map((cat) => {
                const linkedTransactions = transactions.filter((t) => t.category === cat.id);
                const linkedDashboard = settings.dashboardGroups?.[cat.name];
                const target = deriveTargets[cat.id] || categories[0]?.id || 'comida';
                return (
                  <div key={cat.id} className="p-3 rounded-xl bg-zinc-50 border border-line space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-main">{cat.name}</p>
                        <p className="text-xs text-muted">
                          {linkedTransactions.length} registro(s)
                          {linkedDashboard ? ' · Vinculada a dashboard' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm('Estas seguro que quieres eliminar esta categoria?')) return;
                          onDeleteCustomCategory?.(cat.id, target);
                        }}
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                        title="Eliminar categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Derivar datos a:</label>
                      <select
                        value={target}
                        onChange={(e) => setDeriveTargets((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-line text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        {(settings.customCategories || [])
                          .filter((x) => x.id !== cat.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>{x.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reset all */}
        <div className="rounded-2xl bg-rose-50/60 border border-rose-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-rose-600">Reset all</h3>
          </div>
          <p className="text-xs text-muted">
            Borra tus movimientos, presupuestos, categorías, ajustes, foto y las cuentas de Gmail conectadas, tanto en este dispositivo como en la nube. Tu inicio de sesión se mantiene. No se puede deshacer.
          </p>
          <input
            type="text"
            placeholder="Escribe RESET para confirmar"
            value={resetTexto}
            onChange={(e) => setResetTexto(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-line text-sm"
          />
          {resetError && <p className="text-xs text-rose-500">{resetError}</p>}
          {resetAviso && <p className="text-xs text-amber-600">{resetAviso}</p>}
          <button
            type="button"
            disabled={resetTexto.trim() !== 'RESET' || resetBusy}
            onClick={handleResetAll}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resetBusy ? 'Borrando...' : 'Resetear todo'}
          </button>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
