import React from 'react';
import { 
  LayoutGrid, 
  Network, 
  Clock, 
  Navigation, 
  PieChart, 
  Mail, 
  Sliders, 
  Plus,
  Sparkles,
  TrendingUp,
  FolderPlus
} from 'lucide-react';
import { TabConfig } from '../types/index.ts';

interface TabBarProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onOpenNewTransaction: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutGrid: <LayoutGrid className="w-5 h-5" />,
  Network: <Network className="w-5 h-5" />,
  Clock: <Clock className="w-5 h-5" />,
  Navigation: <Navigation className="w-5 h-5" />,
  PieChart: <PieChart className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
  Sliders: <Sliders className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  FolderPlus: <FolderPlus className="w-5 h-5" />,
};

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  onOpenNewTransaction,
}) => {
  // Only display enabled tabs, sorted by order
  const visibleTabs = tabs
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <nav 
      aria-label="Navegación principal de pestañas"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-1.5rem)] px-3 py-2 rounded-3xl ios-glass border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-2xl transition-all"
    >
      <div className="flex items-center justify-around gap-1">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const icon = ICON_MAP[tab.icon] || <LayoutGrid className="w-5 h-5" />;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all group ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-transform ${isActive ? 'scale-110 bg-blue-500/10' : 'group-hover:scale-105'}`}>
                {icon}
              </div>
              <span className="text-[10px] tracking-tight truncate max-w-[56px] mt-0.5">
                {tab.name}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Central or Accent Quick Add Button */}
        <button
          type="button"
          onClick={onOpenNewTransaction}
          title="Nuevo Registro de Compra o Movilidad"
          aria-label="Nuevo Registro"
          className="flex flex-col items-center justify-center p-2 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[9px] font-bold tracking-tight">Nuevo</span>
        </button>
      </div>
    </nav>
  );
};
