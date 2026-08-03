import React, { useState, useCallback } from 'react';
import { User, UserRole } from '../types';
import { 
  LayoutDashboard, 
  Plane, 
  FileText, 
  Database, 
  Droplet, 
  Anchor, 
  Sailboat,
  TrendingUp,
  Settings,
  Calendar,
  Truck,
  SlidersHorizontal,
  Fuel,
  BookOpen,
  History,
  Briefcase,
  Coins,
  Receipt,
  BarChart3,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Eclipse,
  Ship,
  Search
} from 'lucide-react';
import { BottomSheet, SheetAction, SheetDivider, SheetSectionHeader } from './BottomSheet';
import { haptic } from '../utils/haptics';

interface BottomNavProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onMenuClick: () => void;
  isVisible?: boolean;
  onSettingsClick?: () => void;
  onLogout?: () => void;
  theme?: 'light' | 'dark' | 'black';
  onThemeToggle?: () => void;
  pendingTasks?: number;
  activeJobs?: number;
  unreadAlerts?: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  user, 
  activeView, 
  setActiveView, 
  onMenuClick,
  isVisible = true,
  onSettingsClick,
  onLogout,
  theme,
  onThemeToggle,
  pendingTasks = 0,
  activeJobs = 0,
  unreadAlerts = 0,
}) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // ── Primary Nav Items (shown in bottom bar) ────────────────────────────────
  const getNavItems = (): NavItem[] => {
    if (!user || !user.role) return [];
    switch (user.role) {
      case UserRole.ITP_OPERATOR:
      case UserRole.ITP_SUPERVISOR:
      case UserRole.ITP_HD_OPERATOR:
        return [
          { id: 'dashboard', label: 'Tasks', icon: LayoutDashboard, badge: pendingTasks, badgeColor: pendingTasks > 0 ? 'bg-red-500' : undefined },
          { id: 'intoplane', label: 'Refuel', icon: Plane, badge: activeJobs, badgeColor: activeJobs > 0 ? 'bg-amber-500' : undefined },
          { id: 'briefing', label: 'Briefing', icon: BookOpen },
          { id: 'equipment', label: 'Equipment', icon: Truck },
          { id: 'history', label: 'Logs', icon: History },
        ];

      case UserRole.ITP_OFFICER:
        return [
          { id: 'dashboard', label: 'Tasks', icon: LayoutDashboard, badge: pendingTasks, badgeColor: pendingTasks > 0 ? 'bg-red-500' : undefined },
          { id: 'intoplane', label: 'Refuel', icon: Plane },
          { id: 'schedule', label: 'Schedule', icon: Calendar },
          { id: 'briefing', label: 'Briefing', icon: BookOpen },
          { id: 'history', label: 'Logs', icon: History },
        ];

      case UserRole.ITP_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Refuel', icon: Plane },
          { id: 'schedule', label: 'Schedule', icon: Calendar },
          { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
          { id: 'history', label: 'Logs', icon: History },
        ];

      case UserRole.DEPOT_OPERATOR:
        return [
          { id: 'dashboard', label: 'Status', icon: LayoutDashboard },
          { id: 'stock', label: 'Tanks', icon: Database },
          { id: 'bridging', label: 'Loading', icon: Droplet },
          { id: 'marine', label: 'Marine', icon: Anchor },
          { id: 'lfs-afs', label: 'Stations', icon: Fuel },
        ];

      case UserRole.DEPOT_MANAGER:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'stock', label: 'Stock', icon: Database },
          { id: 'bridging', label: 'Transfer', icon: Droplet },
          { id: 'forecasting', label: 'Forecast', icon: TrendingUp },
          { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
        ];

      case UserRole.EXECUTIVE:
        return [
          { id: 'executive', label: 'Overview', icon: LayoutDashboard },
          { id: 'forecasting', label: 'Forecast', icon: TrendingUp },
          { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
          { id: 'commercial-reports', label: 'Commercial', icon: Coins },
          { id: 'finance', label: 'Finance', icon: Receipt },
        ];

      case UserRole.COMMERCIAL:
        return [
          { id: 'commercial-reports', label: 'Commercial', icon: Coins },
          { id: 'forecasting', label: 'Forecast', icon: TrendingUp },
          { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
          { id: 'finance', label: 'Finance', icon: Receipt },
        ];

      case UserRole.FINANCE:
        return [
          { id: 'finance', label: 'Finance', icon: Receipt },
          { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
          { id: 'reports', label: 'Reports', icon: FileText },
        ];

      case UserRole.FUEL_MANAGEMENT:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Refuel', icon: Plane },
          { id: 'forecasting', label: 'Forecast', icon: TrendingUp },
          { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
          { id: 'executive', label: 'Executive', icon: Briefcase },
        ];

      case UserRole.ADMIN:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'admin', label: 'Admin', icon: Settings },
          { id: 'schedule', label: 'Schedule', icon: Calendar },
          { id: 'intoplane', label: 'Refuel', icon: Plane },
          { id: 'stock', label: 'Stock', icon: Database },
        ];

      case UserRole.CUSTOMER:
        // Customer portal is self-contained — no bottom nav
        return [];

      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'history', label: 'Logs', icon: History },
        ];
    }
  };

  // ── Overflow Sheet Items (items NOT in bottom nav) ─────────────────────────
  const getOverflowItems = (): NavItem[] => {
    if (!user || !user.role) return [];
    switch (user.role) {
      case UserRole.ITP_OPERATOR:
      case UserRole.ITP_SUPERVISOR:
      case UserRole.ITP_HD_OPERATOR:
        return [];

      case UserRole.ITP_OFFICER:
        return [
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
        ];

      case UserRole.ITP_MANAGER:
        return [
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
        ];

      case UserRole.DEPOT_OPERATOR:
        return [
          { id: 'marine-loading', label: 'Marine Loading', icon: Ship },
          { id: 'seaplane', label: 'Seaplane Ops', icon: Sailboat },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
        ];

      case UserRole.DEPOT_MANAGER:
        return [
          { id: 'marine-loading', label: 'Marine Provisioning', icon: Ship },
          { id: 'marine', label: 'Marine Oversight', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
          { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'history', label: 'Log History', icon: History },
        ];

      case UserRole.EXECUTIVE:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ];

      case UserRole.COMMERCIAL:
        return [];

      case UserRole.FINANCE:
        return [];

      case UserRole.FUEL_MANAGEMENT:
        return [
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
          { id: 'history', label: 'Log History', icon: History },
          { id: 'commercial-reports', label: 'Commercial Reports', icon: Coins },
          { id: 'finance', label: 'Finance & Billing', icon: Receipt },
        ];

      case UserRole.ADMIN:
        return [
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'history', label: 'Log History', icon: History },
          { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
          { id: 'bridging', label: 'Transfer Oversight', icon: Droplet },
          { id: 'marine-loading', label: 'Marine Loading', icon: Ship },
          { id: 'marine', label: 'Marine Oversight', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
          { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
          { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
          { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
          { id: 'commercial-reports', label: 'Commercial Reports', icon: Coins },
          { id: 'executive', label: 'Executive Module', icon: Briefcase },
          { id: 'finance', label: 'Finance & Billing', icon: Receipt },
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const overflowItems = getOverflowItems();
  const activeIndex = navItems.findIndex(item => item.id === activeView);
  // Check if activeView is in overflow items (to highlight the "more" button)
  const isOverflowActive = overflowItems.some(item => item.id === activeView);
  const hasOverflow = overflowItems.length > 0 || onSettingsClick || onLogout;

  const handleNavClick = useCallback((viewId: string) => {
    haptic('TAP');
    setActiveView(viewId);
  }, [setActiveView]);

  const handleOverflowOpen = useCallback(() => {
    haptic('TAP');
    setIsSheetOpen(true);
  }, []);

  const handleSheetNavClick = useCallback((viewId: string) => {
    haptic('SELECTION');
    setActiveView(viewId);
    setIsSheetOpen(false);
  }, [setActiveView]);

  if (navItems.length === 0) return null;

  // Total items = nav items + (overflow button if needed)
  const totalSlots = navItems.length + (hasOverflow ? 1 : 0);

  return (
    <>
      <div className={`fixed left-0 right-0 mx-auto w-[calc(100%-48px)] bg-surface border border-slate-300/40 dark:border-[rgba(255,255,255,0.08)] lg:hidden z-50 px-4 rounded-[32px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6),0_0_20px_rgba(0,0,0,0.2)] transition-[transform,opacity,visibility] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        isVisible ? 'translate-y-0 opacity-100 scale-100 visible' : 'translate-y-32 opacity-0 scale-90 invisible pointer-events-none'
      }`}
      style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-around h-16 relative">
          {/* Sliding Indicator */}
          {activeIndex !== -1 && (
            <div 
              className="absolute bottom-1 h-1 bg-primary rounded-full shadow-glow transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10"
              style={{ 
                width: '24px',
                left: `calc(${(activeIndex / totalSlots) * 100}% + ${(100 / totalSlots) / 2}% - 12px)` 
              }}
            />
          )}

          {/* Nav Items */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all duration-300 relative active:scale-95 ${
                  isActive ? 'text-primary' : 'text-on-surface-dim'
                }`}
              >
                <div className={`relative p-2 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isActive ? 'bg-primary/10 shadow-glow scale-110' : 'opacity-60 scale-100 hover:bg-primary/5'}`}>
                  <Icon className={`w-5 h-5 transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100'}`} />
                  {/* Badge Dot */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 ${item.badgeColor || 'bg-red-500'} rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-lg ring-2 ring-surface animate-pulse`}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          
          {/* Overflow Menu Button (replaces old sidebar "More" button) */}
          {hasOverflow && (
            <button
              onClick={handleOverflowOpen}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 group active:scale-95 transition-all duration-300 rounded-full ${
                isOverflowActive ? 'text-primary' : 'text-on-surface-dim'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isOverflowActive ? 'bg-primary/10 shadow-glow scale-110' : 'opacity-60 group-hover:bg-primary/5'
              }`}>
                <SlidersHorizontal className="w-5 h-5 transition-transform duration-500" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Overflow Bottom Sheet */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="More Options"
      >
        {/* Overflow Navigation Items */}
        {overflowItems.length > 0 && (
          <div className="py-0.5">
            <SheetSectionHeader title="Other Modules" />
            {overflowItems.map((item) => (
              <SheetAction
                key={item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => handleSheetNavClick(item.id)}
                badge={item.badge}
              />
            ))}
          </div>
        )}

        {/* Separator */}
        {overflowItems.length > 0 && (onSettingsClick || onLogout) && <SheetDivider />}

        {/* System & Preferences Section */}
        <div className="py-0.5">
          <SheetSectionHeader title="Preferences & System" />
          {onThemeToggle && (
            <SheetAction
              icon={theme === 'light' ? Moon : theme === 'dark' ? Eclipse : Sun}
              label={theme === 'light' ? 'Dark Mode' : theme === 'dark' ? 'Black Mode' : 'Light Mode'}
              onClick={() => {
                onThemeToggle();
              }}
            />
          )}
          {onSettingsClick && (
            <SheetAction
              icon={Settings}
              label="Settings"
              onClick={() => {
                onSettingsClick();
                setIsSheetOpen(false);
              }}
            />
          )}
          <SheetAction
            icon={HelpCircle}
            label="Help Center"
            onClick={() => setIsSheetOpen(false)}
          />
        </div>

        {/* Sign Out */}
        {onLogout && (
          <>
            <SheetDivider />
            <div className="py-0.5">
              <SheetAction
                icon={LogOut}
                label="Sign Out"
                onClick={() => {
                  onLogout();
                  setIsSheetOpen(false);
                }}
                variant="danger"
              />
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
};
