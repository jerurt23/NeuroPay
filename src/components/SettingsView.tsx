import React, { useState } from 'react';
import {
  Sun,
  Moon,
  User,
  LogOut,
  Sliders,
  Layers,
  Grid,
  Check,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { UserSettings, ThemeMode, TabConfig, WidgetConfig, WidgetSize } from '../types/index.ts';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  tabs: TabConfig[];
  onUpdateTabs: (tabs: TabConfig[]) => void;
  widgets: WidgetConfig[];
  onUpdateWidgets: (widgets: WidgetConfig[]) => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  tabs,
  onUpdateTabs,
  widgets,
  onUpdateWidgets,
  onLogout,
}) => {
  const [newTabName, setNewTabName] = useState('');

  const moveTab = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= tabs.length) return;
    const copy = [...tabs];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    copy.forEach((t, i) => (t.order = i));
    onUpdateTabs(copy);
  };

  const toggleTab = (id: string) => {
    onUpdateTabs(tabs.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const toggleWidget = (id: string) => {
    onUpdateWidgets(widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  };

  const changeWidgetSize = (id: string, size: WidgetSize) => {
    onUpdateWidgets(widgets.map((w) => (w.id === id ? { ...w, size } : w)));
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= widgets.length) return;
    const copy = [...widgets];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    copy.forEach((w, i) => (w.order = i));
    onUpdateWidgets(copy);
  };

  const handleAddTab = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTabName.trim();
    if (!name) return;
    const newTab: TabConfig = {
      id: `custom_${Date.now()}`,
      name,
      icon: 'Sparkles',
      enabled: true,
      isCustom: true,
      order: tabs.length,
    };
    onUpdateTabs([...tabs, newTab]);
    setNewTabName('');
  };

  const deleteCustomTab = (id: string) => {
    onUpdateTabs(tabs.filter((t) => t.id !== id));
  };

  const activeTabs = tabs
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order);

  const enabledWidgets = widgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Profile */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-3">
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

      {/* Appearance */}
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">True Tone</p>
            <p className="text-xs text-zinc-500">Calidez ambiental inteligente</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ trueTone: !settings.trueTone })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.trueTone ? 'bg-amber-500' : 'bg-zinc-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                settings.trueTone ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs management */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-zinc-900">Organizar Pestañas</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-2">
          Activa, desactiva, y reordena las pestañas de la barra inferior.
        </p>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
          {tabs.sort((a, b) => a.order - b.order).map((tab, index) => (
            <div
              key={tab.id}
              className="flex items-center justify-between gap-2 p-2.5 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleTab(tab.id)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    tab.enabled ? 'bg-blue-600 text-white' : 'border border-zinc-300'
                  }`}
                >
                  {tab.enabled && <Check className="w-3.5 h-3.5" />}
                </button>
                <span className={tab.enabled ? 'text-zinc-900' : 'text-zinc-400 line-through'}>
                  {tab.name}
                </span>
                {tab.isCustom && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-bold">
                    Custom
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveTab(index, 'up')}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === tabs.length - 1}
                  onClick={() => moveTab(index, 'down')}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                {tab.isCustom && (
                  <button
                    type="button"
                    onClick={() => deleteCustomTab(tab.id)}
                    className="p-1 rounded text-rose-400 hover:text-rose-600 ml-1"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddTab} className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="Nombre de nueva pestaña"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-zinc-100 border border-zinc-200 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
          >
            + Agregar
          </button>
        </form>
      </div>

      {/* Widgets */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Grid className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-zinc-900">Widgets del Tablero</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-2">
          Activa, desactiva, reordena y redimensiona los widgets del dashboard.
        </p>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
          {widgets.sort((a, b) => a.order - b.order).map((w, index) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-2.5 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleWidget(w.id)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    w.enabled ? 'bg-indigo-600 text-white' : 'border border-zinc-300'
                  }`}
                >
                  {w.enabled && <Check className="w-3.5 h-3.5" />}
                </button>
                <span className={w.enabled ? 'text-zinc-900' : 'text-zinc-400 line-through'}>
                  {w.title}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={w.size}
                  onChange={(e) => changeWidgetSize(w.id, e.target.value as WidgetSize)}
                  className="text-xs px-2 py-1 rounded bg-zinc-100 border border-zinc-200"
                >
                  <option value="small">S</option>
                  <option value="medium">M</option>
                  <option value="large">L</option>
                </select>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveWidget(index, 'up')}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === widgets.length - 1}
                  onClick={() => moveWidget(index, 'down')}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
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
