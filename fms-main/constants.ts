
import { UserRole, User, Tank, FlightLog, ForecastScenario, Alert, FuelType, FlightJob, Equipment, EquipmentType, EquipmentStatus } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'System Admin', role: UserRole.ADMIN, avatar: 'https://picsum.photos/100/100?random=1' },
  { id: 'u2', name: 'ITP Duty Manager', role: UserRole.ITP_MANAGER, avatar: 'https://picsum.photos/100/100?random=2' },
  { id: 'u2b', name: 'Depot Manager', role: UserRole.DEPOT_MANAGER, avatar: 'https://picsum.photos/100/100?random=20' },
  { id: 'u3', name: 'Apron Operator A', role: UserRole.ITP_OPERATOR, avatar: 'https://picsum.photos/100/100?random=3' },
  { id: 'u3b', name: 'Apron Operator B', role: UserRole.ITP_OPERATOR, avatar: 'https://picsum.photos/100/100?random=31' },
  { id: 'u4', name: 'Depot Operator', role: UserRole.DEPOT_OPERATOR, avatar: 'https://picsum.photos/100/100?random=4' },
  { id: 'u5', name: 'Executive Director', role: UserRole.EXECUTIVE, avatar: 'https://picsum.photos/100/100?random=5' },
  { id: 'u6', name: 'Commercial Analyst', role: UserRole.COMMERCIAL, avatar: 'https://picsum.photos/100/100?random=6' },
];

export const MOCK_JOBS: FlightJob[] = [
  { id: 'j1', flightNumber: 'SQ432', aircraftReg: '9V-SKT', aircraftType: 'A350-900', stand: 'F55', assignedTo: 'u3', status: 'PENDING' },
  { id: 'j2', flightNumber: 'UL102', aircraftReg: '4R-ALM', aircraftType: 'A330-300', stand: 'C12', assignedTo: 'u3b', status: 'PENDING' },
  { id: 'j3', flightNumber: 'EK659', aircraftReg: 'A6-EEO', aircraftType: 'A380-800', stand: 'D14', assignedTo: 'u3', status: 'IN_PROGRESS' },
  { id: 'j4', flightNumber: 'QR882', aircraftReg: 'A7-BCX', aircraftType: 'B787-9', stand: 'E04', assignedTo: 'u3b', status: 'COMPLETED' },
];

export const MOCK_DOMESTIC_FLIGHTS = [
  { id: 'df1', flightNumber: 'Q2 104', aircraftReg: '8Q-IAE', aircraftType: 'Dash 8', stand: 'D01', assignedTeam: 'Team 1', status: 'PENDING', eta: '08:00' },
  { id: 'df2', flightNumber: 'Q2 112', aircraftReg: '8Q-IAF', aircraftType: 'Dash 8', stand: 'D02', assignedTeam: 'Team 2', status: 'IN_PROGRESS', eta: '09:15' },
  { id: 'df3', flightNumber: 'Q2 118', aircraftReg: '8Q-IAG', aircraftType: 'ATR 72', stand: 'D03', assignedTeam: 'Team 3', status: 'PENDING', eta: '10:30' },
  { id: 'df4', flightNumber: 'VP 601', aircraftReg: '8Q-VAA', aircraftType: 'ATR 72', stand: 'D04', assignedTeam: 'Team 1', status: 'PENDING', eta: '11:45' },
];

