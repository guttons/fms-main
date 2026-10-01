import React from 'react';
import { UserRole } from '../types';
import { 
  LayoutDashboard, 
  Plane, 
  Droplet, 
  TrendingUp, 
  Settings, 
  FileText, 
  Calendar, 
  Anchor, 
  Sailboat, 
  Ship, 
  Truck, 
  Fuel, 
  Briefcase, 
  Coins, 
  Receipt, 
  History, 
  BookOpen, 
  BarChart3, 
  Users, 
  Gauge 
} from 'lucide-react';
import { StockIcon } from '../components/StockIcon';

export interface NavigationItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
}

export interface BadgeCounts {
  pendingTasks?: number;
  activeJobs?: number;
  unreadAlerts?: number;
}

/**
 * Authoritative list of all sidebar menu items per user role.
 * Single source of truth across desktop sidebar and mobile bottom navigation.
 */
export const getRoleMenuItems = (role?: UserRole): NavigationItem[] => {
  if (!role) return [];
  switch (role) {
    case UserRole.ITP_OPERATOR:
    case UserRole.ITP_SUPERVISOR:
    case UserRole.ITP_HD_OPERATOR:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
        { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
        { id: 'history', label: 'Log History', icon: History },
      ];

    case UserRole.ITP_OFFICER:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
        { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
        { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
        { id: 'history', label: 'Log History', icon: History },
      ];
    
    case UserRole.ITP_MANAGER:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'staff-tracker', label: 'Staff Tracker', icon: Users },
        { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
        { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
        { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
        { id: 'history', label: 'Log History', icon: History },
        { id: 'performance', label: 'Refueling Performance', icon: Gauge },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
      ];

    case UserRole.DEPOT_OPERATOR:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'stock', label: 'Tank Levels', icon: StockIcon },
        { id: 'bridging', label: 'Refueler Loading', icon: Droplet },
        { id: 'marine-loading', label: 'Marine Loading', icon: Ship },
        { id: 'seaplane', label: 'Seaplane Ops', icon: Sailboat },
        { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
        { id: 'marine', label: 'Tanker Discharge', icon: Anchor },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
      ];

    case UserRole.DEPOT_MANAGER:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'stock', label: 'Stock Reconciliation', icon: StockIcon },
        { id: 'bridging', label: 'Transfer Oversight', icon: Droplet },
        { id: 'marine-loading', label: 'Marine Provisioning', icon: Ship },
        { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
        { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
        { id: 'marine', label: 'Marine Oversight', icon: Anchor },
        { id: 'forecasting', label: 'Stock Forecasting', icon: TrendingUp },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
        { id: 'history', label: 'Log History', icon: History },
      ];

    case UserRole.EXECUTIVE:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'executive', label: 'Executive Module', icon: Briefcase },
        { id: 'forecasting', label: 'Forecasting & Trends', icon: TrendingUp },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'commercial-reports', label: 'Commercial Reports', icon: Coins },
        { id: 'finance', label: 'Finance & Billing', icon: Receipt },
      ];

    case UserRole.COMMERCIAL:
      return [
        { id: 'commercial-reports', label: 'Commercial Reports', icon: Coins },
        { id: 'forecasting', label: 'Forecasting & Trends', icon: TrendingUp },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'finance', label: 'Finance & Billing', icon: Receipt },
      ];

    case UserRole.FINANCE:
      return [
        { id: 'finance', label: 'Finance & Billing', icon: Receipt },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'reports', label: 'Financial Reports', icon: FileText },
      ];

    case UserRole.CUSTOMER:
      return [
        { id: 'customer-portal', label: 'Customer Portal', icon: Plane },
      ];

    case UserRole.FUEL_MANAGEMENT:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
        { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
        { id: 'history', label: 'Log History', icon: History },
        { id: 'performance', label: 'Refueling Performance', icon: Gauge },
        { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'executive', label: 'Executive Module', icon: Briefcase },
        { id: 'commercial-reports', label: 'Commercial Reports', icon: Coins },
        { id: 'finance', label: 'Finance & Billing', icon: Receipt },
      ];

    case UserRole.MACL_MANAGEMENT:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'executive', label: 'Executive Module', icon: Briefcase },
        { id: 'forecasting', label: 'Forecasting & Trends', icon: TrendingUp },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'commercial-reports', label: 'Commercial Reports', icon: Coins },
        { id: 'schedule', label: 'Flight Schedule', icon: Calendar },
        { id: 'history', label: 'Log History', icon: History },
      ];

    case UserRole.FUEL_ADMINISTRATION:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
        { id: 'intoplane', label: 'Flight Refueling', icon: Plane },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
        { id: 'stock', label: 'Stock Management', icon: StockIcon },
        { id: 'history', label: 'Log History', icon: History },
        { id: 'performance', label: 'Refueling Performance', icon: Gauge },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
      ];

    case UserRole.ADMIN:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'staff-tracker', label: 'Staff Tracker', icon: Users },
        { id: 'briefing', label: 'Shift Briefing', icon: BookOpen },
        { id: 'schedule', label: 'Schedule & Assign', icon: Calendar },
        { id: 'intoplane', label: 'Into-Plane Ops', icon: Plane },
        { id: 'equipment', label: 'Equipment Status', icon: Truck },
        { id: 'history', label: 'Log History', icon: History },
        { id: 'performance', label: 'Refueling Performance', icon: Gauge },
        { id: 'stock', label: 'Stock Management', icon: StockIcon },
        { id: 'bridging', label: 'Transfer Oversight', icon: Droplet },
        { id: 'marine-loading', label: 'Marine Loading', icon: Ship },
        { id: 'seaplane', label: 'Seaplane Oversight', icon: Sailboat },
        { id: 'lfs-afs', label: 'Filling Stations', icon: Fuel },
        { id: 'marine', label: 'Marine Oversight', icon: Anchor },
        { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
        { id: 'depot-reports', label: 'Fuel Reports', icon: BarChart3 },
        { id: 'executive', label: 'Executive Module', icon: Briefcase },
        { id: 'commercial-reports', label: 'Commercial Reports', icon: Coins },
        { id: 'finance', label: 'Finance & Billing', icon: Receipt },
        { id: 'customer-portal', label: 'Customer Portal', icon: Plane },
      ];
    
    default:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'history', label: 'Log History', icon: History },
      ];
  }
};

