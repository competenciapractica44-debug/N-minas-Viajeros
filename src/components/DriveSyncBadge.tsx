import React, { useState } from 'react';
import { Cloud, CloudCheck, RefreshCw, LogOut, Check, Folder, ChevronDown } from 'lucide-react';
import { User } from 'firebase/auth';

interface DriveSyncBadgeProps {
  user: User | null;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  onManualSync: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const DriveSyncBadge: React.FC<DriveSyncBadgeProps> = ({
  user,
  isSyncing,
  lastSyncTime,
  onManualSync,
  onOpenLogin,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user) {
    return (
      <button
        type="button"
        onClick={onOpenLogin}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-all shadow-xs cursor-pointer"
        title="Iniciar sesión con tu cuenta de Google para guardar tus turnos y nóminas en tu Drive"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        <span>Conectar Google Drive</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all text-xs"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Usuario'}
            className="w-5 h-5 rounded-full object-cover ring-1 ring-blue-500"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        )}

        <div className="text-left hidden sm:block">
          <div className="flex items-center gap-1 font-bold text-slate-800 text-[11px] leading-tight">
            <span className="truncate max-w-[90px]">{user.displayName || user.email?.split('@')[0]}</span>
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Sincronizado"></span>
            )}
          </div>
          <span className="text-[9px] text-slate-400 block font-medium">Drive / Nóminas</span>
        </div>

        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {/* Menú desplegable */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs space-y-2.5 animate-fadeIn">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuario'}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <span className="font-bold text-slate-900 block truncate text-xs">
                  {user.displayName || 'Conductor'}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {user.email}
                </span>
              </div>
            </div>

            <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-100/80 space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <Folder className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Drive: Direxis / Nóminas</span>
              </div>
              <p className="text-[10px] text-blue-800 leading-tight">
                Tus turnos, chofer, convenio y asignaciones se sincronizan automáticamente en tu cuenta.
              </p>
              {lastSyncTime && (
                <p className="text-[9px] text-blue-600 pt-0.5">
                  Última sincronización: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>

            <div className="space-y-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  onManualSync();
                  setIsMenuOpen(false);
                }}
                disabled={isSyncing}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando ahora...' : 'Sincronizar con Drive ahora'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span>Desconectar cuenta</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
