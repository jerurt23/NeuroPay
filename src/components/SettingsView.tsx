import React, { useState } from 'react';
import {
  LogOut,
  Layers,
  Grid,
  Check,
  GripVertical,
  Flame,
  Snowflake,
} from 'lucide-react';
import { UserSettings, TabConfig, WidgetConfig, WidgetSize } from '../types/index.ts';

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
  const [openTabs, setOpenTabs] = useState(true);
  const [openWidgets, setOpenWidgets] = useState(true);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  const persistTabs = (next: TabConfig[]) => {
    next.forEach((t, i) => (t.order = i));
    onUpdateTabs(next);
  };

  const persistWidgets = (next: WidgetConfig[]) => {
    next.forEach((w, i) => (w.order = i));
    onUpdateWidgets(next);
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
    persistTabs([...sortedTabs, newTab]);
    setNewTabName('');
  };

  const deleteCustomTab = (id: string) => {
    persistTabs(sortedTabs.filter((t) => t.id !== id));
  };

  // Drag & Drop tabs
  const onTabDragStart = (id: string) => setDraggedTab(id);
  const onTabDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedTab || draggedTab === id) return;
    const reordered = [...sortedTabs];
    const from = reordered.findIndex((t) => t.id === draggedTab);
    const to = reordered.findIndex((t) => t.id === id);
    if (from === -1 || to === -1) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    persistTabs(reordered);
  };
  const onTabDragEnd = () => setDraggedTab(null);

  // Drag & Drop widgets
  const onWidgetDragStart = (id: string) => setDraggedWidget(id);
  const onWidgetDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === id) return;
    const reordered = [...sortedWidgets];
    const from = reordered.findIndex((w) => w.id === draggedWidget);
    const to = reordered.findIndex((w) => w.id === id);
    if (from === -1 || to === -1) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    persistWidgets(reordered);
  };
  const onWidgetDragEnd = () => setDraggedWidget(null);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Profile */}
      <div className="p-5 rounded-2xl bg-white border border-line space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-bold flex items-center justify-center">
            {settings.userName ? settings.userName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <p className="font-medium text-main">{settings.userName || 'Usuario'}</p>
            <p className="text-sm text-muted">{settings.userEmail || 'sin email'}</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="p-5 rounded-2xl surface-card border-line space-y-4">
        <h3 className="font-bold text-main">Apariencia</h3>

        {/* True Tone */}
        <div>
          <div className="mb-2">
            <p className="text-sm font-medium text-main">True Tone</p>
            <p className="text-xs text-muted">Ajusta la temperatura de color de la pantalla</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { v: 'off' as const, label: 'Normal', Icon: Check },
              { v: 'warm' as const, label: 'Calido', Icon: Flame },
              { v: 'cool' as const, label: 'Frio', Icon: Snowflake },
            ]).map(({ v, label, Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => onUpdateSettings({ colorTemperature: v, trueTone: false })}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  (settings.colorTemperature ?? 'off') === v
                    ? 'bg-amber-500 text-white'
                    : 'bg-zinc-100 text-muted hover-surface'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">
            Reduce el brillo azul de la pantalla, similar al True Tone de Apple.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-main">Notificaciones Push</p>
            <p className="text-xs text-muted">Alertas en tiempo real</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!settings.pushNotifications) {
                try {
                  if (typeof Notification !== 'undefined') {
                    const perm = await Notification.requestPermission();
                    if (perm === 'granted') {
                      onUpdateSettings({ pushNotifications: true });
                    }
                  } else {
                    onUpdateSettings({ pushNotifications: true });
                  }
                } catch (_) {
                  onUpdateSettings({ pushNotifications: true });
                }
              } else {
                onUpdateSettings({ pushNotifications: false });
              }
            }}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              settings.pushNotifications ? 'bg-emerald-500' : 'bg-zinc-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                settings.pushNotifications ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs container collapsible */}
      <div className="rounded-2xl bg-white border border-line overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenTabs(!openTabs)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-main">Organizar Pestañas</h3>
          </div>
          <span className="text-xs text-zinc-400">{openTabs ? '▲' : '▼'}</span>
        </button>
        {openTabs && (
          <div className="px-5 pb-5 space-y-3 border-t border-zinc-100">
            <p className="text-xs text-muted pt-3">
              Desliza para reordenar. Toggle para activar.
            </p>
            <div className="divide-y divide-zinc-100 rounded-xl border border-line overflow-hidden">
              {sortedTabs.map((tab) => (
                <div
                  key={tab.id}
                  draggable
                  onDragStart={() => onTabDragStart(tab.id)}
                  onDragOver={(e) => onTabDragOver(e, tab.id)}
                  onDragEnd={onTabDragEnd}
                  className={`flex items-center justify-between gap-2 p-2.5 text-sm cursor-grab active:cursor-grabbing transition-colors ${
                    draggedTab === tab.id ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-zinc-300 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={() => toggleTab(tab.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                        tab.enabled ? 'bg-blue-600 text-white' : 'border border-zinc-300'
                      }`}
                    >
                      {tab.enabled && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className={tab.enabled ? 'text-main' : 'text-zinc-400 line-through'}>
                      {tab.name}
                    </span>
                    {tab.isCustom && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-bold">
                        Custom
                      </span>
                    )}
                  </div>
                  {tab.isCustom && (
                    <button
                      type="button"
                      onClick={() => deleteCustomTab(tab.id)}
                      className="text-rose-400 hover:text-rose-600 px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddTab} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Nombre de nueva pestaña"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-100 border border-line text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
              >
                + Agregar
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Widgets container collapsible */}
      <div className="rounded-2xl bg-white border border-line overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenWidgets(!openWidgets)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-main">Widgets del Tablero</h3>
          </div>
          <span className="text-xs text-zinc-400">{openWidgets ? '▲' : '▼'}</span>
        </button>
        {openWidgets && (
          <div className="px-5 pb-5 space-y-3 border-t border-zinc-100">
            <p className="text-xs text-muted pt-3">
              Desliza para reordenar. Toggle para activar.
            </p>
            <div className="divide-y divide-zinc-100 rounded-xl border border-line overflow-hidden">
              {sortedWidgets.map((w) => (
                <div
                  key={w.id}
                  draggable
                  onDragStart={() => onWidgetDragStart(w.id)}
                  onDragOver={(e) => onWidgetDragOver(e, w.id)}
                  onDragEnd={onWidgetDragEnd}
                  className={`flex items-center justify-between p-2.5 text-sm cursor-grab active:cursor-grabbing transition-colors ${
                    draggedWidget === w.id ? 'bg-indigo-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-zinc-300 flex-shrink-0" />
                    <button
                      type="button"
                      onClick={() => toggleWidget(w.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                        w.enabled ? 'bg-indigo-600 text-white' : 'border border-zinc-300'
                      }`}
                    >
                      {w.enabled && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className={w.enabled ? 'text-main' : 'text-zinc-400 line-through'}>
                      {w.title}
                    </span>
                  </div>
                  <select
                    value={w.size}
                    onChange={(e) => changeWidgetSize(w.id, e.target.value as WidgetSize)}
                    className="text-xs px-2 py-1 rounded bg-zinc-100 border border-line"
                  >
                    <option value="small">S</option>
                    <option value="medium">M</option>
                    <option value="large">L</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={onLogout}
        className="w-full p-4 rounded-2xl bg-white border border-line text-rose-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>


    </div>
  );
};
