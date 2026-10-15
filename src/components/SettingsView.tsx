import React, { useState } from 'react';
import { 
  Sliders, 
  Layers, 
  Sparkles, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Bell, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Maximize2,
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Upload, 
  CheckCircle2, 
  Key, 
  Lock,
  Grid,
  Check
} from 'lucide-react';
import { 
  TabConfig, 
  WidgetConfig, 
  UserSettings, 
  ThemeMode, 
  ViewportMode, 
  WidgetSize 
} from '../types/index.ts';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  tabs: TabConfig[];
  onUpdateTabs: (tabs: TabConfig[]) => void;
  widgets: WidgetConfig[];
  onUpdateWidgets: (widgets: WidgetConfig[]) => void;
  onExportVault: () => void;
  onImportVault: (file: File) => void;
  onTriggerTestNotification: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  tabs,
  onUpdateTabs,
  widgets,
  onUpdateWidgets,
  onExportVault,
  onImportVault,
  onTriggerTestNotification,
}) => {
  const [newTabName, setNewTabName] = useState('');
  const [newTabIcon, setNewTabIcon] = useState('Sparkles');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Reorder tabs
  const moveTab = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tabs.length) return;

    const copy = [...tabs];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    // re-assign orders
    copy.forEach((t, i) => (t.order = i));
    onUpdateTabs(copy);
  };

  const toggleTab = (id: string) => {
    const updated = tabs.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t));
    onUpdateTabs(updated);
  };

  const handleAddCustomTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTabName.trim()) return;

    const newTab: TabConfig = {
      id: `custom_${Date.now()}`,
      name: newTabName.trim(),
      icon: newTabIcon,
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

  // Widget management
  const toggleWidget = (id: string) => {
    const updated = widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    onUpdateWidgets(updated);
  };

  const changeWidgetSize = (id: string, size: WidgetSize) => {
    const updated = widgets.map((w) => (w.id === id ? { ...w, size } : w));
    onUpdateWidgets(updated);
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const copy = [...widgets];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    copy.forEach((w, i) => (w.order = i));
    onUpdateWidgets(copy);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportVault(file);
      setImportStatus('Bóveda cargada y desencriptada correctamente');
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1. Appearance & Apple True Tone */}
      <div className="p-5 sm:p-6 rounded-3xl ios-glass-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Apariencia iOS & True Tone
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Personaliza el tema visual, calidez ambiental inteligente y adaptación visual.
            </p>
          </div>
        </div>

        {/* Theme mode buttons */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'light' })}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              settings.theme === 'light'
                ? 'bg-white text-zinc-900 shadow-md'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Modo Claro</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              settings.theme === 'dark'
                ? 'bg-zinc-700 text-white shadow-md'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Modo Oscuro</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'auto' })}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              settings.theme === 'auto'
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-md'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Automático</span>
          </button>
        </div>

        {/* True Tone Switch */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Tecnología True Tone
              {settings.trueTone && (
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-bold">
                  Activo
                </span>
              )}
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Adapta dinámicamente el balance de blancos y calidez a cualquier entorno lumínico.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.trueTone}
              onChange={(e) => onUpdateSettings({ trueTone: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
          </label>
        </div>
      </div>

      {/* 2. Custom Tabs Management */}
      <div className="p-5 sm:p-6 rounded-3xl ios-glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Gestor de Pestañas Dinámicas
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Mueve, oculta, agrega o disminuye pestañas según tus necesidades financieras.
              </p>
            </div>
          </div>
        </div>

        {/* Tab List */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleTab(tab.id)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    tab.enabled
                      ? 'bg-blue-600 text-white'
                      : 'border border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {tab.enabled && <Check className="w-3.5 h-3.5" />}
                </button>
                <span className={`font-semibold ${tab.enabled ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 line-through'}`}>
                  {tab.name}
                </span>
                {tab.isCustom && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-bold">
                    Personalizada
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveTab(index, 'up')}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === tabs.length - 1}
                  onClick={() => moveTab(index, 'down')}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                {tab.isCustom && (
                  <button
                    type="button"
                    onClick={() => deleteCustomTab(tab.id)}
                    className="p-1 rounded-lg text-rose-400 hover:text-rose-600 ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add custom tab form */}
        <form onSubmit={handleAddCustomTab} className="flex items-center gap-2 pt-2">
          <input
            type="text"
            placeholder="Nombre de nueva pestaña (Ej. Inversiones, Viajes...)"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Pestaña</span>
          </button>
        </form>
      </div>

      {/* 3. Configurable Widgets */}
      <div className="p-5 sm:p-6 rounded-3xl ios-glass-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Widgets del Tablero Dinámico
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Configura el tamaño y orden de los widgets interactivos del tablero.
            </p>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {widgets.map((w, index) => (
            <div key={w.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleWidget(w.id)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    w.enabled ? 'bg-indigo-600 text-white' : 'border border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {w.enabled && <Check className="w-3.5 h-3.5" />}
                </button>
                <span className={`font-semibold truncate ${w.enabled ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 line-through'}`}>
                  {w.title}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={w.size}
                  onChange={(e) => changeWidgetSize(w.id, e.target.value as WidgetSize)}
                  className="px-2 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-800 dark:text-zinc-200"
                >
                  <option value="small">Pequeño (1x1)</option>
                  <option value="medium">Mediano (2x1)</option>
                  <option value="large">Grande (4x1)</option>
                </select>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveWidget(index, 'up')}
                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === widgets.length - 1}
                    onClick={() => moveWidget(index, 'down')}
                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. End-to-End Encryption (E2EE) Vault & Backup */}
      <div className="p-5 sm:p-6 rounded-3xl ios-glass-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Cifrado E2EE & Sincronización Segura
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Protocolo AES-GCM 256 bits. Toda tu información bancaria y gastos está cifrada antes de guardarse.
            </p>
          </div>
        </div>

        {importStatus && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{importStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onExportVault}
            className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 flex items-center gap-3 transition-colors text-left"
          >
            <Download className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Exportar Respaldo Cifrado (.vault)
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Descarga un archivo con clave AES-256
              </span>
            </div>
          </button>

          <label className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 flex items-center gap-3 transition-colors cursor-pointer text-left">
            <Upload className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Restaurar Respaldo
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Importa tu bóveda desde otro dispositivo
              </span>
            </div>
            <input type="file" accept=".json,.vault" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* 5. Push Notifications & Movement Alerts */}
      <div className="p-5 sm:p-6 rounded-3xl ios-glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Notificaciones Push en Tiempo Real
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Alertas instantáneas al detectarse un nuevo cargo bancario o alerta presupuestaria.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onTriggerTestNotification}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold"
          >
            Probar Alerta Push
          </button>
        </div>
      </div>
    </div>
  );
};
