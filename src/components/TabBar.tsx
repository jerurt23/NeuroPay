import React from 'react';
import {
  LayoutGrid,
  Navigation,
  PieChart,
  Sliders,
  Plus,
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
  Navigation: <Navigation className="w-5 h-5" />,
  PieChart: <PieChart className="w-5 h-5" />,
  Sliders: <Sliders className="w-5 h-5" />,
};

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  onOpenNewTransaction,
}) => {
  const visibleTabs = tabs
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
    >
      <div className="relative flex items-center justify-around px-2 py-1.5 rounded-[28px] bg-white/60 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const icon = ICON_MAP[tab.icon] || <LayoutGrid className="w-5 h-5" />;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-300 ease-out"
            >
              {/* Liquid Glass Bubble */}
              <div
                className={`absolute inset-0 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  isActive
                    ? 'bg-blue-500/15 scale-100 opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_8px_rgba(59,130,246,0.15)]'
                    : 'bg-transparent scale-90 opacity-0'
                }`}
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              />

              <div
                className={`relative z-10 p-1.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'scale-110 text-blue-600'
                    : 'text-zinc-400 group-hover:text-zinc-600'
                }`}
              >
                {icon}
              </div>
              <span
                className={`relative z-10 text-[10px] font-medium mt-0.5 transition-colors duration-300 ${
                  isActive ? 'text-blue-600' : 'text-zinc-400'
                }`}
              >
                {tab.name}
              </span>

              {/* Active Dot */}
              <div
                className={`absolute -bottom-0.5 w-1 h-1 rounded-full bg-blue-600 transition-all duration-300 ${
                  isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                }`}
              />
            </button>
          );
        })}

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={onOpenNewTransaction}
          title="Nuevo Registro"
          className="relative flex flex-col items-center justify-center p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform duration-200"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-0.5">Nuevo</span>
        </button>
      </div>
    </nav>
  );
};
