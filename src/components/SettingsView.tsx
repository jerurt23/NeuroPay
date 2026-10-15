import React from 'react';
import { Sun, Moon, User, LogOut } from 'lucide-react';
import { UserSettings, ThemeMode } from '../types/index.ts';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onLogout,
}) => {
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
        <h3 className="font-bold text-zinc-900">Perfil</h3>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-bold flex items-center justify-center">
            {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <p className="font-medium text-zinc-900">{settings.userName || 'Usuario'}</p>
            <p className="text-sm text-zinc-500">{settings.userEmail || 'sin email'}</p>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
        <h3 className="font-bold text-zinc-900">Apariencia</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">Tema</span>
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 text-sm font-medium"
          >
            {settings.theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {settings.theme === 'light' ? 'Claro' : 'Oscuro'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="w-full p-4 rounded-2xl bg-white border border-zinc-200 text-rose-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  );
};
