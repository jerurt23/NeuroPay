import React from 'react';
import { 
  Sun, 
  Moon, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Maximize2,
  Lock,
  Unlock,
  Bell
} from 'lucide-react';
import { ThemeMode, ViewportMode } from '../types/index.ts';

interface HeaderNavProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  trueTone: boolean;
  onTrueToneToggle: () => void;
  viewportMode: ViewportMode;
  onViewportChange: (mode: ViewportMode) => void;
  e2eeLocked: boolean;
  onToggleLock: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  userName: string;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  theme,
  onThemeChange,
  trueTone,
  onTrueToneToggle,
  viewportMode,
  onViewportChange,
  e2eeLocked,
  onToggleLock,
  unreadCount,
  onOpenNotifications,
  onOpenAuth,
  userName,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full transition-colors duration-300 ios-glass border-b border-black/5 dark:border-white/10 px-3 sm:px-6 pt-9 sm:pt-2.5 pb-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand & iOS Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                SynapsePay
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                iOS 18 Native
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Histórico • Red Neuronal • Cifrado E2EE
            </p>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* True Tone Toggle */}
          <button
            type="button"
            onClick={onTrueToneToggle}
            title={trueTone ? 'True Tone activado (calidez ambiental inteligente)' : 'Activar True Tone'}
            aria-label="True Tone toggle"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              trueTone
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-inner'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${trueTone ? 'text-amber-500 fill-amber-500' : ''}`} />
            <span className="hidden md:inline">True Tone</span>
            <span className={`w-1.5 h-1.5 rounded-full ${trueTone ? 'bg-amber-500' : 'bg-zinc-400'}`} />
          </button>

          {/* Theme Mode Selector */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full border border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              title="Modo Claro"
              aria-label="Modo Claro"
              className={`p-1.5 rounded-full transition-all ${
                theme === 'light'
                  ? 'bg-white text-amber-500 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              title="Modo Oscuro"
              aria-label="Modo Oscuro"
              className={`p-1.5 rounded-full transition-all ${
                theme === 'dark'
                  ? 'bg-zinc-700 text-indigo-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Viewport Frame Switcher (Adaptive / APK / macOS preview) */}
          <div className="hidden lg:flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full border border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => onViewportChange('native')}
              title="Vista Fluida / Nativa"
              aria-label="Vista Fluida"
              className={`p-1.5 rounded-full transition-all ${
                viewportMode === 'native'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewportChange('iphone')}
              title="Marco iPhone 16 Pro"
              aria-label="Marco iPhone 16 Pro"
              className={`p-1.5 rounded-full transition-all ${
                viewportMode === 'iphone'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewportChange('ipad')}
              title="Marco iPad Pro"
              aria-label="Marco iPad Pro"
              className={`p-1.5 rounded-full transition-all ${
                viewportMode === 'ipad'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewportChange('macbook')}
              title="Marco macOS / Windows APK"
              aria-label="Marco macOS Desktop"
              className={`p-1.5 rounded-full transition-all ${
                viewportMode === 'macbook'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* E2EE Lock State Badge */}
          <button
            type="button"
            onClick={onToggleLock}
            title={e2eeLocked ? 'Bóveda E2EE bloqueada (Cifrado AES-256)' : 'Bóveda E2EE abierta'}
            aria-label="E2EE Lock status"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              e2eeLocked
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {e2eeLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">E2EE Bloqueado</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">E2EE Activo</span>
              </>
            )}
          </button>

          {/* Bank / Notifications Bell */}
          <button
            type="button"
            onClick={onOpenNotifications}
            title="Alertas y Notificaciones"
            aria-label="Notificaciones"
            className="relative p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Avatar */}
          <button
            type="button"
            onClick={onOpenAuth}
            title="Perfil de Usuario y Clave Maestra"
            aria-label="Perfil de usuario"
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[11px] font-bold flex items-center justify-center">
              {userName.charAt(0)}
            </div>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hidden sm:inline max-w-[80px] truncate">
              {userName.split(' ')[0]}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
