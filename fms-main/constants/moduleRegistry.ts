export interface ModuleDefinition {
  key: string;
  label: string;
  group: 'Operations' | 'Fleet & Infrastructure' | 'Analytics & Reports' | 'Management & Finance' | 'Administration';
  description: string;
}

export const ALL_MODULES: ModuleDefinition[] = [
  // Operations
  { key: 'dashboard', label: 'Operations Dashboard', group: 'Operations', description: 'Real-time overview of active fueling operations and flight status' },
  { key: 'schedule', label: 'Flight Schedule & Assign', group: 'Operations', description: 'Schedule flights, dispatch refuellers and assign ITP crew' },
  { key: 'intoplane', label: 'Into-Plane Fueling', group: 'Operations', description: 'Digital fuel delivery tickets, meter logs and crew sign-off' },
  { key: 'briefing', label: 'Shift Briefing', group: 'Operations', description: 'Shift handovers, crew briefings, and daily operational notes' },
  { key: 'history', label: 'Flight Log History', group: 'Operations', description: 'Comprehensive searchable historical flight refueling archive' },
  
  // Fleet & Infrastructure
  { key: 'equipment', label: 'Fleet & Equipment Status', group: 'Fleet & Infrastructure', description: 'Refuellers, Hydrant Dispensers, maintenance and service logs' },
  { key: 'stock', label: 'Tank Inventory & Stock', group: 'Fleet & Infrastructure', description: 'Jet A-1, Diesel, Petrol tank dips, ullage and reconciliation' },
  { key: 'bridging', label: 'Transfer & Bridging', group: 'Fleet & Infrastructure', description: 'Bulk fuel transfers from Main Farm to satellite depots' },
  { key: 'marine-loading', label: 'Marine Fuel Loading', group: 'Fleet & Infrastructure', description: 'Bunkering and transfer into marine vessels and barges' },
  { key: 'marine', label: 'Tanker Discharge Oversight', group: 'Fleet & Infrastructure', description: 'Vessel discharge, bill of lading vs received volume verification' },
  { key: 'seaplane', label: 'Seaplane Operations', group: 'Fleet & Infrastructure', description: 'Trans Maldivian and seaplane apron fueling logistics' },
  { key: 'lfs-afs', label: 'Filling Stations (LFS / AFS)', group: 'Fleet & Infrastructure', description: 'Landside and airside vehicle ground fuel dispensing' },

  // Analytics & Reports
  { key: 'performance', label: 'Refueling Performance', group: 'Analytics & Reports', description: 'TAT, delay analysis, officer benchmarks and SLA metrics' },
  { key: 'depot-reports', label: 'Fuel Reports & Logs', group: 'Analytics & Reports', description: 'Detailed volume reconciliation, quality certificates and summaries' },
  { key: 'commercial-reports', label: 'Commercial Reports', group: 'Analytics & Reports', description: 'Airline contracts, uplift trends and commercial revenue' },
  { key: 'forecasting', label: 'Stock Forecasting & Trends', group: 'Analytics & Reports', description: 'Predictive fuel consumption and vessel replenishment forecasting' },

  // Management & Finance
  { key: 'executive', label: 'Executive Dashboard', group: 'Management & Finance', description: 'High-level executive metrics, KPI cards and daily status summaries' },
  { key: 'finance', label: 'Finance & Invoicing', group: 'Management & Finance', description: 'Accounts receivable, billing statements and airline credit lines' },
  { key: 'customer-portal', label: 'Aviation Customer Portal', group: 'Management & Finance', description: 'Airline client view of tickets, flight uplifts and sign-offs' },

  // Administration
  { key: 'staff-tracker', label: 'Individual Staff Tracker', group: 'Administration', description: 'Real-time airside GPS positioning, active assignment & timeline' },
  { key: 'system-admin', label: 'System Settings', group: 'Administration', description: 'User management, RBAC, fleet registry and ticket settings' }
];

export const MODULE_GROUPS = [
  'Operations',
  'Fleet & Infrastructure',
  'Analytics & Reports',
  'Management & Finance',
  'Administration'
] as const;
