import React, { useState } from 'react';
import { X, Upload, Lock, Key, LogOut, Check, Camera } from 'lucide-react';
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
  const [photo, setPhoto] = useState<string | null>(settings.userPhoto || null);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhoto(result);
      onUpdateSettings({ userPhoto: result } as any);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ userName: name });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-2xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white/80 rounded-3xl p-6 border border-white/60 shadow-2xl space-y-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Perfil de Usuario</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo */}
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

        {/* Name */}
        <form onSubmit={handleSaveProfile} className="space-y-3">
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
            {saved ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {saved ? 'Guardado' : 'Guardar perfil'}
          </button>
        </form>

        {/* Change password */}
        <div className="space-y-2 pt-3 border-t border-zinc-100">
          <p className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-500" />
            Cambiar contraseña
          </p>
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
            placeholder="Confirmar nueva contraseña"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm"
          />
          {passError && <p className="text-xs text-rose-500">{passError}</p>}
          {passMsg && <p className="text-xs text-emerald-600">{passMsg}</p>}
          <button
            type="button"
            onClick={handleChangePassword}
            className="w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Actualizar contraseña
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
