import React, { useState, useCallback } from 'react';
import { User } from '../types';
import { 
  SlidersHorizontal,
  Settings,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Eclipse,
} from 'lucide-react';
import { BottomSheet, SheetAction, SheetDivider, SheetSectionHeader } from './BottomSheet';
import { haptic } from '../utils/haptics';
import { getRoleNavItems, getRoleOverflowItems } from '../utils/navigation';

interface BottomNavProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onMenuClick?: () => void;
  isVisible?: boolean;
  onSettingsClick?: () => void;
  onLogout?: () => void;
  theme?: 'light' | 'dark' | 'black';
  onThemeToggle?: () => void;
  pendingTasks?: number;
  activeJobs?: number;
  unreadAlerts?: number;
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

  // ── Primary Nav Items (derived from authoritative role config) ──────────────
  const navItems = getRoleNavItems(user?.role, { pendingTasks, activeJobs, unreadAlerts });

  // ── Overflow Sheet Items (all role modules not in bottom bar) ──────────────
  const overflowItems = getRoleOverflowItems(user?.role, navItems);

  const activeIndex = navItems.findIndex(item => item.id === activeView);
  // Check if activeView is in overflow items (to highlight the "more" button)
  const isOverflowActive = overflowItems.some(item => item.id === activeView);
  const hasOverflow = overflowItems.length > 0 || onSettingsClick || onLogout;

  const handleNavClick = useCallback((viewId: string) => {
    haptic('NAV_TAP');
    setActiveView(viewId);
  }, [setActiveView]);

  const handleOverflowOpen = useCallback(() => {
    haptic('NAV_TAP');
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
                isOverflowActive || isSheetOpen ? 'text-primary' : 'text-on-surface-dim'
              }`}
              aria-label="More options"
            >
              <div className={`p-2 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isOverflowActive || isSheetOpen ? 'bg-primary/10 shadow-glow scale-110' : 'opacity-60 group-hover:bg-primary/5'
              }`}>
                <SlidersHorizontal className={`w-5 h-5 transition-transform duration-500 ${isSheetOpen ? 'rotate-90 text-primary' : ''}`} />
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
                isActive={activeView === item.id}
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
              isActive={activeView === 'admin'}
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
