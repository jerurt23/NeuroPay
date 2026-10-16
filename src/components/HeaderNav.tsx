import React from 'react';
import { Bell } from 'lucide-react';

interface HeaderNavProps {
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  userName: string;
  userPhoto?: string;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  unreadCount,
  onOpenNotifications,
  onOpenProfile,
  userName,
  userPhoto,
}) => {
  return (
    <header className="ios-glass sticky top-0 z-40 w-full border-b border-line px-4 sm:px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
            N
          </div>
          <h1 className="text-lg font-bold text-main tracking-tight">
            NEUROPAY
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-full bg-zinc-100 hover-surface text-muted transition-colors"
            aria-label="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center overflow-hidden hover:scale-105 transition-transform"
          >
            {userPhoto ? (
              <img src={userPhoto} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              (userName ? userName.charAt(0).toUpperCase() : 'U')
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
