
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
import { AIChatModal } from './components/AIChatModal';
import { User, UserRole, FlightJob, Alert, EquipmentStatus as EqStatusEnum } from './types';
import { Wifi, WifiOff, PanelLeft, X, Loader2, Search, Bell, User as UserIcon, AlertCircle, Sun, Moon, Eclipse, CheckCircle, Share2, Smartphone, Trash2, Download, Laptop, Globe, RefreshCw, Users, ArrowRight, Sparkles } from 'lucide-react';
import { updatePWAManifestAndTheme, requestNotificationPermission, sendNativeNotification } from './utils/pwa';
import { haptic, isHapticEnabled, setHapticEnabled, isReducedMotion, setReducedMotion } from './utils/haptics';
import { syncEngine } from './services/syncEngine';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fms_logged_in_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeView, setActiveView] = useState(() => {
    const savedUser = localStorage.getItem('fms_logged_in_user');
    if (savedUser) {
      const user = JSON.parse(savedUser) as User;
      const savedView = localStorage.getItem('fms_active_view');
      // Role-specific defaults take priority over stale saved views
      if (user.role === UserRole.CUSTOMER) return savedView && savedView !== 'dashboard' ? savedView : 'customer-portal';
      if (user.role === UserRole.FINANCE) return savedView && savedView !== 'dashboard' ? savedView : 'finance';
      if (user.role === UserRole.COMMERCIAL) return savedView && savedView !== 'dashboard' ? savedView : 'commercial-reports';
      if (savedView) return savedView;
    }
    return 'dashboard';
  });
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'black'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'black' | null;
    if (saved === 'light' || saved === 'dark' || saved === 'black') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [showHeader, setShowHeader] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar-collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const scrollRef = React.useRef<HTMLElement>(null);
  const [pendingJob, setPendingJob] = useState<FlightJob | null>(null);
  const [pendingVehicleId, setPendingVehicleId] = useState<string | null>(null);

  // Sync activeView to localStorage
  useEffect(() => {
    localStorage.setItem('fms_active_view', activeView);
  }, [activeView]);

  // Theme management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updatePWAManifestAndTheme(theme);
  }, [theme]);
  
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

  // Network listener with haptic feedback
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      haptic('SUCCESS');
    };
    const handleOffline = () => {
      setIsOnline(false);
      haptic('WARNING');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fms_logged_in_user');
    localStorage.removeItem('fms_active_view');
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('fms_logged_in_user', JSON.stringify(user));
    setCurrentUser(user);
    let defaultView = 'dashboard';
    if (user.role === UserRole.CUSTOMER) {
      defaultView = 'customer-portal';
    } else if (user.role === UserRole.FINANCE) {
      defaultView = 'finance';
    } else if (user.role === UserRole.COMMERCIAL) {
      defaultView = 'commercial-reports';
    }
    localStorage.setItem('fms_active_view', defaultView);
    setActiveView(defaultView);
  };

  // Wrap everything in ONE NotificationProvider so both Login and App can use toasts
  return (
    <NotificationProvider>
      <FinanceDataProvider user={currentUser}>
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
              theme={theme}
              setTheme={setTheme}
              showHeader={showHeader}
              setShowHeader={setShowHeader}
              scrollRef={scrollRef}
              pendingJob={pendingJob}
              setPendingJob={setPendingJob}
              pendingVehicleId={pendingVehicleId}
              setPendingVehicleId={setPendingVehicleId}
              showAlertsPanel={showAlertsPanel}
              setShowAlertsPanel={setShowAlertsPanel}
              isSettingsOpen={isSettingsOpen}
              setIsSettingsOpen={setIsSettingsOpen}
              handleLogout={handleLogout}
              isSidebarCollapsed={isSidebarCollapsed}
              toggleSidebarCollapse={toggleSidebarCollapse}
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
  theme, setTheme, showHeader, setShowHeader, scrollRef, pendingJob, setPendingJob,
  pendingVehicleId, setPendingVehicleId,
  showAlertsPanel, setShowAlertsPanel, isSettingsOpen, setIsSettingsOpen, handleLogout,
  isSidebarCollapsed, toggleSidebarCollapse
}) => {
  const { alerts, acknowledgeAlert, acknowledgeAllAlerts, clearAllAlerts, equipment, flightJobs, refreshData, domesticFlights, domesticAssignments, updateEquipmentStatus, updateFlightJob } = useOperationalData();
  const { notify, notifyWithAction, dismiss, clear } = useNotification();

  // Wrapped logout: release any IN_USE equipment and revert IN_PROGRESS jobs for this user before signing out
  const wrappedLogout = () => {
    // Revert any IN_PROGRESS flight jobs assigned to this user and release their associated equipment
    if (flightJobs && currentUser) {
      flightJobs.forEach((job: FlightJob) => {
        if (job.status === 'IN_PROGRESS' && (job.assignedTo === currentUser.id || job.assignedOfficer === currentUser.id)) {
          updateFlightJob(job.id, { status: 'PENDING', vehicleId: undefined });
          if (job.vehicleId) {
            updateEquipmentStatus(job.vehicleId, EqStatusEnum.AVAILABLE);
          }
        }
      });
    }
    clear();
    handleLogout();
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [aiInitialQuery, setAiInitialQuery] = useState('');
  const [isHeaderLogoSpinning, setIsHeaderLogoSpinning] = useState(false);
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);

  const [syncState, setSyncState] = useState(() => syncEngine.getStatus());

  useEffect(() => {
    return syncEngine.subscribe(status => setSyncState(status));
  }, []);

  // --- View History Stack for smart back-button navigation ---
  const viewHistoryRef = React.useRef<string[]>([activeView]);
  const isNavigatingBackRef = React.useRef(false);

  // --- Keyboard-aware layout ---
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // --- Haptic & Motion preferences (reactive state for settings UI) ---
  const [hapticEnabled, setHapticEnabledState] = useState(isHapticEnabled());
  const [reducedMotionEnabled, setReducedMotionState] = useState(isReducedMotion());

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

  const wasMobileMenuOpenRef = React.useRef(isMobileMenuOpen);
  useEffect(() => {
    if (!isMobileMenuOpen && wasMobileMenuOpenRef.current) {
      setIsHeaderLogoSpinning(true);
      const timer = setTimeout(() => setIsHeaderLogoSpinning(false), 1800);
      return () => clearTimeout(timer);
    }
    wasMobileMenuOpenRef.current = isMobileMenuOpen;
  }, [isMobileMenuOpen]);

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

      // Executive doesn't receive replenishing notifications
      if (currentUser.role === UserRole.EXECUTIVE && (a.message || '').toLowerCase().includes('replenish')) {
        return false;
      }

      // Targeted request/no-fuel alerts: only visible to assigned operator/officer, or supervisors
      const msgLower = (a.message || '').toLowerCase();
      const isRequestAlert = msgLower.includes('alert requested') || msgLower.includes('no fuel');
      if (isRequestAlert && ![UserRole.ADMIN, UserRole.ITP_MANAGER].includes(currentUser.role)) {
        const isDomestic = (domesticFlights || []).some(df => msgLower.includes((df.flightNumber || '').toLowerCase()));
        if (isDomestic) {
          const isUserInDomesticTeam = (domesticAssignments || []).some(da => da.op1 === currentUser.id || da.op2 === currentUser.id);
          if (!isUserInDomesticTeam) return false;
        } else {
          const hasOperator = msgLower.includes('(operator:');
          const hasOfficer = msgLower.includes('(officer:');
          const hasName = msgLower.includes(currentUser.name.toLowerCase());
          if ((hasOperator || hasOfficer) && !hasName) return false;
        }
      }

      if ([UserRole.ADMIN, UserRole.EXECUTIVE].includes(currentUser.role)) return true;
      if (a.targetRole === currentUser.role) return true;
      if ([UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(currentUser.role) && 
          a.targetRole && [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(a.targetRole as UserRole)) return true;
      if ([UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER, UserRole.ITP_SUPERVISOR].includes(currentUser.role) && 
          a.targetRole && [UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER, UserRole.ITP_SUPERVISOR].includes(a.targetRole as UserRole)) return true;
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

  // --- PWA Install & Environment States ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showMacGuide, setShowMacGuide] = useState(false);
  const [showOtherGuide, setShowOtherGuide] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const installToastIdRef = React.useRef<string | null>(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isMac = /Macintosh/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMacSafari = isMac && isSafari;

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      notify('Native notifications enabled successfully!', 'success');
      sendNativeNotification('FMS Notifications', 'You will now receive native alerts on this device.');
    } else if (perm === 'denied') {
      notify('Notification permission was denied. Please check your browser settings.', 'warning');
    }
  };

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

      const needsGuide = isIOS || isMacSafari || !deferredPrompt;
      const toastId = notifyWithAction(
        'Install FMS on your home screen for offline access and native performance.',
        'info',
        {
          label: needsGuide ? 'Show Guide' : 'Install Now',
          onClick: () => handleInstallApp()
        },
        8000 // auto hide after 8 seconds
      );
      installToastIdRef.current = toastId;
    }, 4000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredPrompt, isIOS, isMacSafari]);

  const handleInstallApp = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      if (installToastIdRef.current) {
        dismiss(installToastIdRef.current);
        installToastIdRef.current = null;
      }
      return;
    }
    if (isMacSafari) {
      setShowMacGuide(true);
      if (installToastIdRef.current) {
        dismiss(installToastIdRef.current);
        installToastIdRef.current = null;
      }
      return;
    }
    if (deferredPrompt) {
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
    } else {
      setShowOtherGuide(true);
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

  // Stable state ref to avoid re-binding touch listeners on every touchmove step
  const pullStateRef = React.useRef({ pullDistance, isRefreshing, refreshData });
  useEffect(() => {
    pullStateRef.current = { pullDistance, isRefreshing, refreshData };
  }, [pullDistance, isRefreshing, refreshData]);

  // Calculate dynamic blur amount based on pull distance (max 8px)
  const blurAmount = (pullDistance > 0 || isRefreshing)
    ? Math.min(8, (pullDistance / 60) * 8)
    : 0;

  useEffect(() => {
    const mainEl = mainElement;
    if (!mainEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (mainEl.scrollTop <= 5 && !pullStateRef.current.isRefreshing) {
        startYRef.current = e.touches[0].pageY;
        pullingRef.current = true;
      } else {
        pullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || pullStateRef.current.isRefreshing) return;
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

    const handleTouchEnd = () => {
      if (!pullingRef.current || pullStateRef.current.isRefreshing) return;
      pullingRef.current = false;

      const currentPull = pullStateRef.current.pullDistance;

      if (currentPull >= 60) {
        haptic('PULL_REFRESH');
        setIsRefreshing(true);
        setPullDistance(60);
        // Wait 800ms to allow the spinner animation to play, then trigger a page reload
        // to cleanly refresh and reset all React contexts and states
        setTimeout(() => {
          window.location.reload();
        }, 800);
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
  }, [mainElement]);

  // --- Mobile Back Button Gesture Navigation Support (Stack-Based) ---
  // Track view changes in the history stack
  useEffect(() => {
    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }
    const stack = viewHistoryRef.current;
    // Prevent duplicate consecutive entries
    if (stack[stack.length - 1] !== activeView) {
      stack.push(activeView);
      // Cap stack at 20 entries
      if (stack.length > 20) {
        viewHistoryRef.current = stack.slice(-20);
      }
    }
  }, [activeView]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      haptic('TAP');

      // Priority 1: Close any open overlays/modals first
      if (isAIChatOpen) {
        setIsAIChatOpen(false);
        window.history.pushState({ fmsActive: true }, '');
        return;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        window.history.pushState({ fmsActive: true }, '');
        return;
      }
      if (showAlertsPanel) {
        setShowAlertsPanel(false);
        window.history.pushState({ fmsActive: true }, '');
        return;
      }
      if (showIOSGuide || showMacGuide || showOtherGuide) {
        setShowIOSGuide(false);
        setShowMacGuide(false);
        setShowOtherGuide(false);
        window.history.pushState({ fmsActive: true }, '');
        return;
      }

      // Priority 2: Close mobile sidebar drawer
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        window.history.pushState({ fmsActive: true }, '');
        return;
      }

      // Priority 3: Navigate back through view history stack
      const stack = viewHistoryRef.current;
      if (stack.length > 1) {
        stack.pop(); // Remove current view
        const previousView = stack[stack.length - 1];
        isNavigatingBackRef.current = true;
        setActiveView(previousView);
        // Keep the history entry alive if we're not at root
        if (stack.length > 1) {
          window.history.pushState({ fmsActive: true }, '');
        }
        return;
      }

      // Priority 4: At root view — let the browser/PWA handle exit
      // Don't prevent default behavior — this allows the app to minimize/exit
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobileMenuOpen, showAlertsPanel, isSettingsOpen, showIOSGuide, showMacGuide, showOtherGuide, isAIChatOpen, setIsMobileMenuOpen, setShowAlertsPanel, setIsSettingsOpen, setShowIOSGuide, setActiveView]);

  // Push initial history state so back button works
  useEffect(() => {
    if (!window.history.state?.fmsActive) {
      window.history.pushState({ fmsActive: true }, '');
    }
  }, []);

  // Track overlay state changes — push history when opening overlays
  useEffect(() => {
    const hasOverlay = isMobileMenuOpen || showAlertsPanel || isSettingsOpen || showIOSGuide || isAIChatOpen;
    if (hasOverlay && !window.history.state?.fmsOverlay) {
      window.history.pushState({ fmsActive: true, fmsOverlay: true }, '');
    }
  }, [isMobileMenuOpen, showAlertsPanel, isSettingsOpen, showIOSGuide, isAIChatOpen]);

  // Clean up history state on session unmount / logout
  useEffect(() => {
    return () => {
      if (window.history.state?.fmsActive) {
        window.history.back();
      }
    };
  }, []);

  // --- Keyboard-Aware Layout Detection ---
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // If the visual viewport height is significantly less than the window height,
      // the virtual keyboard is likely open
      const heightDiff = window.innerHeight - viewport.height;
      const keyboardOpen = heightDiff > 150; // 150px threshold
      setIsKeyboardVisible(keyboardOpen);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

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

    // Executive doesn't receive replenishing notifications
    if (currentUser.role === UserRole.EXECUTIVE && (a.message || '').toLowerCase().includes('replenish')) {
      return false;
    }

    // Targeted request/no-fuel alerts: only visible to assigned operator/officer, or supervisors
    const msgLower = (a.message || '').toLowerCase();
    const isRequestAlert = msgLower.includes('alert requested') || msgLower.includes('no fuel');
    if (isRequestAlert && ![UserRole.ADMIN, UserRole.ITP_MANAGER, UserRole.FUEL_MANAGEMENT].includes(currentUser.role)) {
      const isDomestic = (domesticFlights || []).some(df => msgLower.includes((df.flightNumber || '').toLowerCase()));
      if (isDomestic) {
        const isUserInDomesticTeam = (domesticAssignments || []).some(da => da.op1 === currentUser.id || da.op2 === currentUser.id);
        if (!isUserInDomesticTeam) return false;
      } else {
        const hasOperator = msgLower.includes('(operator:');
        const hasOfficer = msgLower.includes('(officer:');
        const hasName = msgLower.includes(currentUser.name.toLowerCase());
        if ((hasOperator || hasOfficer) && !hasName) return false;
      }
    }

    if ([UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.FUEL_MANAGEMENT].includes(currentUser.role)) return true;
    if (a.targetRole === currentUser.role) return true;
    // Depot role group: both DEPOT_MANAGER and DEPOT_OPERATOR see depot-targeted alerts
    if ([UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(currentUser.role) && 
        a.targetRole && [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(a.targetRole as UserRole)) return true;
     // ITP role group: ITP_MANAGER, ITP_OPERATOR, ITP_HD_OPERATOR, ITP_SUPERVISOR, and ITP_OFFICER see each other's alerts
    if ([UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER, UserRole.ITP_SUPERVISOR].includes(currentUser.role) && 
        a.targetRole && [UserRole.ITP_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER, UserRole.ITP_SUPERVISOR].includes(a.targetRole as UserRole)) return true;
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
            onStartJob={(job: FlightJob, vehicleId?: string) => {
              setPendingJob(job);
              if (vehicleId) {
                setPendingVehicleId(vehicleId);
              }
              setActiveView('intoplane');
            }}
            onSelectEquipment={(eqId: string) => {
              setPendingVehicleId(eqId);
              setActiveView('intoplane');
            }}
          />
        );
      case 'intoplane':
        return (
          <IntoPlane 
            user={currentUser} 
            initialJob={pendingJob}
            initialVehicleId={pendingVehicleId}
            onClearInitialJob={() => setPendingJob(null)}
            onClearInitialVehicleId={() => setPendingVehicleId(null)}
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
        return <Bridging user={currentUser} setActiveView={setActiveView} />;
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
        return <Schedule user={currentUser} />;
      case 'briefing':
        return <ShiftBriefing user={currentUser} isSidebarCollapsed={isSidebarCollapsed} />;
      case 'admin':
        return currentUser.role === UserRole.ADMIN ? <SystemAdmin currentUser={currentUser} /> : <Dashboard user={currentUser} setActiveView={setActiveView} onStartJob={() => {}} onSelectEquipment={(eqId: string) => { setPendingVehicleId(eqId); setActiveView('intoplane'); }} />;
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
        if (currentUser?.role && [UserRole.DEPOT_OPERATOR, UserRole.DEPOT_MANAGER, UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_SUPERVISOR, UserRole.ITP_MANAGER, UserRole.ITP_OFFICER].includes(currentUser?.role)) {
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
        if (currentUser?.role && ![UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.FUEL_MANAGEMENT].includes(currentUser.role)) {
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
        <Sidebar 
          user={currentUser} 
          activeView={activeView} 
          setActiveView={(view: string) => {
            setActiveView(view);
            setIsMobileMenuOpen(false);
          }}
          onLogout={wrappedLogout}
          isMobileMenuOpen={isMobileMenuOpen}
          onSettingsClick={() => {
            if (currentUser?.role === UserRole.ADMIN) {
              setActiveView('admin');
            } else {
              setIsSettingsOpen(true);
            }
            setIsMobileMenuOpen(false);
          }}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={toggleSidebarCollapse}
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
            <div 
              className={`transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] sticky top-0 z-50 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}
              style={{
                filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
                transition: pullingRef.current 
                  ? 'transform 0.5s ease' 
                  : 'transform 0.5s ease, filter 0.3s ease'
              }}
            >
            {/* Phase 0: Offline Status Banner (Only expands when truly offline to prevent layout shift) */}
            <div className={`transition-all duration-300 overflow-hidden text-xs font-bold ${!syncState.isOnline ? 'h-8 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
              <div className="h-8 flex items-center justify-between px-6 bg-amber-600 text-white">
                <div className="flex items-center space-x-2">
                  <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Offline Mode — {syncState.pendingCount} pending local mutation(s) saved to IndexedDB
                  </span>
                </div>
              </div>
            </div>

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
                    onClick={() => {
                      setIsMobileMenuOpen(true);
                    }}
                    className="lg:hidden active:scale-95 transition-transform group"
                  >
                    <Logo className={`h-12 w-auto object-contain text-primary ${isHeaderLogoSpinning ? 'logo-animate' : ''}`} />
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
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-lowest border border-outline rounded-2xl transition-allow-hidden max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 z-[100] shadow-premium">
                      <div className="p-2 space-y-2">
                        {/* Generative AI Quick Action */}
                        <button
                          onClick={() => {
                            setAiInitialQuery(searchQuery);
                            setIsAIChatOpen(true);
                          }}
                          className="w-full text-left p-3 bg-primary/10 hover:bg-primary hover:text-white border border-primary/30 rounded-xl flex items-center justify-between text-primary transition-all group"
                        >
                          <div className="flex items-center space-x-2.5">
                            <Sparkles className="w-4 h-4 text-primary animate-pulse group-hover:text-white" />
                            <span className="text-xs font-black">Ask Generative AI: "{searchQuery}"</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
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

              <div className="flex items-center space-x-2 sm:space-x-6">
                <div className="flex items-center space-x-2 sm:space-x-4 border-outline pl-2 sm:pl-6">

                  {/* Mobile ASK AI Assistant Button (Icon Only - Sized Same as Alert Button) */}
                  <button
                    onClick={() => setIsAIChatOpen(true)}
                    className={`lg:hidden relative p-3 kinetic-gradient rounded-xl border border-white/20 transition-all active:scale-90 group shadow-sm flex items-center justify-center ${
                      theme === 'black' ? 'text-black' : 'text-white'
                    }`}
                    title="Open FMS Generative AI Assistant"
                  >
                    <div className="relative flex items-center justify-center">
                      <Sparkles className={`w-5 h-5 ${theme === 'black' ? 'text-black' : 'text-white'} animate-[pulse_4s_cubic-bezier(0.4,0,0.6,1)_infinite]`} />
                      <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${theme === 'black' ? 'bg-black' : 'bg-white'} animate-[ping_3.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50`}></span>
                    </div>
                  </button>

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
                                  className="flex items-center justify-center p-2 rounded-lg kinetic-gradient text-white transition-all active:scale-95 shadow-sm hover:opacity-90"
                                  title="Mark all as read"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* Clear All */}
                              {userAlerts.length > 0 && (
                                <button
                                  onClick={async () => {
                                    await clearAllAlerts();
                                    notify('All notifications cleared.', 'info');
                                  }}
                                  className="flex items-center justify-center p-2 rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all active:scale-95"
                                  title="Clear all notifications"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                                  
                                  {(() => {
                                    const isReplenishRequest = alert.message.toLowerCase().includes('request') && (
                                      alert.message.toLowerCase().includes('replenish') || 
                                      alert.message.toLowerCase().includes('refuel')
                                    );
                                    const canInitiate = isReplenishRequest && [UserRole.DEPOT_OPERATOR, UserRole.DEPOT_MANAGER, UserRole.ADMIN].includes(currentUser?.role);
                                    if (canInitiate) {
                                      const match = alert.message.match(/unit\s+(RF-\d+)/i);
                                      const vehicleId = match ? match[1].toUpperCase() : null;
                                      if (vehicleId) {
                                        return (
                                          <button
                                            onClick={() => {
                                              localStorage.setItem('fms_initiate_loading_vehicle', vehicleId);
                                              setActiveView('bridging');
                                              setShowAlertsPanel(false);
                                              notify(`Redirecting to Refueler Loading for unit ${vehicleId}`, 'success');
                                            }}
                                            className="mt-2.5 px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:scale-105 active:scale-95 shadow-sm block w-fit kinetic-gradient"
                                          >
                                            Initiate Loading
                                          </button>
                                        );
                                      }
                                    }
                                    return null;
                                  })()}

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
                            <div className="p-4 bg-surface-dim/40 rounded-[32px] transition-all flex flex-col space-y-3">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2.5 rounded-lg transition-all ${theme === 'light' ? 'bg-warning/10 text-warning' : theme === 'black' ? 'bg-primary/10 text-on-surface' : 'bg-primary/10 text-primary'}`}>
                                  {theme === 'light' && <Sun className="w-4 h-4" />}
                                  {theme === 'dark' && <Moon className="w-4 h-4" />}
                                  {theme === 'black' && <Eclipse className="w-4 h-4" />}
                                </div>
                                <div>
                                  <h4 className="text-[11px] font-black text-on-surface uppercase tracking-tight">Appearance</h4>
                                  <p className="text-[9px] font-bold text-on-surface-dim opacity-50">Select application theme</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-1 rounded-2xl border border-outline">
                                <button
                                  onClick={() => setTheme('light')}
                                  className={`py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${theme === 'light' ? 'bg-surface-container-lowest text-on-surface shadow-sm border border-outline' : 'text-on-surface-dim hover:text-on-surface'}`}
                                >
                                  <Sun className="w-3.5 h-3.5" />
                                  <span>Light</span>
                                </button>
                                <button
                                  onClick={() => setTheme('dark')}
                                  className={`py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${theme === 'dark' ? 'bg-surface-container-lowest text-on-surface shadow-sm border border-outline' : 'text-on-surface-dim hover:text-on-surface'}`}
                                >
                                  <Moon className="w-3.5 h-3.5" />
                                  <span>Dark</span>
                                </button>
                                <button
                                  onClick={() => setTheme('black')}
                                  className={`py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 ${theme === 'black' ? 'bg-surface-container-lowest text-on-surface shadow-sm border border-outline' : 'text-on-surface-dim hover:text-on-surface'}`}
                                >
                                  <Eclipse className="w-3.5 h-3.5" />
                                  <span>Black</span>
                                </button>
                              </div>
                            </div>

                            {/* Native Notifications Section */}
                            <div className="p-4 bg-surface-dim/40 rounded-[32px] flex items-center justify-between hover:scale-[1.02] transition-all duration-300">
                                <div className="flex items-center space-x-3 text-left">
                                  <div className={`p-2.5 rounded-lg transition-all ${notificationPermission === 'granted' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                                    <Bell className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black text-on-surface uppercase tracking-tight">Notifications</h4>
                                    <p className="text-[9px] font-bold text-on-surface-dim opacity-50">
                                      {notificationPermission === 'granted' ? 'Enabled for updates' : notificationPermission === 'denied' ? 'Permission denied' : 'Enable device alerts'}
                                    </p>
                                  </div>
                                </div>
                                {notificationPermission !== 'granted' ? (
                                  <button
                                    onClick={handleEnableNotifications}
                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary hover:border-primary border border-outline text-[9px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                                  >
                                    Enable
                                  </button>
                                ) : (
                                  <div className="text-[10px] font-black uppercase text-success tracking-wide flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Active
                                  </div>
                                )}
                            </div>

                            {/* Haptic Feedback Toggle */}
                            <div className="p-4 bg-surface-dim/40 rounded-[32px] flex items-center justify-between hover:scale-[1.02] transition-all duration-300">
                                <div className="flex items-center space-x-3 text-left">
                                  <div className={`p-2.5 rounded-lg transition-all ${hapticEnabled ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                                    <Smartphone className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black text-on-surface uppercase tracking-tight">Haptic Feedback</h4>
                                    <p className="text-[9px] font-bold text-on-surface-dim opacity-50">
                                      {hapticEnabled ? 'Vibration active' : 'Vibration disabled'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const next = !hapticEnabled;
                                    setHapticEnabledState(next);
                                    setHapticEnabled(next);
                                    if (next) haptic('TAP');
                                  }}
                                  className={`relative w-11 h-6 rounded-full transition-all duration-300 ${hapticEnabled ? 'bg-success' : 'bg-outline/40'}`}
                                >
                                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${hapticEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                                </button>
                            </div>

                            {/* Reduced Motion Toggle */}
                            <div className="p-4 bg-surface-dim/40 rounded-[32px] flex items-center justify-between hover:scale-[1.02] transition-all duration-300">
                                <div className="flex items-center space-x-3 text-left">
                                  <div className={`p-2.5 rounded-lg transition-all bg-primary/10 text-primary`}>
                                    <RefreshCw className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black text-on-surface uppercase tracking-tight">Reduced Motion</h4>
                                    <p className="text-[9px] font-bold text-on-surface-dim opacity-50">
                                      {reducedMotionEnabled ? 'Animations minimized' : 'Full animations'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const next = !reducedMotionEnabled;
                                    setReducedMotionState(next);
                                    setReducedMotion(next);
                                    haptic('TOGGLE');
                                  }}
                                  className={`relative w-11 h-6 rounded-full transition-all duration-300 ${reducedMotionEnabled ? 'bg-success' : 'bg-outline/40'}`}
                                >
                                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${reducedMotionEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                                </button>
                            </div>

                            {/* Install FMS button if not installed */}
                            {!isInstalled && (
                              <button
                                onClick={handleInstallApp}
                                className="w-full p-4 bg-primary/10 hover:bg-primary/20 text-primary border border-outline hover:border-primary rounded-[32px] flex items-center justify-between transition-all active:scale-[0.98] group"
                              >
                                <div className="flex items-center space-x-3 text-left">
                                  <div className="p-2.5 rounded-lg bg-primary/20 text-primary">
                                    <Download className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black uppercase tracking-tight">Install FMS App</h4>
                                    <p className="text-[9px] font-bold text-on-surface-dim opacity-60">Add to your home screen or desktop</p>
                                  </div>
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-primary opacity-80 group-hover:translate-x-0.5 transition-transform">
                                Install &rarr;
                                </div>
                              </button>
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
                                wrappedLogout();
                              }}
                              className="w-full py-2.5 bg-surface-container border border-outline text-on-surface hover:text-error hover:border-error text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all"
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

            <div 
              key={activeView} 
              className="animate-in fade-in duration-300 ease-out"
              style={{
                filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
                transition: pullingRef.current ? 'none' : 'filter 0.3s ease'
              }}
            >
              {renderContent()}
            </div>
          </main>

          {/* Bottom Navigation */}
          <BottomNav 
            user={currentUser!} 
            activeView={activeView} 
            setActiveView={setActiveView}
            onMenuClick={() => setIsMobileMenuOpen(true)}
            isVisible={showHeader && !isKeyboardVisible}
            onSettingsClick={() => {
              if (currentUser?.role === UserRole.ADMIN) {
                setActiveView('admin');
              } else {
                setIsSettingsOpen(true);
              }
            }}
            onLogout={wrappedLogout}
            theme={theme}
            onThemeToggle={() => setTheme(prev => prev === 'light' ? 'dark' : prev === 'dark' ? 'black' : 'light')}
          />
        </div>
        
        {/* Mobile Overlay */}
        <div 
          className={`fixed inset-0 bg-primary/40 backdrop-blur-sm z-50 lg:hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isMobileMenuOpen 
              ? 'opacity-100 pointer-events-auto' 
              : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
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

        {/* macOS PWA Install Guide Modal */}
        {showMacGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface border border-outline rounded-[32px] p-6 w-full max-w-sm shadow-premium flex flex-col items-center text-center animate-in slide-in-from-bottom-2 duration-400">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                <Laptop className="w-6 h-6" />
              </div>
              
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Install on macOS Safari</h3>
              <p className="text-[10px] font-bold text-on-surface-dim opacity-60 mt-2 leading-relaxed">
                Add FMS to your Dock to use it as a standalone app:
              </p>
              
              <div className="w-full space-y-4 my-6 text-left border-t border-b border-outline/40 py-5">
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">1</div>
                  <p className="flex-1">Open the <strong className="text-primary uppercase tracking-wider">File</strong> menu in Safari's top menu bar.</p>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">2</div>
                  <p className="flex-1">Click <strong className="text-primary uppercase tracking-wider">Add to Dock...</strong></p>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">3</div>
                  <p className="flex-1">Confirm by clicking <strong className="text-primary uppercase tracking-wider">Add</strong> in the dialog.</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowMacGuide(false)}
                className="w-full py-3 kinetic-gradient text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg active:scale-95 transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {/* General Browser PWA Install Guide Modal */}
        {showOtherGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface border border-outline rounded-[32px] p-6 w-full max-w-sm shadow-premium flex flex-col items-center text-center animate-in slide-in-from-bottom-2 duration-400">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                <Globe className="w-6 h-6" />
              </div>
              
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Install FMS App</h3>
              <p className="text-[10px] font-bold text-on-surface-dim opacity-60 mt-2 leading-relaxed">
                Add FMS to your desktop or home screen manually:
              </p>
              
              <div className="w-full space-y-4 my-6 text-left border-t border-b border-outline/40 py-5">
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">1</div>
                  <p className="flex-1">Look at your browser's <strong className="text-primary uppercase tracking-wider">Address Bar</strong> (top right).</p>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">2</div>
                  <p className="flex-1">Click the <strong className="text-primary uppercase tracking-wider">Install icon</strong> (a monitor icon with an arrow, or a '+' symbol).</p>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface-dim">
                  <div className="w-6 h-6 rounded-full bg-surface-dim flex items-center justify-center text-[9px] font-black text-primary border border-outline">3</div>
                  <p className="flex-1">Alternatively, open the browser menu and select <strong className="text-primary uppercase tracking-wider">Save and Share &gt; Install page as app</strong>.</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowOtherGuide(false)}
                className="w-full py-3 kinetic-gradient text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg active:scale-95 transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {/* Floating ASK AI Assistant Button (Desktop Only - Theme Adaptive) */}
        <button
          onClick={() => setIsAIChatOpen(true)}
          className={`hidden lg:flex fixed bottom-6 right-6 z-[120] items-center space-x-2.5 px-4 py-3 kinetic-gradient rounded-full shadow-premium border border-white/20 hover:scale-105 active:scale-95 transition-all duration-200 group ${
            theme === 'black' ? 'text-black' : 'text-white'
          }`}
          title="Open FMS Generative AI Assistant"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className={`w-5 h-5 ${theme === 'black' ? 'text-black' : 'text-white'} animate-[pulse_4s_cubic-bezier(0.4,0,0.6,1)_infinite]`} />
            <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${theme === 'black' ? 'bg-black' : 'bg-white'} animate-[ping_3.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50`}></span>
          </div>
          <span className={`text-xs font-black uppercase tracking-wider hidden sm:inline ${theme === 'black' ? 'text-black' : 'text-white'}`}>ASK</span>
        </button>

        {/* FMS Generative AI Assistant Chatbot Modal */}
        <AIChatModal
          isOpen={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          onNavigate={(view) => setActiveView(view as any)}
          initialQuery={aiInitialQuery}
        />

      </div>
  );
};

export default App;