export const TANKS: Tank[] = [
  // OLD FUEL FARM
  { id: 'tk4', name: 'TK-4 (OFF)', type: FuelType.JET_A1, capacity: 1000000, currentLevel: 450000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk6', name: 'TK-6 (OFF)', type: FuelType.JET_A1, capacity: 1000000, currentLevel: 620000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk7', name: 'TK-7 (OFF)', type: FuelType.JET_A1, capacity: 1000000, currentLevel: 380000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk8', name: 'TK-8 (OFF)', type: FuelType.JET_A1, capacity: 1000000, currentLevel: 710000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk9', name: 'TK-9 (OFF)', type: FuelType.JET_A1, capacity: 1000000, currentLevel: 540000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'off-diesel', name: 'Diesel Tank (OFF)', type: FuelType.DIESEL, capacity: 50000, currentLevel: 32000, safeMinLevel: 5000, lastUpdated: new Date().toISOString() },
  { id: 'off-petrol', name: 'Petrol Tank (OFF)', type: FuelType.PETROL, capacity: 20000, currentLevel: 15000, safeMinLevel: 2000, lastUpdated: new Date().toISOString() },
  
  // NEW FUEL FARM
  { id: 'tk101', name: 'TK-101 (NFF)', type: FuelType.JET_A1, capacity: 5000000, currentLevel: 3200000, safeMinLevel: 500000, lastUpdated: new Date().toISOString() },
  { id: 'tk102', name: 'TK-102 (NFF)', type: FuelType.JET_A1, capacity: 5000000, currentLevel: 4100000, safeMinLevel: 500000, lastUpdated: new Date().toISOString() },
  { id: 'tk103', name: 'TK-103 (NFF)', type: FuelType.JET_A1, capacity: 5000000, currentLevel: 2800000, safeMinLevel: 500000, lastUpdated: new Date().toISOString() },
  { id: 'tk106', name: 'Recovery Tank TK-106 (NFF)', type: FuelType.JET_A1, capacity: 100000, currentLevel: 12000, safeMinLevel: 5000, lastUpdated: new Date().toISOString() },
  { id: 'tk201', name: 'Diesel TK-201 (NFF)', type: FuelType.DIESEL, capacity: 100000, currentLevel: 75000, safeMinLevel: 10000, lastUpdated: new Date().toISOString() },
  { id: 'tk202', name: 'Diesel TK-202 (NFF)', type: FuelType.DIESEL, capacity: 100000, currentLevel: 68000, safeMinLevel: 10000, lastUpdated: new Date().toISOString() },
  { id: 'tk301', name: 'Petrol TK-301 (NFF)', type: FuelType.PETROL, capacity: 50000, currentLevel: 42000, safeMinLevel: 5000, lastUpdated: new Date().toISOString() },
  { id: 'tk302', name: 'Petrol TK-302 (NFF)', type: FuelType.PETROL, capacity: 50000, currentLevel: 38000, safeMinLevel: 5000, lastUpdated: new Date().toISOString() },

  // Seaplane Fuel Tanks
  { id: 'spf-e1', name: 'SPF-E-1', type: FuelType.JET_A1, capacity: 100000, currentLevel: 82000, safeMinLevel: 10000, lastUpdated: new Date().toISOString() },
  { id: 'spf-e2', name: 'SPF-E-2', type: FuelType.JET_A1, capacity: 100000, currentLevel: 75000, safeMinLevel: 10000, lastUpdated: new Date().toISOString() },
  { id: 'spf-e3', name: 'SPF-E-3', type: FuelType.JET_A1, capacity: 100000, currentLevel: 61000, safeMinLevel: 10000, lastUpdated: new Date().toISOString() },

  // Landside filling station (LFS)
  { id: 'lfs-diesel', name: 'Diesel Tank (LFS)', type: FuelType.DIESEL, capacity: 30000, currentLevel: 22000, safeMinLevel: 3000, lastUpdated: new Date().toISOString() },
  { id: 'lfs-petrol', name: 'Petrol Tank (LFS)', type: FuelType.PETROL, capacity: 20000, currentLevel: 14000, safeMinLevel: 2000, lastUpdated: new Date().toISOString() },

  // Airside filling Station (AFS)
  { id: 'afs-diesel', name: 'Diesel Tank (AFS)', type: FuelType.DIESEL, capacity: 30000, currentLevel: 18000, safeMinLevel: 3000, lastUpdated: new Date().toISOString() },
  { id: 'afs-petrol', name: 'Petrol Tank (AFS)', type: FuelType.PETROL, capacity: 20000, currentLevel: 11000, safeMinLevel: 2000, lastUpdated: new Date().toISOString() },
];

