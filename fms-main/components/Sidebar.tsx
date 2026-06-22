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
  Fuel,
  PanelLeft
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
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [hoveredTooltip, setHoveredTooltip] = React.useState<{ top: number; label: string; left?: string; isError?: boolean } | null>(null);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar-collapsed', String(next));
      } catch {}
      return next;
    });
  };

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
      fixed inset-y-0 left-0 z-[60] bg-surface border-r border-outline transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
      ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl w-[var(--sidebar-width)]' : '-translate-x-full w-[var(--sidebar-width)]'} 
      lg:translate-x-0 lg:static lg:inset-0 shadow-sm transition-colors duration-500
      ${isCollapsed ? 'lg:w-[78px]' : 'lg:w-[var(--sidebar-width)]'}
    `}>
      <div className="h-full flex flex-col">
        {/* Brand */}
        <div className={`h-[72px] flex items-center bg-surface-dim/20 border-b border-outline relative transition-all duration-300 ${
          isCollapsed ? 'lg:px-0 lg:justify-center px-8 justify-between' : 'px-8 justify-between'
        }`}>
          <h1 className={`text-5xl font-[1000] text-primary uppercase tracking-[-0.05em] leading-none italic drop-shadow-[0_0_12px_rgba(var(--color-primary),0.2)] transition-all duration-300 whitespace-nowrap inline-block ${
            isCollapsed ? 'lg:opacity-0 lg:max-w-0 lg:overflow-hidden lg:pointer-events-none' : 'lg:opacity-100 lg:max-w-[150px]'
          }`}>
            FMS
          </h1>
          <div className={`transition-all duration-300 ${
            isCollapsed ? 'hidden lg:flex lg:scale-75 lg:justify-center lg:w-full' : 'hidden lg:flex items-center space-x-3'
          }`}>
            <Logo className="h-14 w-auto object-contain text-primary transition-all duration-300" />
          </div>
        </div>

        {/* Navigation */}
        <nav 
          onScroll={() => setHoveredTooltip(null)}
          className={`flex-1 px-4 py-8 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300 ${isCollapsed ? 'lg:px-0 lg:flex lg:flex-col lg:items-center' : ''}`}
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <div key={item.id} className="relative group w-full flex justify-center">
                <button
                  onClick={() => setActiveView(item.id)}
                  onMouseEnter={(e) => {
                    if (!isCollapsed) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredTooltip({
                      top: rect.top + rect.height / 2,
                      label: item.label
                    });
                  }}
                  onMouseLeave={() => setHoveredTooltip(null)}
                  className={`w-full flex items-center rounded-xl transition-all duration-300 px-4 py-3
                    ${isCollapsed ? 'lg:w-11 lg:h-11 lg:p-0 lg:justify-center' : 'lg:px-4'}
                    ${isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-on-surface-dim hover:bg-surface-dim hover:text-on-surface'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isCollapsed ? 'lg:mr-0' : 'lg:mr-4'} mr-4 transition-all duration-300 shrink-0 ${isActive ? 'text-primary' : 'opacity-40 group-hover:opacity-100'}`} />
                  <span className={`text-[13.5px] font-bold tracking-tight whitespace-nowrap transition-all duration-300 inline-block ${isActive ? 'font-black' : ''} ${isCollapsed ? 'lg:opacity-0 lg:max-w-0 lg:overflow-hidden lg:pointer-events-none' : 'lg:opacity-100 lg:max-w-[200px]'}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className={`ml-auto w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_12px_rgba(56,189,248,0.6)] ${isCollapsed ? 'lg:hidden' : ''}`}></div>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer Controls */}
        <div className={`p-6 transition-all duration-300 ${isCollapsed ? 'lg:p-4' : 'p-6'}`}>
          <div className={`border-t border-outline transition-all duration-300 ${
            isCollapsed 
              ? 'lg:flex lg:flex-col lg:items-center w-full lg:space-y-2 lg:pt-2 space-y-4 pt-4' 
              : 'space-y-4 pt-4'
          }`}>
            {/* Help Center */}
            <div className="relative group w-full flex justify-center">
              <button 
                onMouseEnter={(e) => {
                  if (!isCollapsed) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTooltip({
                    top: rect.top + rect.height / 2,
                    label: 'Help Center',
                    left: '66px'
                  });
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
                className={`w-full flex items-center text-on-surface-dim hover:text-primary transition-colors text-[13.5px] font-bold transition-all duration-300 rounded-xl px-2 py-2 ${isCollapsed ? 'lg:w-11 lg:h-11 lg:p-0 lg:justify-center' : ''}`}
              >
                <ClipboardList className={`w-4 h-4 ${isCollapsed ? 'lg:mr-0' : 'lg:mr-3'} mr-3 opacity-40 hover:opacity-100 transition-all duration-300 shrink-0`} />
                <span className={`whitespace-nowrap transition-all duration-300 inline-block ${isCollapsed ? 'lg:opacity-0 lg:max-w-0 lg:overflow-hidden lg:pointer-events-none' : 'lg:opacity-100 lg:max-w-[150px]'}`}>
                  Help Center
                </span>
              </button>
            </div>

            {/* System Settings */}
            <div className="relative group w-full flex justify-center">
              <button 
                onClick={onSettingsClick}
                onMouseEnter={(e) => {
                  if (!isCollapsed) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTooltip({
                    top: rect.top + rect.height / 2,
                    label: 'System Settings',
                    left: '66px'
                  });
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
                className={`w-full flex items-center rounded-xl transition-all duration-300 px-2 py-2 text-[13.5px] font-bold
                  ${isCollapsed ? 'lg:w-11 lg:h-11 lg:p-0 lg:justify-center' : ''}
                  ${activeView === 'admin' 
                    ? 'bg-primary/10 text-primary font-black' 
                    : 'text-on-surface-dim hover:bg-surface-dim hover:text-on-surface'
                  }`}
              >
                <Settings className={`w-4 h-4 ${isCollapsed ? 'lg:mr-0' : 'lg:mr-3'} mr-3 transition-all duration-300 shrink-0 ${activeView === 'admin' ? 'text-primary' : 'opacity-40 hover:opacity-100'}`} />
                <span className={`whitespace-nowrap transition-all duration-300 inline-block ${activeView === 'admin' ? 'font-black' : ''} ${isCollapsed ? 'lg:opacity-0 lg:max-w-0 lg:overflow-hidden lg:pointer-events-none' : 'lg:opacity-100 lg:max-w-[150px]'}`}>
                  System Settings
                </span>
              </button>
            </div>

            {/* Sign Out */}
            <div className="relative group w-full flex justify-center">
              <button 
                onClick={onLogout}
                onMouseEnter={(e) => {
                  if (!isCollapsed) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTooltip({
                    top: rect.top + rect.height / 2,
                    label: 'Sign Out',
                    left: '66px',
                    isError: true
                  });
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
                className={`w-full flex items-center text-error font-black hover:brightness-110 rounded-xl transition-all duration-300 text-[13.5px] px-2 py-2 ${isCollapsed ? 'lg:w-11 lg:h-11 lg:p-0 lg:justify-center' : ''}`}
              >
                <LogOut className={`w-4 h-4 ${isCollapsed ? 'lg:mr-0' : 'lg:mr-3'} mr-3 opacity-60 hover:translate-x-1 transition-all duration-300 shrink-0`} />
                <span className={`whitespace-nowrap transition-all duration-300 inline-block ${isCollapsed ? 'lg:opacity-0 lg:max-w-0 lg:overflow-hidden lg:pointer-events-none' : 'lg:opacity-100 lg:max-w-[150px]'}`}>
                  Sign Out
                </span>
              </button>
            </div>

            {/* Collapse Toggle */}
            <div className={`hidden lg:flex relative group w-full border-t border-outline/50 transition-all duration-300 ${
              isCollapsed ? 'lg:justify-center lg:pt-2' : 'lg:justify-end lg:pt-4'
            }`}>
              <button 
                onClick={toggleCollapse}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTooltip({
                    top: rect.top + rect.height / 2,
                    label: isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar',
                    left: isCollapsed ? '66px' : '258px'
                  });
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
                className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-300 text-on-surface-dim hover:bg-surface-dim hover:text-on-surface cursor-pointer"
              >
                <PanelLeft className={`w-4 h-4 opacity-60 hover:opacity-100 transition-all duration-300 shrink-0 ${isCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip - visible only on desktop */}
      {hoveredTooltip && (
        <div 
          className={`hidden lg:block fixed px-3 py-1.5 bg-surface-lowest border border-outline text-[11px] font-black uppercase tracking-wider rounded-xl shadow-premium z-[999] whitespace-nowrap pointer-events-none transition-all duration-150 transform translate-x-1 ${
            hoveredTooltip.isError ? 'text-error' : 'text-on-surface'
          }`}
          style={{
            left: hoveredTooltip.left || '82px',
            top: `${hoveredTooltip.top}px`,
            transform: 'translateY(-50%)'
          }}
        >
          {hoveredTooltip.label}
        </div>
      )}
    </aside>
  );
};