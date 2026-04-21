
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
import { Login } from './components/Login';
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

  // Header scroll listener
  const lastScrollYRef = React.useRef(0);
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = scrollRef.current?.scrollTop || 0;
      const scrollDelta = currentScrollY - lastScrollYRef.current;
      const isMobile = window.innerWidth < 1024;
      const threshold = isMobile ? 30 : 100;
      
      // Hide if scrolling down and passed the threshold
      // Show if scrolling up or at the very top
      if (scrollDelta > 0 && currentScrollY > threshold) {
        setShowHeader(false);
      } else if (scrollDelta < -10 || currentScrollY <= 10) {
        setShowHeader(true);
      }
      
      lastScrollYRef.current = currentScrollY;
    };

    const mainElement = scrollRef.current;
    mainElement?.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainElement?.removeEventListener('scroll', handleScroll);
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

// Sub-component to consume context
const AppContextContent: React.FC<any> = ({ 
  currentUser, activeView, setActiveView, isMobileMenuOpen, setIsMobileMenuOpen,
  isDarkMode, setIsDarkMode, showHeader, scrollRef, pendingJob, setPendingJob,
  showAlertsPanel, setShowAlertsPanel, isSettingsOpen, setIsSettingsOpen, handleLogout
}) => {
  const { alerts, acknowledgeAlert, acknowledgeAllAlerts } = useOperationalData();

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
        return currentUser.role === UserRole.ADMIN ? <SystemAdmin /> : <Dashboard user={currentUser} setActiveView={setActiveView} onStartJob={() => {}} />;
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
          
          {/* Animated Combined Header Container */}
          <div className={`transition-all duration-500 transform sticky top-0 z-50 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
            {/* Phase 1: Critical Alert Bar */}
            <div className={`transition-all duration-700 ease-in-out overflow-hidden shadow-lg ${activeCriticalAlerts.length > 0 ? 'h-10 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
              <div className="h-10 bg-error text-white flex items-center justify-between px-6 relative">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-4 h-4 animate-pulse" />
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
                    className="text-[10px] font-black uppercase tracking-tighter bg-white/10 hover:bg-white/20 px-3 py-1 rounded-sm transition-colors active:scale-95"
                  >
                    Acknowledge All
                  </button>
                </div>
              </div>
            </div>

            {/* Phase 2: FUEL SERVICES Header */}
            <header className="h-[var(--header-height)] bg-surface-container/70 backdrop-blur-xl border-b border-outline flex items-center justify-between px-4 lg:px-8 transition-colors duration-300">
            <div className="flex items-center flex-1 transition-all">
                <div className="flex items-center space-x-4">
                  <img 
                    src={isDarkMode ? "https://lh3.googleusercontent.com/d/1Uk6kyiqhPYw2_9qnXk8612yfdw5ioz5y=s220?authuser=0" : "https://lh3.googleusercontent.com/d/1YCRXjbsAQ5LskxJcQlSUQV5QyaSX9gD2=s220?authuser=0"} 
                    alt="MACL Logo" 
                    className="h-12 w-auto object-contain lg:hidden"
                  />
                  <div className="hidden lg:block">
                    <h1 className="text-lg font-black tracking-tighter leading-none text-primary uppercase">FUEL SERVICES</h1>
                  </div>
                </div>

                {/* Global Search */}
                <div className="hidden lg:flex ml-10 items-center bg-surface-dim border border-outline rounded-[18px] px-5 py-2.5 w-96 max-w-xl group focus-within:border-primary transition-all">
                  <Search className="w-4 h-4 text-on-surface-dim opacity-40 mr-3" />
                  <input 
                    type="text" 
                    placeholder="Search operations, assets, personnel..." 
                    className="bg-transparent border-none outline-none text-sm w-full font-bold placeholder:opacity-30 text-on-surface"
                  />
                  <div className="flex items-center space-x-2 ml-4">
                    <div className="dot-live"></div>
                    <span className="text-[9px] font-black opacity-30 uppercase whitespace-nowrap tracking-widest text-on-surface">Live</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-4 border-outline pl-6">

                  <div className="relative">
                    <button 
                      onClick={() => setShowAlertsPanel(!showAlertsPanel)}
                      className={`relative p-3 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl transition-all active:scale-90 group ${showAlertsPanel ? 'text-primary border-primary/40' : 'text-on-surface-dim hover:text-primary'}`}
                    >
                      <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      {unacknowledgedCount > 0 && (
                        <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-error text-white text-[8px] font-black rounded-full border-2 border-surface-dim flex items-center justify-center animate-in zoom-in duration-300">
                          {unacknowledgedCount}
                        </span>
                      )}
                    </button>

                    {/* Alerts Dropdown Panel */}
                    {showAlertsPanel && (
                      <div className="absolute right-0 mt-4 w-96 max-h-[500px] bg-surface-container border border-outline rounded-2xl shadow-premium z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="px-6 py-4 bg-surface-dim border-b border-outline flex items-center justify-between">
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
                    )}
                  </div>

                  <div className="flex items-center space-x-4 bg-surface-dim p-1.5 pr-5 rounded-2xl border border-outline hover:border-primary cursor-pointer transition-all active:scale-95 group">
                    <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-xl border-2 border-surface-container shadow-xl transform transition-transform group-hover:scale-105" />
                    <div className="hidden xl:block">
                      <p className="text-[11px] font-black text-on-surface leading-tight tracking-tight uppercase">{currentUser.name}</p>
                      <p className="text-[9px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest">{currentUser.role.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>
          </div>

          {/* Main Content Scroll Area */}
          <main ref={scrollRef as any} className="flex-1 overflow-y-auto relative canvas scroll-smooth overscroll-none">
            <div className="fade-in">
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

        {/* Universal System Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-8">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-surface/60 backdrop-blur-md animate-in fade-in duration-300"
              onClick={() => setIsSettingsOpen(false)}
            />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-xl bg-surface-container border border-outline rounded-[32px] shadow-premium overflow-hidden animate-in zoom-in-95 fade-in duration-300">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Platform Preferences</h2>
                    <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase underline decoration-primary underline-offset-8">System Settings</h3>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-3 bg-surface-dim hover:bg-surface-container border border-outline rounded-2xl text-on-surface-dim hover:text-primary transition-all active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Appearance Section */}
                  <div className="p-6 bg-surface-dim/40 border border-outline/50 rounded-2xl hover:border-primary/30 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-xl transition-all ${isDarkMode ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                          {isDarkMode ? <Moon className="w-5 h-5 shadow-glow" /> : <Sun className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-on-surface uppercase tracking-tight">Appearance</h4>
                          <p className="text-[11px] font-bold text-on-surface-dim opacity-50">Toggle between high-contrast light and dark modes</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`relative w-14 h-8 rounded-full transition-all duration-500 overflow-hidden group-active:scale-90 border border-outline/50 ${isDarkMode ? 'bg-primary shadow-glow' : 'bg-surface-container-high'}`}
                      >
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-lg ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Language Section (Placeholder) */}
                  <div className="p-6 bg-surface-dim/40 border border-outline/50 rounded-2xl opacity-50 cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-surface-container rounded-xl text-on-surface-dim">
                          <Search className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-on-surface uppercase tracking-tight">Regional Language</h4>
                          <p className="text-[11px] font-bold text-on-surface-dim opacity-50 italic">Dhivehi support coming soon</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-dim">Locked</span>
                    </div>
                  </div>

                  {/* User Profile Summary */}
                  <div className="mt-8 pt-8 border-t border-outline">
                    <div className="flex items-center space-x-4">
                      <img src={currentUser.avatar} alt="" className="w-12 h-12 rounded-2xl border-2 border-primary/20 shadow-xl" />
                      <div>
                        <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-0.5">Authenticated User</p>
                        <h4 className="text-base font-[900] text-on-surface tracking-tight uppercase leading-none">{currentUser.name}</h4>
                        <p className="text-[11px] font-bold text-primary opacity-80 mt-1 uppercase tracking-tighter">{currentUser.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12">
                   <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-glow hover:brightness-110 active:scale-[0.98] transition-all"
                   >
                     Apply Preferences
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default App;