export const EQUIPMENT: Equipment[] = [
  // Refuellers
  ...['RF-02', 'RF-04', 'RF-06', 'RF-07', 'RF-10', 'RF-11', 'RF-12', 'RF-14', 'RF-15', 'RF-16', 'RF-17'].map(id => ({
    id, name: id, type: EquipmentType.REFUELLER, status: EquipmentStatus.AVAILABLE, currentVolume: 15000, maxCapacity: 35000, lastUpdated: new Date().toISOString()
  })),
  // Hydrant dispensers
  ...['HD-01', 'HD-02', 'HD-03', 'HD-04'].map(id => ({
    id, name: id, type: EquipmentType.HYDRANT_DISPENSER, status: EquipmentStatus.AVAILABLE, currentVolume: 0, maxCapacity: 0, lastUpdated: new Date().toISOString()
  })),
  // Diesel truck
  ...['DT-01', 'DT-02'].map(id => ({
    id, name: id, type: EquipmentType.DIESEL_TRUCK, status: EquipmentStatus.AVAILABLE, currentVolume: 5000, maxCapacity: 10000, lastUpdated: new Date().toISOString()
  })),
  // Hydrant Service
  ...['HS-01', 'HS-02'].map(id => ({
    id, name: id, type: EquipmentType.HYDRANT_SERVICE, status: EquipmentStatus.AVAILABLE, currentVolume: 0, maxCapacity: 0, lastUpdated: new Date().toISOString()
  })),
];

export const RECENT_LOGS: FlightLog[] = [
  { 
    id: 'fl1', flightNumber: 'EK650', aircraftReg: 'A6-EEO', aircraftType: 'A380', stand: 'D12', operatorId: 'u3', vehicleId: 'R-045', status: 'COMPLETED',
    timestampArrived: '2023-10-27T07:55:00Z', timestampPosition: '2023-10-27T08:00:00Z', timestampStart: '2023-10-27T08:15:00Z', timestampFinalEnd: '2023-10-27T09:00:00Z', timestampClearance: '2023-10-27T09:05:00Z',
    meterOpen: 125000, meterClose: 185000, volume: 60000, 
    panelCheck: true, walkAroundCheck: true, appearanceCheck: true, waterCheck: true
  },
  { 
    id: 'fl2', flightNumber: 'QR670', aircraftReg: 'A7-BCX', aircraftType: 'B787', stand: 'E4', operatorId: 'u3', vehicleId: 'R-045', status: 'IN_PROGRESS',
    timestampArrived: '2023-10-27T09:25:00Z', timestampPosition: '2023-10-27T09:30:00Z', timestampStart: '2023-10-27T09:45:00Z',
    meterOpen: 185000, meterClose: undefined, volume: 0, 
    panelCheck: true, walkAroundCheck: true, appearanceCheck: true, waterCheck: true
  }
];

export const FORECAST_DATA: ForecastScenario[] = [
  {
    id: 'nominal', name: 'Nominal', description: 'Baseline forecast using confirmed schedule',
    data: Array.from({ length: 30 }, (_, i) => ({ day: `Day ${i + 1}`, stockLevel: 8000000 - (i * 150000), threshold: 1000000 }))
  },
  {
    id: 'upper', name: 'High Demand', description: 'Simulating peak season uplift (+20%)',
    data: Array.from({ length: 30 }, (_, i) => ({ day: `Day ${i + 1}`, stockLevel: 8000000 - (i * 210000), threshold: 1000000 }))
  },
  {
    id: 'lower', name: 'Low Demand', description: 'Reduced schedule simulation (-15%)',
    data: Array.from({ length: 30 }, (_, i) => ({ day: `Day ${i + 1}`, stockLevel: 8000000 - (i * 110000), threshold: 1000000 }))
  }
];

export const MOCK_ALERTS: Alert[] = [
  { id: 'a1', severity: 'critical', message: 'Tank 101 reached re-order point', timestamp: '2 mins ago', acknowledged: false },
  { id: 'a2', severity: 'medium', message: 'Forecast variance > 5% detected', timestamp: '1 hour ago', acknowledged: true },
  { id: 'a3', severity: 'low', message: 'Shift changeover due in 30 mins', timestamp: '2 hours ago', acknowledged: false },
];
