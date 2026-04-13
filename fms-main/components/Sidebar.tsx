import React from 'react';
import { User, UserRole } from '../types';
import { 
  LayoutDashboard, 
  Plane, 
  Droplet, 
  TrendingUp, 
  Settings, 
  FileText, 
  LogOut,
  AlertTriangle,
  Database,
  Calendar,
  Anchor,
  Sailboat,
  Hexagon,
  Users,
  ClipboardList,
  Truck
} from 'lucide-react';

interface SidebarProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  isMobileMenuOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeView, setActiveView, onLogout, isMobileMenuOpen }) => {
  const getMenuItems = () => {
    switch (user.role) {
      case UserRole.ITP_OPERATOR:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'history', label: 'Log History', icon: FileText },
        ];
      
      case UserRole.ITP_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
          { id: 'briefing', label: 'Shift Briefing', icon: ClipboardList },
          { id: 'history', label: 'Ops History', icon: FileText },
        ];

      case UserRole.DEPOT_OPERATOR:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'stock', label: 'Tank Levels', icon: Database },
          { id: 'bridging', label: 'Refueler Loading', icon: Droplet },
          { id: 'marine', label: 'Tanker Discharge', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Ops', icon: Sailboat },
        ];

      case UserRole.DEPOT_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'stock', label: 'Stock Reconciliation', icon: Database },
          { id: 'bridging', label: 'Transfer Oversight', icon: Droplet },
          { id: 'marine', label: 'Marine Oversight', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
        ];

      case UserRole.EXECUTIVE:
      case UserRole.COMMERCIAL:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'forecasting', label: 'Forecasting & Trends', icon: TrendingUp },
          { id: 'reports', label: 'Commercial Reports', icon: FileText },
        ];

      case UserRole.ADMIN:
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'admin', label: 'System Admin', icon: Settings },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
          { id: 'briefing', label: 'Shift Briefing', icon: ClipboardList },
          { id: 'intoplane', label: 'Into-Plane Ops', icon: Plane },
          { id: 'stock', label: 'Stock Management', icon: Database },
          { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
          { id: 'reports', label: 'Commercial Reports', icon: FileText },
        ];
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-[60] w-[var(--sidebar-width)] bg-surface-lowest border-r border-outline transform transition-transform duration-300 ease-in-out
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 shadow-sm
    `}>
      <div className="h-full flex flex-col">
        {/* Brand */}
        <div className="h-[calc(var(--header-height)+var(--alert-bar-height))] flex items-start pt-12 px-8">
          <div>
            <h1 className="headline-lg text-primary tracking-tight leading-none bg-primary text-white p-2 px-3 rounded-lg inline-block">AeroFuel</h1>
            <p className="text-[10px] font-black text-primary opacity-60 uppercase tracking-[0.4em] mt-3 ml-1">Terminal A-North</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-all group
                  ${isActive 
                    ? 'bg-primary/5 text-primary' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <Icon className={`w-5 h-5 mr-4 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className={`text-[13px] font-semibold tracking-tight ${isActive ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(0,32,70,0.5)]"></div>}
              </button>
            );
          })}
        </nav>

        {/* Footer Controls */}
        <div className="p-6 space-y-6">
          <button className="btn-emergency flex items-center justify-center space-x-3">
             <AlertTriangle className="w-5 h-5" />
             <span>Emergency Shutdown</span>
          </button>

          <div className="space-y-4 pt-4 border-t border-outline">
            <button className="flex items-center text-slate-500 hover:text-primary transition-colors text-[13px] font-semibold px-2">
              <ClipboardList className="w-4 h-4 mr-3 opacity-60" />
              Help Center
            </button>
            <button className="flex items-center text-slate-500 hover:text-primary transition-colors text-[13px] font-semibold px-2">
              <Settings className="w-4 h-4 mr-3 opacity-60" />
              System Settings
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center text-error hover:text-red-700 transition-colors text-[13px] font-bold px-2 mt-4"
            >
              <LogOut className="w-4 h-4 mr-3 opacity-60" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};