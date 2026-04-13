
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
import { MOCK_USERS, TANKS } from './constants';
import { User, UserRole, Tank } from './types';
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
  
  // Theme management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  
  // Lifted State for Tanks to allow real-time updates across modules
  const [tanks, setTanks] = useState<Tank[]>(TANKS);

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

  // View Router
  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard tanks={tanks} user={currentUser} />;
      case 'intoplane':
        return <IntoPlane user={currentUser} />;
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
    <div className="flex h-screen bg-surface overflow-hidden text-on-surface">
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Phase 1: Critical Alert Bar */}
        <div className="h-10 bg-error text-white flex items-center justify-between px-6 z-50 shadow-lg">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">
              Critical Alert: <span className="opacity-80 font-medium ml-2">TK-8 below threshold • Flow mismatch Bay 3</span>
            </span>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest hidden md:block">Primary Loop: Offline</span>
            <button className="text-[10px] font-black uppercase tracking-tighter bg-white/10 hover:bg-white/20 px-3 py-1 rounded-sm transition-colors">
              Acknowledge All
            </button>
          </div>
        </div>

        {/* Phase 2: AeroFuel Command Header */}
        <header className="h-[var(--header-height)] bg-surface-lowest border-b border-outline flex items-center justify-between px-4 lg:px-8 z-40">
          <div className="flex items-center flex-1">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden mr-4 text-slate-500"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
            <div className="hidden md:block mr-12">
              <h1 className="headline-lg text-primary tracking-tight leading-none">AeroFuel</h1>
              <span className="text-xs font-black text-primary opacity-90 uppercase tracking-[0.3em]">Command</span>
            </div>

            {/* Global Search */}
            <div className="hidden lg:flex items-center bg-surface-dim border border-outline rounded-full px-4 py-2 w-96 max-w-xl group focus-within:border-primary-bright transition-all">
              <Search className="w-4 h-4 text-slate-400 mr-3" />
              <input 
                type="text" 
                placeholder="Search operations, assets, personnel..." 
                className="bg-transparent border-none outline-none text-sm w-full font-medium placeholder:text-slate-400"
              />
              <div className="flex items-center space-x-2 ml-2">
                <div className="dot-live"></div>
                <span className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap">Last updated: 12s ago</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Mode Switcher */}
            <div className="hidden sm:flex items-center bg-surface-dim p-1 rounded-lg border border-outline">
              <button className="px-4 py-1.5 bg-primary text-white text-[10px] font-black rounded-md shadow-sm uppercase tracking-widest transition-all">
                Shift Mode
              </button>
              <button className="px-4 py-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-primary transition-colors">
                Supervisor
              </button>
            </div>

            {/* Notifications & Profile */}
            <div className="flex items-center space-x-4 border-l border-outline pl-6">
              <button className="relative p-2 text-slate-400 hover:text-primary transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
              </button>

              {/* Theme Toggle */}
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-400 hover:text-primary transition-all duration-300 hover:rotate-45"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="flex items-center space-x-3 bg-slate-100 dark:bg-slate-800 p-1 pr-3 rounded-full border border-outline hover:border-primary-bright cursor-pointer transition-all">
                <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full border border-white dark:border-slate-700 shadow-sm" />
                <div className="hidden xl:block">
                  <p className="text-[10px] font-black text-primary leading-tight">{currentUser.name}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Scroll Area */}
        <main className="flex-1 overflow-y-auto relative canvas">
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
