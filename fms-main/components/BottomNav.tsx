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
        return [
          { id: 'dashboard', label: 'Tasks', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Refuel', icon: Plane },
          { id: 'history', label: 'Logs', icon: FileText },
        ];
      
      case UserRole.ITP_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'equipment', label: 'Equipment', icon: Truck },
          { id: 'schedule', label: 'Schedule', icon: Calendar },
          { id: 'history', label: 'History', icon: FileText },
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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-50 px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 px-2 transition-colors ${
                isActive ? 'text-aviation-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'animate-in zoom-in-75 duration-300' : ''}`} />
              <span className="text-[10px] font-bold truncate w-full text-center uppercase tracking-tighter">
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-aviation-600 rounded-full" />
              )}
            </button>
          );
        })}
        
        {/* More Menu Button to trigger sidebar for Logout/Profile */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 px-2 text-slate-500 hover:text-slate-700"
        >
          <Menu className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">More</span>
        </button>
      </div>
    </div>
  );
};
