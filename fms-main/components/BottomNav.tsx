import React from 'react';
import { User, UserRole } from '../types';
import { 
  LayoutDashboard, 
  Plane, 
  FileText, 
  Database, 
  Droplet, 
  Anchor, 
  Sailboat,
  Menu,
  TrendingUp,
  Settings,
  ClipboardList,
  Calendar,
  Truck
} from 'lucide-react';

interface BottomNavProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onMenuClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ user, activeView, setActiveView, onMenuClick }) => {
  const getNavItems = () => {
    switch (user.role) {
      case UserRole.ITP_OPERATOR:
      case UserRole.ITP_HD_OPERATOR:
      case UserRole.ITP_MANAGER:
        return [
          { id: 'dashboard', label: 'Tasks', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Refuel', icon: Plane },
          { id: 'history', label: 'Logs', icon: FileText },
        ];

      case UserRole.DEPOT_OPERATOR:
        return [
          { id: 'dashboard', label: 'Status', icon: LayoutDashboard },
          { id: 'stock', label: 'Tanks', icon: Database },
          { id: 'bridging', label: 'Loading', icon: Droplet },
          { id: 'marine', label: 'Marine', icon: Anchor },
        ];

      case UserRole.DEPOT_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'stock', label: 'Stock', icon: Database },
          { id: 'bridging', label: 'Transfer', icon: Droplet },
          { id: 'marine', label: 'Marine', icon: Anchor },
        ];

      case UserRole.EXECUTIVE:
      case UserRole.COMMERCIAL:
        return [
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'forecasting', label: 'Forecast', icon: TrendingUp },
          { id: 'reports', label: 'Reports', icon: FileText },
        ];

      case UserRole.ADMIN:
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'admin', label: 'Admin', icon: Settings },
          { id: 'schedule', label: 'Schedule', icon: Calendar },
          { id: 'intoplane', label: 'Refuel', icon: Plane },
        ];
    }
  };

  const navItems = getNavItems();

  if (navItems.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-xl border-t border-outline lg:hidden z-50 px-2 pb-safe shadow-premium transition-all duration-500">
      <div className="flex items-center justify-around h-18 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-2 px-1 transition-all relative active:scale-90 ${
                isActive ? 'text-primary' : 'text-on-surface-dim'
              }`}
            >
              <div className={`relative p-2 rounded-2xl transition-all duration-500 ${isActive ? 'bg-primary/10 shadow-glow mb-1' : 'opacity-60 mb-1'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'animate-in zoom-in-95 duration-500' : ''}`} />
              </div>
              <span className={`text-[8px] font-black truncate w-full text-center uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-30 italic'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary rounded-full shadow-glow" />
              )}
            </button>
          );
        })}
        
        {/* More Menu Button */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center flex-1 min-w-0 py-2 px-1 text-on-surface-dim group"
        >
          <div className="p-2 rounded-2xl opacity-60 group-hover:bg-primary/5 transition-all mb-1">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest opacity-30 italic">Menu</span>
        </button>
      </div>
    </div>
  );
};
