
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
import { Login } from './components/Login';
import { Logo } from './components/Logo';
import { BottomNav } from './components/BottomNav';
import { NotificationProvider } from './context/NotificationContext';
import { OperationalDataProvider, useOperationalData } from './context/OperationalDataContext';
import { MOCK_USERS } from './constants';
import { User, UserRole, FlightJob } from './types';
import { Wifi, WifiOff, PanelLeft, X, Loader2, Search, Bell, User as UserIcon, AlertCircle, Sun, Moon, CheckCircle } from 'lucide-react';

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
  }, [isDarkMode]);
  
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

  if (!currentUser) {
    return (
      <NotificationProvider>
        <Login onLogin={setCurrentUser} />
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
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
    </NotificationProvider>
  );
};

const AppContextContent: React.FC<any> = ({ 
  currentUser, activeView, setActiveView, isMobileMenuOpen, setIsMobileMenuOpen,
  isDarkMode, setIsDarkMode, showHeader, setShowHeader, scrollRef, pendingJob, setPendingJob,
  showAlertsPanel, setShowAlertsPanel, isSettingsOpen, setIsSettingsOpen, handleLogout
}) => {
  const { alerts, acknowledgeAlert, acknowledgeAllAlerts, equipment, flightJobs } = useOperationalData();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Header scroll listener
  const lastScrollYRef = React.useRef(0);
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      
      const currentScrollY = scrollRef.current.scrollTop;
      const isMobile = window.innerWidth < 1024;
      
      if (!isMobile) {
        setShowHeader(true);
        return;
      }

      // Hide if scrolling down and passed a small threshold
      // Show if scrolling up significantly or at the very top
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 20) {
        setShowHeader(false);
      } else if (currentScrollY < lastScrollYRef.current - 10 || currentScrollY <= 10) {
        setShowHeader(true);
      }
      
      lastScrollYRef.current = currentScrollY;
    };

    const mainElement = scrollRef.current;
    mainElement?.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainElement?.removeEventListener('scroll', handleScroll);
  }, [scrollRef, setShowHeader]);

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return { equipment: [], jobs: [], personnel: [] };
    const lower = searchQuery.toLowerCase();
    return {
      equipment: (equipment || []).filter(e => e.id.toLowerCase().includes(lower) || e.type.toLowerCase().includes(lower)),
      jobs: (flightJobs || []).filter(j => j.flightNumber.toLowerCase().includes(lower) || j.aircraftReg.toLowerCase().includes(lower) || j.aircraftType.toLowerCase().includes(lower)),
      personnel: MOCK_USERS.filter(u => u.name.toLowerCase().includes(lower) || u.role.toLowerCase().includes(lower))
    };
  }, [searchQuery, equipment, flightJobs]);

  // Filter alerts by role
  const userAlerts = (alerts || []).filter(a => {
    if (!a || !currentUser || !currentUser.role) return false;
    if ([UserRole.ADMIN, UserRole.EXECUTIVE].includes(currentUser.role)) return true;
    if (a.targetRole === currentUser.role) return true;
    if ([UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(currentUser.role) && 
        a.targetRole && [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(a.targetRole as UserRole)) return true;
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
        return <Forecasting />;
      case 'bridging':
        return <Bridging />;
      case 'marine-loading':
        return <MarineLoading />;
      case 'marine':
        return <TankerDischarge />;
      case 'stock':
        return <Stock />;
      case 'history':
        return <LogHistory />;
      case 'schedule':
        return <Schedule />;
      case 'briefing':
        return <ShiftBriefing />;
      case 'admin':
        return currentUser.role === UserRole.ADMIN ? <SystemAdmin currentUser={currentUser} /> : <Dashboard user={currentUser} setActiveView={setActiveView} onStartJob={() => {}} />;
      case 'reports':
        return <CommercialReports />;
      case 'equipment':
        return <EquipmentStatus user={currentUser!} />;
      case 'seaplane':
        return <Seaplane />;
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
          onSettingsClick={() => setIsSettingsOpen(true)}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-colors duration-500">
          
          {(showAlertsPanel || isSettingsOpen) && (
             <div className="fixed inset-0 bg-black/20 backdrop-blur-md z-40 transition-all duration-500 lg:hidden" onClick={() => { setShowAlertsPanel(false); setIsSettingsOpen(false); }} />
          )}

          {/* Animated Combined Header Container */}
          <div className={`transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] sticky top-0 z-50 ${showHeader ? 'translate-y-0 opacity-100 max-h-[200px]' : '-translate-y-full opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}>
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

                  <div className="relative">
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
                          <div className="px-5 py-4 bg-surface-dim border-b border-outline flex items-center justify-between">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface flex items-center">
                            <Bell className="w-3.5 h-3.5 mr-2 text-primary" />
                            Tactical Updates
                          </h3>
                          <button onClick={() => setShowAlertsPanel(false)} className="text-on-surface-dim hover:text-primary transition-colors">
                            <X className="w-4 h-4" />
                          </button>
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
                          <div className="p-4 bg-surface-dim/40 border-t border-outline">
                             <p className="text-[8px] font-bold text-center text-on-surface-dim uppercase tracking-[0.2em] opacity-40 italic">Tap items to acknowledge protocol</p>
                          </div>
                        )}
                      </div>
                      </>
                    )}
                  </div>

                  <div className="relative">
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

          {/* Main Content Scroll Area */}
          <main ref={scrollRef as any} className="flex-1 overflow-y-auto relative canvas scroll-smooth overscroll-none pb-32 lg:pb-10">
            <div key={activeView} className="animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out">
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


      </div>
  );
};

export default App;
