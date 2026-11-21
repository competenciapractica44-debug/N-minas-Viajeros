import React from 'react';
import { Home, CreditCard, CalendarDays, CalendarRange, Database, SlidersHorizontal } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  extrasCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, extrasCount }) => {
  const tabs = [
    { id: 'inicio', label: 'Menú', icon: Home },
    { id: 'calendario', label: 'Turnos Día', icon: CalendarDays },
    { id: 'anual', label: 'Cal. Anual', icon: CalendarRange },
    { id: 'nomina', label: 'Nómina', icon: CreditCard },
    { id: 'turnos', label: 'Turnos BD', icon: Database },
    { id: 'extras', label: 'Extras', icon: SlidersHorizontal, badge: extrasCount },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
      <div className="max-w-xl mx-auto grid grid-cols-6 px-1 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all relative cursor-pointer ${
                isActive
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.7]'}`} />
                {tab.badge !== undefined && tab.badge > 0 && tab.id === 'extras' && (
                  <span className="absolute -top-1 -right-2 bg-blue-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
