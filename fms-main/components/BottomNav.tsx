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
  PanelLeft,
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
  isVisible?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  user, 
  activeView, 
  setActiveView, 
  onMenuClick,
  isVisible = true
}) => {
  const getNavItems = () => {
    if (!user || !user.role) return [];
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
    <div className={`fixed bottom-6 left-6 right-6 bg-surface-container/70 backdrop-blur-3xl border border-white/5 lg:hidden z-50 px-4 rounded-[32px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6),0_0_20px_rgba(0,0,0,0.2)] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
      isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-32 opacity-0 scale-95 pointer-events-none'
    }`}>
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all duration-300 relative active:scale-90 ${
                isActive ? 'text-primary' : 'text-on-surface-dim'
              }`}
            >
              <div className={`relative p-2 rounded-2xl transition-all duration-500 ease-out ${isActive ? 'bg-primary/10 shadow-glow scale-110' : 'opacity-60 scale-100 hover:bg-primary/5'}`}>
                <Icon className={`w-5 h-5 transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100'}`} />
              </div>
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-5 h-1 bg-primary rounded-full shadow-glow animate-in fade-in zoom-in duration-500" />
              )}
            </button>
          );
        })}
        
        {/* More Menu Button */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 text-on-surface-dim group active:scale-90 transition-all rounded-full"
        >
          <div className="p-2 rounded-2xl opacity-60 group-hover:bg-primary/5 transition-all">
            <PanelLeft className="w-5 h-5 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
};
