
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { IntoPlane } from './components/IntoPlane';
import { Forecasting } from './components/Forecasting';
import { Bridging } from './components/Bridging';
import { TankerDischarge } from './components/TankerDischarge';
import { Stock } from './components/Stock';
import { LogHistory } from './components/LogHistory';
import { Schedule } from './components/Schedule';
import { ShiftBriefing } from './components/ShiftBriefing';
import { SystemAdmin } from './components/SystemAdmin';
import { CommercialReports } from './components/CommercialReports';
import { Seaplane } from './components/Seaplane';
import { EquipmentStatus } from './components/EquipmentStatus';
import { MarineLoading } from './components/MarineLoading';
import { LfsAfs } from './components/LfsAfs';
import { FuelReports } from './components/FuelReports';
import { Login } from './components/Login';
import { Logo } from './components/Logo';
import { BottomNav } from './components/BottomNav';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { OperationalDataProvider, useOperationalData } from './context/OperationalDataContext';
import { FinanceDataProvider } from './context/FinanceDataContext';
import { FinanceModule } from './components/FinanceModule';
import { CustomerPortal } from './components/CustomerPortal';
import { ExecutiveModule } from './components/ExecutiveModule';
import { MOCK_USERS } from './constants';
import { User, UserRole, FlightJob, Alert } from './types';
import { Wifi, WifiOff, PanelLeft, X, Loader2, Search, Bell, User as UserIcon, AlertCircle, Sun, Moon, CheckCircle, Share2, Smartphone, Trash2 } from 'lucide-react';
import { updatePWAManifestAndTheme } from './utils/pwa';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [showHeader, setShowHeader] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const scrollRef = React.useRef<HTMLElement>(null);
  const [pendingJob, setPendingJob] = useState<FlightJob | null>(null);

  // Theme management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updatePWAManifestAndTheme(isDarkMode);
  }, [isDarkMode]);
  
  // Splash screen fadeout
  useEffect(() => {
    const splash = document.getElementById('pwa-splash');
    if (splash) {
      // Fade out after 1.5 seconds for premium fluid feel
      const timer = setTimeout(() => {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        // Remove from DOM after transition completes
        const removeTimer = setTimeout(() => {
          splash.remove();
        }, 500);
        return () => clearTimeout(removeTimer);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === UserRole.CUSTOMER) {
      setActiveView('customer-portal');
    } else if (user.role === UserRole.FINANCE) {
      setActiveView('finance');
    } else {
      setActiveView('dashboard');
    }
  };

  // Wrap everything in ONE NotificationProvider so both Login and App can use toasts
  return (
    <NotificationProvider>
      <FinanceDataProvider>
        {!currentUser ? (
          <LoginWrapper onLogin={handleLoginSuccess} />
        ) : (
          <OperationalDataProvider user={currentUser}>
            <AppContextContent 
              currentUser={currentUser}
              activeView={activeView}
              setActiveView={setActiveView}
              isMobileMenuOpen={isMobileMenuOpen}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              showHeader={showHeader}
              setShowHeader={setShowHeader}
              scrollRef={scrollRef}
              pendingJob={pendingJob}
              setPendingJob={setPendingJob}
              showAlertsPanel={showAlertsPanel}
              setShowAlertsPanel={setShowAlertsPanel}
              isSettingsOpen={isSettingsOpen}
              setIsSettingsOpen={setIsSettingsOpen}
              handleLogout={handleLogout}
            />
          </OperationalDataProvider>
        )}
      </FinanceDataProvider>
    </NotificationProvider>
  );
};

/**
 * LoginWrapper: renders Login inside the shared NotificationProvider scope,
 * and fires a welcome + unread-notifications toast right after sign-in.
 */
const LoginWrapper: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const { notify } = useNotification();

  const handleLogin = (user: User) => {
    onLogin(user);
    // Fire welcome toast
    notify(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');

    // Check for any persisted unread alerts
    try {
      const saved = localStorage.getItem('fms_alerts');
      const alerts = saved ? JSON.parse(saved) : [];
      const unread = (alerts as any[]).filter((a: any) => !a.acknowledged).length;
      if (unread > 0) {
        setTimeout(() => {
          notify(
            `You have ${unread} unread notification${unread === 1 ? '' : 's'}. Open the bell icon to review.`,
            'warning'
          );
        }, 900);
      }
    } catch (_) {}
  };

  return <Login onLogin={handleLogin} />;
};

const AppContextContent: React.FC<any> = ({ 
  currentUser, activeView, setActiveView, isMobileMenuOpen, setIsMobileMenuOpen,
  isDarkMode, setIsDarkMode, showHeader, setShowHeader, scrollRef, pendingJob, setPendingJob,
  showAlertsPanel, setShowAlertsPanel, isSettingsOpen, setIsSettingsOpen, handleLogout
}) => {
  const { alerts, acknowledgeAlert, acknowledgeAllAlerts, clearAllAlerts, equipment, flightJobs, refreshData } = useOperationalData();
  const { notify, notifyWithAction, dismiss } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);

  const alertsRef = React.useRef<HTMLDivElement>(null);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  // Click outside handlers for modals/dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showAlertsPanel && alertsRef.current && !alertsRef.current.contains(target)) {
        setShowAlertsPanel(false);
      }
      if (isSettingsOpen && settingsRef.current && !settingsRef.current.contains(target)) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAlertsPanel, isSettingsOpen]);

  const mainRefCallback = React.useCallback((node: HTMLElement | null) => {
    scrollRef.current = node;
    setMainElement(node);
  }, [scrollRef]);

  // --- Real-time Notification Toast System ---
  const isFirstLoadRef = React.useRef(true);
  const prevAlertsRef = React.useRef<Alert[]>([]);

  useEffect(() => {
    if (!currentUser || !alerts) return;

    // Filter unacknowledged alerts matching this user's role
    const activeAlerts = alerts.filter(a => {
      if (!a || a.acknowledged) return false;
      if ([UserRole.ADMIN, UserRole.EXECUTIVE].includes(currentUser.role)) return true;
      if (a.targetRole === currentUser.role) return true;
      if ([UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(currentUser.role) && 
          a.targetRole && [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(a.targetRole as UserRole)) return true;
      if ([UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(currentUser.role) && 
          a.targetRole && [UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(a.targetRole as UserRole)) return true;
      return !a.targetRole;
    });

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevAlertsRef.current = alerts;
      
      // On login/first load, fire individual toasts for active unread alerts
      if (activeAlerts.length > 0) {
        setTimeout(() => {
          activeAlerts.forEach(alert => {
            let type: 'info' | 'success' | 'warning' | 'error' = 'info';
            if (alert.severity === 'critical') type = 'error';
            else if (alert.severity === 'medium') type = 'warning';
            
            notify(alert.message, type);
          });
        }, 1500);
      }
      return;
    }

    // Find newly added alerts
    const prevIds = new Set(prevAlertsRef.current.map(a => a.id));
    const newlyAdded = activeAlerts.filter(a => !prevIds.has(a.id));

    if (newlyAdded.length > 0) {
      newlyAdded.forEach(alert => {
        let type: 'info' | 'success' | 'warning' | 'error' = 'info';
        if (alert.severity === 'critical') type = 'error';
        else if (alert.severity === 'medium') type = 'warning';
        
        notify(alert.message, type);
      });
    }

    prevAlertsRef.current = alerts;
  }, [alerts, currentUser, notify]);

  // --- Dynamic PWA Install States & Events ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const installToastIdRef = React.useRef<string | null>(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      // Dismiss install toast if still showing
      if (installToastIdRef.current) {
        dismiss(installToastIdRef.current);
        installToastIdRef.current = null;
      }
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [dismiss]);

  // Show install toast after 4 seconds if not installed and not dismissed
  useEffect(() => {
    const timer = setTimeout(() => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (isStandalone) return;
      const dismissed = localStorage.getItem('fms-install-dismissed');
      if (dismissed) return;
      if (!deferredPrompt && !isIOS) return;

      const toastId = notifyWithAction(
        'Install FMS on your home screen for offline access and native performance.',
        'info',
        {
          label: isIOS ? 'Show Guide' : 'Install Now',
          onClick: () => handleInstallApp()
        },
        0 // persist until user dismisses
      );
      installToastIdRef.current = toastId;
    }, 4000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredPrompt, isIOS]);

  const handleInstallApp = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      // Dismiss install toast
      if (installToastIdRef.current) {
        dismiss(installToastIdRef.current);
        installToastIdRef.current = null;
      }
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      localStorage.setItem('fms-install-dismissed', 'true');
      if (installToastIdRef.current) {
        dismiss(installToastIdRef.current);
        installToastIdRef.current = null;
      }
    }
  };

  // --- Dynamic Pull to Refresh Hook ---
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = React.useRef(0);
  const pullingRef = React.useRef(false);

  useEffect(() => {
    const mainEl = mainElement;
    if (!mainEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (mainEl.scrollTop <= 0 && !isRefreshing) {
        startYRef.current = e.touches[0].pageY;
        pullingRef.current = true;
      } else {
        pullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || isRefreshing) return;
      const currentY = e.touches[0].pageY;
      const diff = currentY - startYRef.current;
      
      if (diff > 0) {
        // Resistance curve
        const distance = Math.min(80, diff * 0.4);
        setPullDistance(distance);
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!pullingRef.current || isRefreshing) return;
      pullingRef.current = false;

      if (pullDistance >= 60) {
        setIsRefreshing(true);
        setPullDistance(60);
        try {
          await refreshData();
        } catch (err) {
          console.error(err);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 800);
        }
      } else {
        setPullDistance(0);
      }
    };

    mainEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    mainEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    mainEl.addEventListener('touchend', handleTouchEnd);

    return () => {
      mainEl.removeEventListener('touchstart', handleTouchStart);
      mainEl.removeEventListener('touchmove', handleTouchMove);
      mainEl.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mainElement, pullDistance, isRefreshing, refreshData]);

  // Header scroll listener
  const lastScrollYRef = React.useRef(0);
  useEffect(() => {
    if (!mainElement) return;

    const handleScroll = () => {
      const currentScrollY = Math.max(0, mainElement.scrollTop);
      // Add a small 50px buffer to maxScroll to be completely safe against rounding errors
      const maxScroll = Math.max(0, mainElement.scrollHeight - mainElement.clientHeight) - 50;
      const isMobile = window.innerWidth < 1024;
      
      if (!isMobile) {
        setShowHeader(true);
        return;
      }

      // Hide if scrolling down and passed a small threshold
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 20) {
        // Only hide if we aren't rubber-banding at the very top
        setShowHeader(false);
      } 
      // Show if scrolling up significantly OR at the very top
      else if (currentScrollY < lastScrollYRef.current - 10 || currentScrollY <= 10) {
        // Guard against iOS bottom overscroll bounce.
        // Don't reveal the header if we are bouncing below the max scroll depth.
        if (currentScrollY <= maxScroll || currentScrollY <= 10) {
          setShowHeader(true);
        }
      }
      
      lastScrollYRef.current = currentScrollY;
    };

    mainElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainElement.removeEventListener('scroll', handleScroll);
  }, [mainElement, setShowHeader]);

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return { equipment: [], jobs: [], personnel: [] };
    const lower = searchQuery.toLowerCase();
    return {
      equipment: (equipment || []).filter(e => e.id.toLowerCase().includes(lower) || e.type.toLowerCase().includes(lower)),
      jobs: (flightJobs || []).filter(j => j.flightNumber.toLowerCase().includes(lower) || j.aircraftReg.toLowerCase().includes(lower) || j.aircraftType.toLowerCase().includes(lower)),
      personnel: MOCK_USERS.filter(u => u.name.toLowerCase().includes(lower) || u.role.toLowerCase().includes(lower))
    };
  }, [searchQuery, equipment, flightJobs]);

  // Filter alerts by role — must match the same logic as the toast notification system
  const userAlerts = (alerts || []).filter(a => {
    if (!a || !currentUser || !currentUser.role) return false;
    if ([UserRole.ADMIN, UserRole.EXECUTIVE].includes(currentUser.role)) return true;
    if (a.targetRole === currentUser.role) return true;
    // Depot role group: both DEPOT_MANAGER and DEPOT_OPERATOR see depot-targeted alerts
    if ([UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(currentUser.role) && 
        a.targetRole && [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(a.targetRole as UserRole)) return true;
    // ITP role group: ITP_MANAGER, ITP_OPERATOR, and ITP_HD_OPERATOR see each other's alerts
    if ([UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(currentUser.role) && 
        a.targetRole && [UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(a.targetRole as UserRole)) return true;
    return !a.targetRole;
  });

  const unacknowledgedCount = (userAlerts || []).filter(a => a && !a.acknowledged).length;
  const activeCriticalAlerts = userAlerts.filter(a => a && !a.acknowledged && a.severity === 'critical');

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard 
            user={currentUser} 
            setActiveView={setActiveView} 
            onStartJob={(job: FlightJob) => {
              setPendingJob(job);
              setActiveView('intoplane');
            }}
          />
        );
      case 'intoplane':
        return (
          <IntoPlane 
            user={currentUser} 
            initialJob={pendingJob}
            onClearInitialJob={() => setPendingJob(null)}
          />
        );
      case 'forecasting':
        if (currentUser?.role === UserRole.DEPOT_OPERATOR) {
          return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
              <div className="w-24 h-24 bg-error/10 rounded-[32px] flex items-center justify-center mb-6 border border-error/20 shadow-premium">
                <AlertCircle className="w-10 h-10 text-error shadow-glow" />
              </div>
              <h2 className="text-xl sm:text-2xl font-[900] text-on-surface mb-2 tracking-tighter uppercase italic">ACCESS DENIED</h2>
              <p className="text-on-surface-dim max-w-sm uppercase tracking-widest text-[9px] font-black opacity-60">
                You do not have administrative authorization to view stock forecasting. Security log updated.
              </p>
            </div>
          );
        }
        return <Forecasting />;
      case 'bridging':
        return <Bridging user={currentUser} />;
      case 'marine-loading':
        return <MarineLoading user={currentUser} />;
      case 'marine':
        return <TankerDischarge />;
      case 'stock':
        return <Stock user={currentUser} />;
      case 'lfs-afs':
        return <LfsAfs user={currentUser} />;
      case 'history':
        return <LogHistory user={currentUser} />;
      case 'schedule':
        return <Schedule />;
      case 'briefing':
        return <ShiftBriefing />;
      case 'admin':
        return currentUser.role === UserRole.ADMIN ? <SystemAdmin currentUser={currentUser} /> : <Dashboard user={currentUser} setActiveView={setActiveView} onStartJob={() => {}} />;
      case 'depot-reports':
      case 'reports':
        if (currentUser?.role === UserRole.DEPOT_OPERATOR) {
          return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
              <div className="w-24 h-24 bg-error/10 rounded-[32px] flex items-center justify-center mb-6 border border-error/20 shadow-premium">
                <AlertCircle className="w-10 h-10 text-error shadow-glow" />
              </div>
              <h2 className="text-xl sm:text-2xl font-[900] text-on-surface mb-2 tracking-tighter uppercase italic">ACCESS DENIED</h2>
              <p className="text-on-surface-dim max-w-sm uppercase tracking-widest text-[9px] font-black opacity-60">
                You do not have administrative authorization to view fuel and transaction summaries. Security log updated.
              </p>
            </div>
          );
        }
        if (activeView === 'reports' && ![UserRole.DEPOT_MANAGER, UserRole.ADMIN].includes(currentUser?.role as UserRole)) {
          return <CommercialReports />;
        }
        return <FuelReports user={currentUser} />;
      case 'commercial-reports':
        if (currentUser?.role && [UserRole.DEPOT_OPERATOR, UserRole.DEPOT_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_MANAGER].includes(currentUser?.role)) {
          return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
              <div className="w-24 h-24 bg-error/10 rounded-[32px] flex items-center justify-center mb-6 border border-error/20 shadow-premium">
                <AlertCircle className="w-10 h-10 text-error shadow-glow" />
              </div>
              <h2 className="text-xl sm:text-2xl font-[900] text-on-surface mb-2 tracking-tighter uppercase italic">ACCESS DENIED</h2>
              <p className="text-on-surface-dim max-w-sm uppercase tracking-widest text-[9px] font-black opacity-60">
                You do not have administrative authorization to view commercial contracts and route statistics. Security log updated.
              </p>
            </div>
          );
        }
        return <CommercialReports />;
      case 'executive':
        if (currentUser?.role && ![UserRole.ADMIN, UserRole.EXECUTIVE].includes(currentUser.role)) {
          return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
              <div className="w-24 h-24 bg-error/10 rounded-[32px] flex items-center justify-center mb-6 border border-error/20 shadow-premium">
                <AlertCircle className="w-10 h-10 text-error shadow-glow" />
              </div>
              <h2 className="text-xl sm:text-2xl font-[900] text-on-surface mb-2 tracking-tighter uppercase italic">ACCESS DENIED</h2>
              <p className="text-on-surface-dim max-w-sm uppercase tracking-widest text-[9px] font-black opacity-60">
                You do not have administrative authorization to view executive daily summaries. Security log updated.
              </p>
            </div>
          );
        }
        return <ExecutiveModule user={currentUser} />;
      case 'equipment':
        return <EquipmentStatus user={currentUser!} />;
      case 'seaplane':
        return <Seaplane user={currentUser} />;
      case 'finance':
        return <FinanceModule />;
      case 'customer-portal':
        return <CustomerPortal user={currentUser} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Module under construction: {activeView}</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden text-on-surface transition-colors duration-500">
        {/* Sidebar */}
        <Sidebar 
          user={currentUser} 
          activeView={activeView} 
          setActiveView={(view: string) => {
            setActiveView(view);
            setIsMobileMenuOpen(false);
          }}
          onLogout={handleLogout}
          isMobileMenuOpen={isMobileMenuOpen}
          onSettingsClick={() => {
            if (currentUser?.role === UserRole.ADMIN) {
              setActiveView('admin');
              setIsMobileMenuOpen(false);
            } else {
              setIsSettingsOpen(true);
            }
          }}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-colors duration-500">
          
          {(showAlertsPanel || isSettingsOpen) && (
             <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-40 transition-all duration-500 lg:hidden" onClick={() => { setShowAlertsPanel(false); setIsSettingsOpen(false); }} />
          )}

          {/* Main Content Scroll Area */}
          <main ref={mainRefCallback} className="flex-1 overflow-y-auto relative canvas scroll-smooth overscroll-none pb-32 lg:pb-10">
            
            {/* Dynamic Pull to Refresh Hex Droplet Spinner */}
            {(pullDistance > 0 || isRefreshing) && (
              <div 
                className="absolute left-0 right-0 z-[100] flex justify-center pointer-events-none transition-all duration-100"
                style={{ 
                  top: `${pullDistance - 35}px`, 
                  opacity: Math.min(1, pullDistance / 40)
                }}
              >
                <div className="bg-surface-lowest border border-outline rounded-full p-2.5 shadow-premium flex items-center justify-center transition-all duration-300">
                  <div className="relative w-5 h-5 flex items-center justify-center text-primary">
                    <svg 
                      className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
                      viewBox="0 0 120 120" 
                      fill="none" 
                      style={{ 
                        transform: isRefreshing ? undefined : `rotate(${pullDistance * 4.5}deg)`,
                        transition: isRefreshing ? 'none' : 'transform 0.1s linear'
                      }}
                    >
                      <path 
                        d="M60 15 L100 38 V82 L60 105 L20 82 V38 Z" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                      <path 
                        d="M60 35 C60 35 45 55 45 65 C45 73.284 51.716 80 60 80 C68.284 80 75 73.284 75 65 C75 55 60 35 60 35 Z" 
                        fill="currentColor" 
                      />
                      <circle cx="60" cy="15" r="6" fill="currentColor" />
                      <circle cx="100" cy="38" r="6" fill="currentColor" />
                      <circle cx="100" cy="82" r="6" fill="currentColor" />
                      <circle cx="60" cy="105" r="6" fill="currentColor" />
                      <circle cx="20" cy="82" r="6" fill="currentColor" />
                      <circle cx="20" cy="38" r="6" fill="currentColor" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Animated Combined Header Container */}
            <div className={`transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] sticky top-0 z-50 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
            {/* Phase 1: Critical Alert Bar */}
            <div className={`transition-all duration-700 ease-in-out overflow-hidden shadow-lg ${activeCriticalAlerts.length > 0 ? 'h-10 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
              <div className="h-10 bg-error text-white flex items-center justify-between px-6 relative">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">
                    Critical Alert: <span className="opacity-80 font-medium ml-2">
                      {activeCriticalAlerts[0]?.message}
                      {activeCriticalAlerts.length > 1 && ` • +${activeCriticalAlerts.length - 1} more`}
                    </span>
                  </span>
                </div>
                <div className="flex items-center space-x-6">
                  <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest hidden md:block">Primary Loop: Offline</span>
                  <button 
                    onClick={() => acknowledgeAllAlerts(activeCriticalAlerts.map(a => a.id))}
                    className="text-[10px] font-black uppercase tracking-tighter kinetic-gradient px-4 py-1.5 rounded-lg transition-all active:scale-95 shadow-lg"
                  >
                    Acknowledge All
                  </button>
                </div>
              </div>
            </div>

            {/* Phase 2: FUEL SERVICES Header */}
            <header className="h-[var(--header-height)] bg-surface border-b border-outline flex items-center justify-between px-4 lg:px-8 transition-colors duration-300">
            <div className="flex items-center flex-1 transition-all">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden active:scale-95 transition-transform"
                  >
                    <Logo className="h-12 w-auto object-contain text-primary" />
                  </button>
                  <div className="hidden lg:block">
                    <h1 className="text-lg font-black tracking-tighter leading-none text-primary uppercase">FUEL SERVICES</h1>
                  </div>
                </div>

                {/* Global Search */}
                <div className="hidden lg:flex ml-10 items-center bg-surface-dim border border-outline rounded-[18px] px-5 py-2.5 w-96 max-w-xl group focus-within:border-primary transition-all relative z-[60]">
                  <Search className="w-4 h-4 text-on-surface-dim opacity-40 mr-3" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    placeholder="Search operations, assets, personnel..." 
                    className="bg-transparent border-none outline-none text-sm w-full font-bold placeholder:opacity-30 text-on-surface"
                  />
                  <div className="flex items-center space-x-2 ml-4">
                    <div className="dot-live"></div>
                    <span className="text-[9px] font-black opacity-30 uppercase whitespace-nowrap tracking-widest text-on-surface">Live</span>
                  </div>

                  {/* Search Dropdown */}
                  {isSearchFocused && searchQuery.trim().length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-lowest border border-outline rounded-xl transition-allow-hidden max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 z-[100]">
                      <div className="p-2 space-y-2">
                        {searchResults.jobs.length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[10px] font-black opacity-40 uppercase tracking-widest">Active Jobs</div>
                            {searchResults.jobs.slice(0, 3).map(j => (
                              <button key={j.id} className="w-full text-left px-3 py-2 hover:bg-surface-dim rounded-xl flex items-center group">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3 font-bold text-xs">{j.flightNumber.substring(0, 2)}</div>
                                <div>
                                  <div className="text-sm font-bold group-hover:text-primary transition-colors">{j.flightNumber}</div>
                                  <div className="text-[10px] opacity-60 font-medium">Aircraft {j.aircraftType} • Stand {j.stand}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.equipment.length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[10px] font-black opacity-40 uppercase tracking-widest">Equipment</div>
                            {searchResults.equipment.slice(0, 3).map(e => (
                              <button key={e.id} className="w-full text-left px-3 py-2 hover:bg-surface-dim rounded-xl flex items-center group">
                                <div className="w-8 h-8 rounded-full bg-warning/10 text-warning flex items-center justify-center mr-3 font-bold text-xs">{e.id.substring(0, 2)}</div>
                                <div>
                                  <div className="text-sm font-bold group-hover:text-warning transition-colors">{e.id}</div>
                                  <div className="text-[10px] opacity-60 font-medium uppercase">{e.type.replace('_', ' ')} • {e.status}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.personnel.length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[10px] font-black opacity-40 uppercase tracking-widest">Personnel</div>
                            {searchResults.personnel.slice(0, 3).map(p => (
                              <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-surface-dim rounded-xl flex items-center group">
                                <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full mr-3 border border-outline" />
                                <div>
                                  <div className="text-sm font-bold group-hover:text-primary transition-colors">{p.name}</div>
                                  <div className="text-[10px] opacity-60 font-medium uppercase">{p.role.replace('_', ' ')}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.jobs.length === 0 && searchResults.equipment.length === 0 && searchResults.personnel.length === 0 && (
                          <div className="p-6 text-center">
                            <Search className="w-6 h-6 mx-auto opacity-20 mb-2" />
                            <div className="text-sm font-bold opacity-60">No results found</div>
                            <div className="text-[10px] opacity-40 mt-1 uppercase tracking-widest">Try a different term</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-4 border-outline pl-6">

                  <div className="relative" ref={alertsRef}>
                    <button 
                      onClick={() => {
                        setShowAlertsPanel(!showAlertsPanel);
                        if (isSettingsOpen) setIsSettingsOpen(false);
                      }}
                      className={`relative p-3 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl transition-all active:scale-90 group ${showAlertsPanel ? 'text-primary border-primary/40' : 'text-on-surface-dim hover:text-primary'}`}
                    >
                      <Bell className={`w-5 h-5 ${unacknowledgedCount > 0 ? 'animate-bell text-primary' : ''}`} />
                      {unacknowledgedCount > 0 && (
                        <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-error text-white text-[8px] font-black rounded-full border-2 border-surface-dim flex items-center justify-center">
                          {unacknowledgedCount}
                        </span>
                      )}
                    </button>

                        {/* Alerts Dropdown Panel */}
                    {showAlertsPanel && (
                      <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setShowAlertsPanel(false)} />
                        <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-4 w-auto sm:w-96 max-h-[80vh] sm:max-h-[500px] bg-surface border border-outline rounded-xl z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                          {/* Panel Header */}
                          <div className="px-5 py-3 bg-surface-dim border-b border-outline flex items-center justify-between gap-3">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface flex items-center shrink-0">
                              <Bell className="w-3.5 h-3.5 mr-2 text-primary" />
                              Tactical Updates
                              {unacknowledgedCount > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 bg-error text-white text-[8px] font-black rounded-full">
                                  {unacknowledgedCount}
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center gap-1">
                              {/* Mark All Read */}
                              {unacknowledgedCount > 0 && (
                                <button
                                  onClick={async () => {
                                    const unreadIds = userAlerts.filter(a => !a.acknowledged).map(a => a.id);
                                    await acknowledgeAllAlerts(unreadIds);
                                    notify('All notifications marked as read.', 'success');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white text-[8px] font-black uppercase tracking-widest transition-all active:scale-95"
                                  title="Mark all as read"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="hidden sm:inline">Mark Read</span>
                                </button>
                              )}
                              {/* Clear All */}
                              {userAlerts.length > 0 && (
                                <button
                                  onClick={async () => {
                                    await clearAllAlerts();
                                    notify('All notifications cleared.', 'info');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error hover:text-white text-[8px] font-black uppercase tracking-widest transition-all active:scale-95"
                                  title="Clear all notifications"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span className="hidden sm:inline">Clear All</span>
                                </button>
                              )}
                              <button onClick={() => setShowAlertsPanel(false)} className="p-1.5 rounded-lg text-on-surface-dim hover:text-primary hover:bg-surface-container transition-colors ml-1">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                          {userAlerts.length === 0 ? (
                            <div className="p-12 text-center">
                              <CheckCircle className="w-10 h-10 text-success opacity-20 mx-auto mb-4" />
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 italic">All Systems Operational</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-outline">
                              {userAlerts.map(alert => (
                                <div 
                                  key={alert.id} 
                                  className={`p-5 hover:bg-surface-dim transition-colors group relative ${alert.acknowledged ? 'opacity-40 grayscale' : ''}`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${alert.severity === 'critical' ? 'bg-error' : alert.severity === 'medium' ? 'bg-warning' : 'bg-primary'}`}></div>
                                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{alert.severity}</span>
                                    </div>
                                    <span className="text-[9px] font-bold opacity-30">{alert.timestamp}</span>
                                  </div>
                                  <p className="text-[11px] font-bold text-on-surface leading-normal pr-8">{alert.message}</p>
                                  
                                  {!alert.acknowledged && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        acknowledgeAlert(alert.id);
                                      }}
                                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {userAlerts.length > 0 && (
                          <div className="p-3 bg-surface-dim/40 border-t border-outline">
                             <p className="text-[8px] font-bold text-center text-on-surface-dim uppercase tracking-[0.2em] opacity-40 italic">Hover items to acknowledge individually</p>
                          </div>
                        )}
                      </div>
                      </>
                    )}
                  </div>

                  <div className="relative" ref={settingsRef}>
                    <div 
                      onClick={() => {
                        setIsSettingsOpen(!isSettingsOpen);
                        if (showAlertsPanel) setShowAlertsPanel(false);
                      }}
                      className={`flex items-center space-x-4 bg-surface-dim p-1.5 pr-5 rounded-xl border transition-all cursor-pointer active:scale-95 group ${isSettingsOpen ? 'border-primary' : 'border-outline hover:border-primary'}`}
                    >
                      <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-lg border border-surface-container" />
                      <div className="hidden xl:block">
                        <p className="text-[11px] font-black text-on-surface leading-tight tracking-tight uppercase">{currentUser.name}</p>
                        <p className="text-[9px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest">{currentUser.role.replace('_', ' ')}</p>
                      </div>
                    </div>

                    {/* System Settings Dropdown Panel */}
                    {isSettingsOpen && (
                      <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setIsSettingsOpen(false)} />
                        <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-4 w-auto sm:w-96 max-h-[85vh] sm:max-h-[600px] bg-surface border border-outline rounded-xl z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                          <div className="px-5 py-4 bg-surface-dim border-b border-outline flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface flex items-center">
                              <UserIcon className="w-3.5 h-3.5 mr-2 text-primary" />
                              System Settings
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-on-surface-dim hover:text-primary transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                            {/* Appearance Section */}
                            <div className="p-4 bg-surface-dim/40 rounded-[32px] font-[900] text-sm uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 disabled:scale-100 disabled:grayscale flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2.5 rounded-lg transition-all ${isDarkMode ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black text-on-surface uppercase tracking-tight">Appearance</h4>
                                    <p className="text-[9px] font-bold text-on-surface-dim opacity-50">Toggle dark mode</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => setIsDarkMode(!isDarkMode)}
                                  className={`relative w-12 h-6 rounded-full transition-all duration-500 overflow-hidden group-active:scale-90 border border-outline/50 ${isDarkMode ? 'kinetic-gradient' : 'bg-surface-container-high'}`}
                                >
                                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-all duration-500 shadow-lg ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Install status indicator (read-only, no install button) */}
                            {isInstalled && (
                              <div className="p-3 bg-success/5 rounded-2xl flex items-center space-x-3 border border-success/20">
                                <div className="p-2 rounded-lg bg-success/10 text-success">
                                  <CheckCircle className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-[11px] font-black text-on-surface uppercase tracking-tight">Installed</h4>
                                  <p className="text-[9px] font-bold text-success opacity-70">Running as native app</p>
                                </div>
                              </div>
                            )}

                            {/* User Profile Summary */}
                            <div className="pt-5 border-t border-outline">
                              <div className="flex items-center space-x-3">
                                <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-xl border border-primary/20 shadow-md" />
                                <div>
                                  <p className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-0.5">Authenticated User</p>
                                  <h4 className="text-xs font-[900] text-on-surface tracking-tight uppercase leading-none">{currentUser.name}</h4>
                                  <p className="text-[9px] font-bold text-primary opacity-80 mt-1 uppercase tracking-tighter">{currentUser.role.replace('_', ' ')}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-surface-dim/40 border-t border-outline">
                             <button 
                              onClick={() => {
                                setIsSettingsOpen(false);
                                handleLogout();
                              }}
                              className="w-full py-2.5 bg-surface-container border border-outline text-on-surface hover:text-error hover:border-error/30 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all"
                             >
                               Secure Logout
                             </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </header>
            </div>

            <div key={activeView} className="animate-in fade-in duration-300 ease-out">
              {renderContent()}
            </div>
          </main>
        </div>
        
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Bottom Navigation */}
        <BottomNav 
          user={currentUser} 
          activeView={activeView} 
          setActiveView={setActiveView}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          isVisible={showHeader}
        />

        {/* Install toast is now handled by NotificationContext.notifyWithAction() */}

        {/* iOS PWA Install Guide Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface border border-outline rounded-[32px] p-6 w-full max-w-sm shadow-premium flex flex-col items-center text-center animate-in slide-in-from-bottom-2 duration-400">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Install on iOS Safari</h3>
              <p className="text-[10px] font-bold text-on-surface-dim opacity-60 mt-2 leading-relaxed">
                Follow these simple steps to install the FMS App on your iPhone or iPad:
              </p>
              
              <div className="w-full space-y-4 my-6 text-left border-t border-b border-outline/40 py-5">
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">1</div>
                  <p className="flex-1">Tap the Safari <strong className="text-primary uppercase tracking-wider">Share</strong> button <Share2 className="w-3.5 h-3.5 inline ml-1 text-primary" /> in the toolbar.</p>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">2</div>
                  <p className="flex-1">Scroll down the share list and tap <strong className="text-primary uppercase tracking-wider">Add to Home Screen</strong>.</p>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">3</div>
                  <p className="flex-1">Tap <strong className="text-primary uppercase tracking-wider">Add</strong> in the top-right corner.</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 kinetic-gradient text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg active:scale-95 transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        )}

      </div>
  );
};

export default App;
