
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
import { MOCK_USERS, TANKS, EQUIPMENT } from './constants';
import { User, UserRole, Tank, Equipment, EquipmentStatus as EqStatus, FlightJob } from './types';
import { Wifi, WifiOff, Menu, X, Loader2, Search, Bell, User as UserIcon, AlertCircle, Sun, Moon } from 'lucide-react';
import { supabaseService } from './services/supabaseService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [showHeader, setShowHeader] = useState(true);
  const scrollRef = React.useRef<HTMLElement>(null);
  const [pendingJob, setPendingJob] = useState<FlightJob | null>(null);
  
  // Theme management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  
  // Lifted State for Tanks to allow real-time updates across modules
  const [tanks, setTanks] = useState<Tank[]>(TANKS);
  const [equipment, setEquipment] = useState<Equipment[]>(EQUIPMENT);

  // Initial data fetch from Supabase
  useEffect(() => {
    if (!currentUser) return;

    const initData = async () => {
      try {
        setIsLoading(true);
        const fetchedTanks = await supabaseService.getTanks();
        if (fetchedTanks && fetchedTanks.length > 0) {
          setTanks(fetchedTanks);
        } else {
          console.log('No tanks found in Supabase, using mock data');
        }
      } catch (error) {
        console.error('Error fetching data from Supabase:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [currentUser]);

  const handleTankUpdate = async (id: string, newLevel: number) => {
    // Optimistic update
    setTanks(prev => prev.map(t => t.id === id ? { ...t, currentLevel: newLevel, lastUpdated: new Date().toISOString() } : t));
    
    try {
      await supabaseService.updateTankLevel(id, newLevel);
    } catch (error) {
      console.error('Failed to sync tank update to Supabase:', error);
      // In a real app, we might want to rollback or show an error
    }
  };

  const handleEquipmentStatusUpdate = (id: string, status: EqStatus) => {
    setEquipment(prev => prev.map(eq => eq.id === id ? { ...eq, status, lastUpdated: new Date().toISOString() } : eq));
  };

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
      const isScrollingDown = currentScrollY > lastScrollYRef.current;
      
      if (isScrollingDown && currentScrollY > 150) {
        setShowHeader(false);
      } else if (!isScrollingDown || currentScrollY < 50) {
        setShowHeader(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    const mainElement = scrollRef.current;
    mainElement?.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainElement?.removeEventListener('scroll', handleScroll);
  }, []);

  // View Router
  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard 
            tanks={tanks} 
            user={currentUser} 
            setActiveView={setActiveView} 
            onStartJob={(job) => {
              setPendingJob(job);
              setActiveView('intoplane');
            }}
          />
        );
      case 'intoplane':
        return (
          <IntoPlane 
            user={currentUser} 
            equipment={equipment} 
            onUpdateEquipmentStatus={handleEquipmentStatusUpdate} 
            initialJob={pendingJob}
            onClearInitialJob={() => setPendingJob(null)}
          />
        );
      case 'forecasting':
        return <Forecasting />;
      case 'bridging':
        return <Bridging tanks={tanks} onUpdateTank={handleTankUpdate} />;
      case 'marine':
        return <TankerDischarge />;
      case 'stock':
        return <Stock tanks={tanks} onUpdateTank={handleTankUpdate} />;
      case 'history':
        return <LogHistory />;
      case 'schedule':
        return <Schedule />;
      case 'briefing':
        return <ShiftBriefing />;
      case 'admin':
        return <SystemAdmin />;
      case 'reports':
        return <CommercialReports />;
      case 'equipment':
        return <EquipmentStatus tanks={tanks} user={currentUser!} />;
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

  // Demo Login Switcher (for presentation only)
  const handleRoleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const user = MOCK_USERS.find(u => u.id === e.target.value);
    if (user) {
      setCurrentUser(user);
      // Smart redirect based on role
      if (user.role === UserRole.ITP_OPERATOR) {
        setActiveView('dashboard');
      } else if (user.role === UserRole.ITP_MANAGER) {
        setActiveView('dashboard');
      } else if (user.role === UserRole.DEPOT_OPERATOR) {
        setActiveView('bridging');
      } else if (user.role === UserRole.DEPOT_MANAGER) {
        setActiveView('dashboard');
      } else {
        setActiveView('dashboard');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  return (
    <div className="flex h-screen bg-surface overflow-hidden text-on-surface transition-colors duration-500">
      {/* Sidebar */}
      <Sidebar 
        user={currentUser} 
        activeView={activeView} 
        setActiveView={(view) => {
          setActiveView(view);
          setIsMobileMenuOpen(false);
        }}
        onLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-colors duration-500">
        
        {/* Animated Combined Header Container */}
        <div className={`transition-all duration-500 transform sticky top-0 z-50 ${showHeader ? 'translate-y-0' : '-translate-y-[112px]'}`}>
          {/* Phase 1: Critical Alert Bar */}
          <div className="h-10 bg-error text-white flex items-center justify-between px-6 shadow-lg relative">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-4 h-4 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">
                Critical Alert: <span className="opacity-80 font-medium ml-2">TK-8 below threshold • Flow mismatch Bay 3</span>
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest hidden md:block">Primary Loop: Offline</span>
              <button className="text-[10px] font-black uppercase tracking-tighter bg-white/10 hover:bg-white/20 px-3 py-1 rounded-sm transition-colors active:scale-95">
                Acknowledge All
              </button>
            </div>
          </div>

          {/* Phase 2: FUEL SERVICES Header */}
          <header className="h-[var(--header-height)] bg-surface-container/70 backdrop-blur-xl border-b border-outline flex items-center justify-between px-4 lg:px-8 transition-colors duration-300">
            <div className="flex items-center flex-1">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden mr-4 text-on-surface-dim active:scale-90 transition-transform"
              >
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
              <div className="flex items-center space-x-4 lg:hidden">
                <img 
                  src={isDarkMode ? "https://lh3.googleusercontent.com/d/1Uk6kyiqhPYw2_9qnXk8612yfdw5ioz5y=s220?authuser=0" : "https://lh3.googleusercontent.com/d/1YCRXjbsAQ5LskxJcQlSUQV5QyaSX9gD2=s220?authuser=0"} 
                  alt="MACL Logo" 
                  className="h-12 w-auto object-contain"
                />
                <div className="hidden lg:block">
                  <h1 className="text-lg font-black tracking-tighter leading-none text-primary uppercase">FUEL SERVICES</h1>
                </div>
              </div>

              {/* Global Search */}
              <div className="hidden lg:flex items-center bg-surface-dim border border-outline rounded-[18px] px-5 py-2.5 w-96 max-w-xl group focus-within:border-primary transition-all">
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
                {/* Theme Toggle */}
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-3 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl transition-all duration-500 hover:rotate-12 active:scale-90 group"
                  title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {isDarkMode ? <Sun className="w-5 h-5 text-warning" /> : <Moon className="w-5 h-5 text-primary" />}
                </button>

                <button className="relative p-3 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl text-on-surface-dim hover:text-primary transition-all active:scale-90 group">
                  <Bell className="w-5 h-5 group-hover:animate-bounce" />
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface-dim"></span>
                </button>

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
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/80 z-50 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="label-sm text-primary tracking-widest">ESTABLISHING SECURE DATA STREAM...</p>
            </div>
          ) : (
            <div className="fade-in">
              {renderContent()}
            </div>
          )}
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
      />
    </div>
  );
};

export default App;
