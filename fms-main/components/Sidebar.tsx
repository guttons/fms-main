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
  Database,
  Calendar,
  Anchor,
  Sailboat,
  Ship,
  ClipboardList,
  Truck,
  Sun,
  Moon,
  ToggleRight,
  ToggleLeft,
  Fuel
} from 'lucide-react';
import { Logo } from './Logo';

interface SidebarProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  isMobileMenuOpen: boolean;
  onSettingsClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  user, 
  activeView, 
  setActiveView, 
  onLogout, 
  isMobileMenuOpen,
  onSettingsClick
}) => {
  const getMenuItems = () => {
    if (!user || !user.role) return [];
    switch (user.role) {
      case UserRole.ITP_OPERATOR:
      case UserRole.ITP_HD_OPERATOR:
      case UserRole.ITP_OFFICER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'history', label: 'Log History', icon: FileText },
        ];
      
      case UserRole.ITP_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'briefing', label: 'Shift Briefing', icon: ClipboardList },
          { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
          { id: 'history', label: 'Log History', icon: FileText },
          { id: 'depot-reports', label: 'Fuel Reports', icon: ClipboardList },
        ];

      case UserRole.DEPOT_OPERATOR:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'stock', label: 'Tank Levels', icon: Database },
          { id: 'bridging', label: 'Refueler Loading', icon: Droplet },
          { id: 'marine-loading', label: 'Marine Loading', icon: Ship },
          { id: 'marine', label: 'Tanker Discharge', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Ops', icon: Sailboat },
          { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
        ];

      case UserRole.DEPOT_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'stock', label: 'Stock Reconciliation', icon: Database },
          { id: 'bridging', label: 'Transfer Oversight', icon: Droplet },
          { id: 'marine-loading', label: 'Marine Provisioning', icon: Ship },
          { id: 'marine', label: 'Marine Oversight', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
          { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
          { id: 'forecasting', label: 'Stock Forecasting', icon: TrendingUp },
          { id: 'depot-reports', label: 'Fuel Reports', icon: ClipboardList },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'history', label: 'Log History', icon: FileText },
        ];

      case UserRole.EXECUTIVE:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'executive', label: 'Executive Module', icon: ClipboardList },
          { id: 'forecasting', label: 'Forecasting & Trends', icon: TrendingUp },
          { id: 'depot-reports', label: 'Fuel Reports', icon: ClipboardList },
          { id: 'commercial-reports', label: 'Commercial Reports', icon: FileText },
          { id: 'finance', label: 'Finance & Billing', icon: FileText },
        ];

      case UserRole.COMMERCIAL:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'forecasting', label: 'Forecasting & Trends', icon: TrendingUp },
          { id: 'depot-reports', label: 'Fuel Reports', icon: ClipboardList },
          { id: 'commercial-reports', label: 'Commercial Reports', icon: FileText },
          { id: 'finance', label: 'Finance & Billing', icon: FileText },
        ];

      case UserRole.FINANCE:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'finance', label: 'Finance & Billing', icon: FileText },
          { id: 'depot-reports', label: 'Fuel Reports', icon: ClipboardList },
          { id: 'reports', label: 'Financial Reports', icon: ClipboardList },
        ];

      case UserRole.CUSTOMER:
        return [
          { id: 'customer-portal', label: 'Customer Portal', icon: Plane },
        ];

      case UserRole.ADMIN:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'history', label: 'Log History', icon: FileText },
          { id: 'briefing', label: 'Shift Briefing', icon: ClipboardList },
          { id: 'intoplane', label: 'Into-Plane Ops', icon: Plane },
          { id: 'stock', label: 'Stock Management', icon: Database },
          { id: 'bridging', label: 'Transfer Oversight', icon: Droplet },
          { id: 'marine-loading', label: 'Marine Loading', icon: Ship },
          { id: 'marine', label: 'Marine Oversight', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
          { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
          { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
          { id: 'depot-reports', label: 'Fuel Reports', icon: ClipboardList },
          { id: 'commercial-reports', label: 'Commercial Reports', icon: FileText },
          { id: 'executive', label: 'Executive Module', icon: ClipboardList },
          { id: 'finance', label: 'Finance & Billing', icon: FileText },
          { id: 'customer-portal', label: 'Customer Portal', icon: Plane },
        ];
      
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'history', label: 'Log History', icon: FileText },
        ];
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-[60] w-[var(--sidebar-width)] bg-surface border-r border-outline transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
      ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 shadow-sm transition-colors duration-500
    `}>
      <div className="h-full flex flex-col">
        {/* Brand */}
        <div className="h-[72px] flex items-center justify-between px-8 bg-surface-dim/20 border-b border-outline">
          <h1 className="text-5xl font-[1000] text-primary uppercase tracking-[-0.05em] leading-none italic drop-shadow-[0_0_12px_rgba(var(--color-primary),0.2)]">FMS</h1>
          <div className="hidden lg:flex items-center space-x-3">
            <Logo className="h-14 w-auto object-contain text-primary" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all group
                  ${isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-on-surface-dim hover:bg-surface-dim hover:text-on-surface'
                  }`}
              >
                <Icon className={`w-5 h-5 mr-4 transition-colors ${isActive ? 'text-primary' : 'opacity-40 group-hover:opacity-100'}`} />
                <span className={`text-[13.5px] font-bold tracking-tight ${isActive ? 'font-black' : ''}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_12px_rgba(56,189,248,0.6)]"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Controls */}
        <div className="p-6 space-y-6">

          <div className="space-y-4 pt-4 border-t border-outline">
            <button className="flex items-center text-on-surface-dim hover:text-primary transition-colors text-[13px] font-bold px-2 group">
              <ClipboardList className="w-4 h-4 mr-3 opacity-40 group-hover:opacity-100" />
              Help Center
            </button>
            <button 
              onClick={onSettingsClick}
              className={`w-full flex items-center px-2 py-2 text-[13px] font-bold rounded-xl transition-all group
                ${activeView === 'admin' 
                  ? 'bg-primary/10 text-primary font-black' 
                  : 'text-on-surface-dim hover:bg-surface-dim hover:text-on-surface'
                }`}
            >
              <Settings className={`w-4 h-4 mr-3 transition-colors ${activeView === 'admin' ? 'text-primary' : 'opacity-40 group-hover:opacity-100'}`} />
              System Settings
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center text-error font-black px-2 mt-4 hover:brightness-110 transition-all text-[13px] group"
            >
              <LogOut className="w-4 h-4 mr-3 opacity-60 group-hover:translate-x-1 transition-transform" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};