/**
 * Primary 4-5 items shown directly on mobile bottom navigation bar.
 */
export const getRoleNavItems = (
  role?: UserRole, 
  counts: BadgeCounts = {}
): NavigationItem[] => {
  if (!role) return [];
  const { pendingTasks = 0, activeJobs = 0 } = counts;

  switch (role) {
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
        { id: 'stock', label: 'Tanks', icon: StockIcon },
        { id: 'bridging', label: 'Loading', icon: Droplet },
        { id: 'marine', label: 'Marine', icon: Anchor },
        { id: 'lfs-afs', label: 'Stations', icon: Fuel },
      ];

    case UserRole.DEPOT_MANAGER:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'stock', label: 'Stock', icon: StockIcon },
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

    case UserRole.CUSTOMER:
      return [];

    case UserRole.FUEL_MANAGEMENT:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'intoplane', label: 'Refuel', icon: Plane },
        { id: 'forecasting', label: 'Forecast', icon: TrendingUp },
        { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
        { id: 'executive', label: 'Executive', icon: Briefcase },
      ];

    case UserRole.MACL_MANAGEMENT:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'executive', label: 'Executive', icon: Briefcase },
        { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
        { id: 'commercial-reports', label: 'Commercial', icon: Coins },
        { id: 'schedule', label: 'Schedule', icon: Calendar },
      ];

    case UserRole.FUEL_ADMINISTRATION:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'intoplane', label: 'Refuel', icon: Plane },
        { id: 'schedule', label: 'Schedule', icon: Calendar },
        { id: 'stock', label: 'Stock', icon: StockIcon },
        { id: 'depot-reports', label: 'Reports', icon: BarChart3 },
      ];

    case UserRole.ADMIN:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'admin', label: 'Admin', icon: Settings },
        { id: 'schedule', label: 'Schedule', icon: Calendar },
        { id: 'intoplane', label: 'Refuel', icon: Plane },
        { id: 'stock', label: 'Stock', icon: StockIcon },
      ];

    default:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'history', label: 'Logs', icon: History },
      ];
  }
};

/**
 * Overflow items displayed in the "Other Modules" bottom sheet.
 * Dynamically computes all menu items for the role that are not in the bottom bar,
 * guaranteeing new modules added to getRoleMenuItems automatically appear on mobile!
 */
export const getRoleOverflowItems = (
  role?: UserRole, 
  navItems: NavigationItem[] = []
): NavigationItem[] => {
  const allItems = getRoleMenuItems(role);
  const navIds = new Set(navItems.map(item => item.id));
  return allItems.filter(item => !navIds.has(item.id));
};
