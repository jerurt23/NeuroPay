import React, { useState } from 'react';
import { X, Upload, Lock, Key, LogOut, Check, Camera, ChevronDown, ChevronUp, BarChart3, LineChart, Coins, User, Moon, Sun } from 'lucide-react';
import { UserSettings } from '../types/index.ts';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  currentPassword: string;
  onUpdateSettings: (s: Partial<UserSettings>) => void;
  onChangePassword: (oldP: string, newP: string) => boolean;
  onLogout: () => void;
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

type Section = 'chart' | 'currency' | 'account' | 'theme';

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  onClose,
  settings,
  currentPassword,
  onUpdateSettings,
  onChangePassword,
  onLogout,
}) => {
  const [name, setName] = useState(settings.userName || '');
  const [email, setEmail] = useState(settings.userEmail || '');
  const [photo, setPhoto] = useState<string | null>(settings.userPhoto || null);
  const [savedBasic, setSavedBasic] = useState(false);
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set());

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

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

  const isBasicOpen = true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-2xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white/90 rounded-3xl p-6 border border-white/60 shadow-2xl space-y-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Perfil de Usuario</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600">
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
              <span className="text-xs text-zinc-500">Toca para cambiar foto</span>
            </div>

            <form onSubmit={saveBasic} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
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
          <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Configuración</p>

          {/* Graficos */}
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('chart')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-zinc-900">Gráficos</span>
              </div>
              {openSections.has('chart') ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {openSections.has('chart') && (
              <div className="px-3 pb-3 flex gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ chartType: 'bar' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                    (settings.chartType || 'bar') === 'bar'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" /> Barras
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ chartType: 'line' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                    settings.chartType === 'line'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <LineChart className="w-4 h-4" /> Líneas
                </button>
              </div>
            )}
          </div>

          {/* Moneda */}
          <div className="rounded-xl border border-zinc-200 overflow-hidden mt-2">
            <button
              type="button"
              onClick={() => toggleSection('currency')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-zinc-900">Tipo de Moneda</span>
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
                        : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="font-bold">{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cuenta */}
          <div className="rounded-xl border border-zinc-200 overflow-hidden mt-2">
            <button
              type="button"
              onClick={() => toggleSection('account')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-zinc-900">Cuenta</span>
              </div>
              {openSections.has('account') ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {openSections.has('account') && (
              <div className="px-3 pb-3 border-t border-zinc-100 pt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Nombre de usuario</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Correo</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { onUpdateSettings({ userName: name, userEmail: email }); }}
                  className="w-full py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium"
                >
                  Guardar datos de cuenta
                </button>

                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <p className="text-xs font-medium text-zinc-600">Cambiar contraseña</p>
                  <input
                    type="password"
                    placeholder="Contraseña actual"
                    value={oldPass}
                    onChange={(e) => setOldPass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Confirmar"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
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

          {/* Temas */}
          <div className="rounded-xl border border-zinc-200 overflow-hidden mt-2">
            <button
              type="button"
              onClick={() => toggleSection('theme')}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-zinc-900">Temas</span>
              </div>
              {openSections.has('theme') ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {openSections.has('theme') && (
              <div className="px-3 pb-3 border-t border-zinc-100 pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'light' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    settings.theme === 'light' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'dark' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    settings.theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Oscuro
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'auto' })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    settings.theme === 'auto' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Auto
                </button>
              </div>
            )}
          </div>
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
