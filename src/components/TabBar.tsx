import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [bubbleStyle, setBubbleStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const prevTabRef = useRef<string | null>(null);

  const updateBubble = useCallback(() => {
    const activeTabEl = tabRefs.current[activeTab];
    const navEl = navRef.current;
    if (!activeTabEl || !navEl) return;

    const tabRect = activeTabEl.getBoundingClientRect();
    const navRect = navEl.getBoundingClientRect();

    const left = tabRect.left - navRect.left;
    const width = tabRect.width;

    setBubbleStyle({ left, width, opacity: 1 });

    if (prevTabRef.current && prevTabRef.current !== activeTab) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 500);
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    updateBubble();
    window.addEventListener('resize', updateBubble);
    return () => window.removeEventListener('resize', updateBubble);
  }, [updateBubble, tabs]);

  const visibleTabs = tabs
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
    >
      <div
        ref={navEl}
        className="relative flex items-center justify-around px-2 py-1.5 rounded-[28px] bg-white/60 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
      >
        {/* Liquid Bubble */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-2xl transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            left: `${bubbleStyle.left}px`,
            width: `${bubbleStyle.width}px`,
            opacity: bubbleStyle.opacity,
            background: 'rgba(59, 130, 246, 0.12)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.5),
              inset 0 -1px 0 rgba(59,130,246,0.08),
              0 4px 16px rgba(59,130,246,0.12)
            `,
            borderRadius: isAnimating
              ? '40% 60% 55% 45% / 50% 45% 55% 50%'
              : '20px',
            transitionDuration: isAnimating ? '600ms' : '400ms',
            transitionProperty: 'left, width, border-radius',
          }}
        />

        {/* Wobble overlay for liquid effect */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-2xl pointer-events-none"
          style={{
            left: `${bubbleStyle.left}px`,
            width: `${bubbleStyle.width}px`,
            opacity: bubbleStyle.opacity,
            background: `
              radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.08) 0%, transparent 50%)
            `,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            transition: 'all 500ms cubic-bezier(0.34,1.56,0.64,1)',
            animation: isAnimating ? 'liquidWobble 600ms ease-out' : 'none',
          }}
        />

        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const icon = ICON_MAP[tab.icon] || <LayoutGrid className="w-5 h-5" />;

          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="relative z-10 flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-300"
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'scale-110 text-blue-600'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {icon}
              </div>
              <span
                className={`text-[10px] font-medium mt-0.5 transition-colors duration-300 ${
                  isActive ? 'text-blue-600' : 'text-zinc-400'
                }`}
              >
                {tab.name}
              </span>
            </button>
          );
        })}

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={onOpenNewTransaction}
          title="Nuevo Registro"
          className="relative z-10 flex flex-col items-center justify-center p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform duration-200"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-0.5">Nuevo</span>
        </button>
      </div>

      <style>{`
        @keyframes liquidWobble {
          0% { border-radius: 20px; transform: scaleX(1) scaleY(1); }
          25% { border-radius: 50% 50% 45% 55% / 55% 45% 55% 45%; transform: scaleX(1.05) scaleY(0.95); }
          50% { border-radius: 45% 55% 50% 50% / 50% 55% 45% 50%; transform: scaleX(0.98) scaleY(1.02); }
          75% { border-radius: 55% 45% 55% 45% / 45% 50% 50% 55%; transform: scaleX(1.02) scaleY(0.98); }
          100% { border-radius: 20px; transform: scaleX(1) scaleY(1); }
        }
      `}</style>
    </nav>
  );
};
