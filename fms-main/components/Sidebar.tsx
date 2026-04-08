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
  AlertTriangle,
  Database,
  Calendar,
  Anchor,
  Sailboat,
  Hexagon,
  Users,
  ClipboardList,
  Truck
} from 'lucide-react';

interface SidebarProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  isMobileMenuOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeView, setActiveView, onLogout, isMobileMenuOpen }) => {
  const getMenuItems = () => {
    switch (user.role) {
      case UserRole.ITP_OPERATOR:
        return [
          { id: 'dashboard', label: 'My Tasks', icon: LayoutDashboard },
          { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
          { id: 'history', label: 'Log History', icon: FileText },
        ];
      
      case UserRole.ITP_MANAGER:
        return [
          { id: 'dashboard', label: 'Ops Dashboard', icon: LayoutDashboard },
          { id: 'equipment', label: 'Equipment Status', icon: Truck },
          { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
          { id: 'briefing', label: 'Shift Briefing', icon: ClipboardList },
          { id: 'history', label: 'Ops History', icon: FileText },
        ];

      case UserRole.DEPOT_OPERATOR:
        return [
          { id: 'dashboard', label: 'Depot Status', icon: LayoutDashboard },
          { id: 'stock', label: 'Tank Levels', icon: Database },
          { id: 'bridging', label: 'Refueler Loading', icon: Droplet },
          { id: 'marine', label: 'Tanker Discharge', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Ops', icon: Sailboat },
        ];

      case UserRole.DEPOT_MANAGER:
        return [
          { id: 'dashboard', label: 'Depot Dashboard', icon: LayoutDashboard },
          { id: 'stock', label: 'Stock Reconciliation', icon: Database },
          { id: 'bridging', label: 'Transfer Oversight', icon: Droplet },
          { id: 'marine', label: 'Marine Oversight', icon: Anchor },
          { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
        ];

      case UserRole.EXECUTIVE:
      case UserRole.COMMERCIAL:
        return [
          { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard },
          { id: 'forecasting', label: 'Forecasting & Trends', icon: TrendingUp },
          { id: 'reports', label: 'Commercial Reports', icon: FileText },
        ];

      case UserRole.ADMIN:
      default:
        return [
          { id: 'dashboard', label: 'Ops Dashboard', icon: LayoutDashboard },
          { id: 'admin', label: 'System Admin', icon: Settings },
          { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
          { id: 'briefing', label: 'Shift Briefing', icon: ClipboardList },
          { id: 'intoplane', label: 'Into-Plane Ops', icon: Plane },
          { id: 'stock', label: 'Stock Management', icon: Database },
          { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
          { id: 'reports', label: 'Commercial Reports', icon: FileText },
        ];
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-[60] w-64 bg-aviation-900 text-white transform transition-transform duration-300 ease-in-out
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 shadow-xl
    `}>
      <div className="h-full flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center px-6 bg-aviation-800 font-bold text-xl tracking-wider border-b border-aviation-700">
          <Hexagon className="w-6 h-6 mr-2 text-aviation-500" />
          MACL <span className="text-aviation-500 ml-1">FMS</span>
        </div>

        {/* User Profile Snippet */}
        <div className="p-6 border-b border-aviation-800 bg-aviation-800/50">
          <div className="flex items-center space-x-3">
            <img src={user.avatar} alt="User" className="w-10 h-10 rounded-full border-2 border-aviation-500" />
            <div>
              <p className="font-semibold text-sm">{user.name}</p>
              <p className="text-xs text-aviation-200 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-aviation-600 text-white shadow-md' 
                    : 'text-aviation-100 hover:bg-aviation-800 hover:text-white'
                  }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* System Status / Logout */}
        <div className="p-4 border-t border-aviation-800 bg-aviation-900">
           {/* Mock Alert Status */}
          <div className="mb-4 flex items-center px-4 py-2 bg-aviation-800 rounded-md text-xs text-yellow-400">
            <AlertTriangle className="w-3 h-3 mr-2" />
            <span>2 Critical Alerts Active</span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-2 text-sm text-aviation-200 hover:text-white hover:bg-aviation-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
};