
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
import { Wifi, WifiOff, Menu, X, Loader2 } from 'lucide-react';
import { supabaseService } from './services/supabaseService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
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
        return <EquipmentStatus tanks={tanks} />;
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
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
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

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden mr-4 text-slate-500"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
            <h1 className="text-xl font-bold text-slate-800 capitalize hidden sm:block">
              {activeView.replace('_', ' ')}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
             {/* Offline Indicator */}
             <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isOnline ? <Wifi className="w-3 h-3 mr-1"/> : <WifiOff className="w-3 h-3 mr-1"/>}
                {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
             </div>
          </div>
        </header>

        {/* Main Content Scroll Area */}
        <main className="flex-1 overflow-y-auto relative pb-16 lg:pb-0">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50">
              <Loader2 className="w-10 h-10 text-aviation-600 animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Connecting to Supabase...</p>
            </div>
          ) : renderContent()}
        </main>
      </div>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
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
