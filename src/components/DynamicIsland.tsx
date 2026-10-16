import React from 'react';
import { ShieldCheck, Bell, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export interface DynamicIslandNotification {
  id: string;
  title: string;
  message: string;
  type: 'bank' | 'expense' | 'income' | 'security' | 'warning';
  amount?: number;
  currency?: string;
  timestamp: string;
}

interface DynamicIslandProps {
  notification: DynamicIslandNotification | null;
  onDismiss: () => void;
  isLocked: boolean;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({ notification, onDismiss, isLocked }) => {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ease-out">
      {notification ? (
        <div
          onClick={onDismiss}
          className="pointer-events-auto cursor-pointer flex items-center gap-3 px-4 py-2.5 bg-black/90 text-white rounded-full shadow-2xl border border-white/15 backdrop-blur-2xl min-w-[280px] max-w-md mx-auto transform animate-in fade-in slide-in-from-top-2 duration-300 scale-100 hover:scale-[1.02] active:scale-95 transition-transform"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            {notification.type === 'bank' && <Bell className="w-4 h-4 text-amber-400 animate-pulse" />}
            {notification.type === 'expense' && <ArrowUpRight className="w-4 h-4 text-rose-400" />}
            {notification.type === 'income' && <ArrowDownLeft className="w-4 h-4 text-emerald-400" />}
            {notification.type === 'security' && <ShieldCheck className="w-4 h-4 text-blue-400" />}
            {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white/90 truncate">{notification.title}</span>
              {notification.amount !== undefined && (
                <span className={`text-xs font-bold font-mono ${notification.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {notification.type === 'income' ? '+' : '-'}{notification.currency || '$'}{notification.amount.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/70 truncate">{notification.message}</p>
          </div>

          <div className="flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-white/40" />
          </div>
        </div>
      ) : (
        /* Idle compact pill simulating iPhone Dynamic Island */
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 bg-black/90 text-white rounded-full shadow-lg border border-white/10 backdrop-blur-xl h-7 transition-all">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500/80 animate-pulse" />
          <span className="text-[10px] tracking-wide font-medium text-white/80">
            {isLocked ? 'Cifrado E2EE Activo' : 'NEUROPAY'}
          </span>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>
      )}
    </div>
  );
};
