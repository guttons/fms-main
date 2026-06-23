
import { UserRole, User, Tank, FlightLog, ForecastScenario, Alert, FuelType, FlightJob, Equipment, EquipmentType, EquipmentStatus } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'System Admin', role: UserRole.ADMIN, avatar: 'https://picsum.photos/100/100?random=1' },
  { id: 'u2', name: 'ITP Duty Manager', role: UserRole.ITP_MANAGER, avatar: 'https://picsum.photos/100/100?random=2' },
  { id: 'u2b', name: 'Depot Manager', role: UserRole.DEPOT_MANAGER, avatar: 'https://picsum.photos/100/100?random=20' },
  { id: 'u3', name: 'Apron Officer A', role: UserRole.ITP_OFFICER, avatar: 'https://picsum.photos/100/100?random=3' },
  { id: 'u3b', name: 'Apron Operator B', role: UserRole.ITP_OPERATOR, avatar: 'https://picsum.photos/100/100?random=31' },
  { id: 'u4', name: 'Depot Operator', role: UserRole.DEPOT_OPERATOR, avatar: 'https://picsum.photos/100/100?random=4' },
  { id: 'u7', name: 'Hydrant Specialist A', role: UserRole.ITP_HD_OPERATOR, avatar: 'https://picsum.photos/100/100?random=7' },
  { id: 'u8', name: 'Hydrant Specialist B', role: UserRole.ITP_HD_OPERATOR, avatar: 'https://picsum.photos/100/100?random=8' },
  { id: 'u11', name: 'ITP Supervisor A', role: UserRole.ITP_SUPERVISOR, avatar: 'https://picsum.photos/100/100?random=11' },
  { id: 'u5', name: 'Executive Director', role: UserRole.EXECUTIVE, avatar: 'https://picsum.photos/100/100?random=5' },
  { id: 'u6', name: 'Commercial Analyst', role: UserRole.COMMERCIAL, avatar: 'https://picsum.photos/100/100?random=6' },
  { id: 'u9', name: 'Finance Manager', role: UserRole.FINANCE, avatar: 'https://picsum.photos/100/100?random=9' },
  { id: 'u10', name: 'Emirates (Customer)', role: UserRole.CUSTOMER, avatar: 'https://picsum.photos/100/100?random=10' },
];

export const MOCK_JOBS: FlightJob[] = [
  { id: 'j1', flightNumber: 'SQ432', aircraftReg: '9V-SKT', aircraftType: 'A350-900', stand: 'F55', sta: '07:45', eta: '08:00', std: '09:30', assignedTo: 'u3b', assignedOfficer: 'u3', status: 'PENDING', route: 'SIN ➔ MLE ➔ SIN', equipmentUsage: 'HYDRANT' },
  { id: 'j2', flightNumber: 'UL102', aircraftReg: '4R-ALM', aircraftType: 'A330-300', stand: 'C12', sta: '08:15', eta: '08:15', std: '09:45', assignedTo: 'u3b', status: 'PENDING', route: 'CMB ➔ MLE ➔ CMB', equipmentUsage: 'HYDRANT' },
  { id: 'j3', flightNumber: 'EK659', aircraftReg: 'A6-EEO', aircraftType: 'A380-800', stand: 'D14', sta: '09:30', eta: '09:45', std: '11:15', assignedTo: 'u3b', assignedOfficer: 'u3', status: 'IN_PROGRESS', vehicleId: 'HD-01', route: 'DXB ➔ MLE ➔ DXB', equipmentUsage: 'HYDRANT' },
  { id: 'j4', flightNumber: 'QR882', aircraftReg: 'A7-BCX', aircraftType: 'B787-9', stand: 'E04', sta: '10:00', eta: '10:15', std: '12:00', assignedTo: 'u3b', status: 'COMPLETED', vehicleId: 'RF-04', route: 'DOH ➔ MLE ➔ DOH', equipmentUsage: 'REFUELLER' },
];

export const MOCK_DOMESTIC_FLIGHTS = [
  { id: 'df1', flightNumber: 'Q2 104', aircraftReg: '8Q-IAE', aircraftType: 'Dash 8', stand: 'D01', assignedTeam: 'Team 1', status: 'PENDING', sta: '07:30', eta: '08:00', std: '08:45' },
  { id: 'df2', flightNumber: 'Q2 112', aircraftReg: '8Q-IAF', aircraftType: 'Dash 8', stand: 'D02', assignedTeam: 'Team 2', status: 'IN_PROGRESS', sta: '08:45', eta: '09:15', std: '09:50', vehicleId: 'RF-02' },
  { id: 'df3', flightNumber: 'Q2 118', aircraftReg: '8Q-IAG', aircraftType: 'ATR 72', stand: 'D03', assignedTeam: 'Team 3', status: 'PENDING', sta: '10:00', eta: '10:30', std: '11:15' },
  { id: 'df4', flightNumber: 'VP 601', aircraftReg: '8Q-VAA', aircraftType: 'ATR 72', stand: 'D04', assignedTeam: 'Team 1', status: 'PENDING', sta: '11:15', eta: '11:45', std: '12:30' },
];

export const MOCK_ADHOC_FLIGHTS: FlightJob[] = [
  { id: 'ah1', flightNumber: 'AH 001', aircraftReg: '8Q-ADH', aircraftType: 'B737', stand: 'F10', status: 'PENDING', sta: '14:00', eta: '14:30', std: '15:30', route: 'MLE', isAdhoc: true },
  { id: 'ah2', flightNumber: 'AH 002', aircraftReg: 'A6-VIP', aircraftType: 'A320', stand: 'F12', status: 'PENDING', sta: '16:00', eta: '16:15', std: '17:00', route: 'DXB ➔ MLE', isAdhoc: true },
];

export const TANKS: Tank[] = [
  // OLD FUEL FARM
  { id: 'tk4', name: 'TK-4 (OFF)', type: FuelType.JET_A1, capacity: 2200000, currentLevel: 450000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk6', name: 'TK-6 (OFF)', type: FuelType.JET_A1, capacity: 2200000, currentLevel: 620000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk7', name: 'TK-7 (OFF)', type: FuelType.JET_A1, capacity: 3300000, currentLevel: 380000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk8', name: 'TK-8 (OFF)', type: FuelType.JET_A1, capacity: 3300000, currentLevel: 710000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'tk9', name: 'TK-9 (OFF)', type: FuelType.JET_A1, capacity: 3300000, currentLevel: 540000, safeMinLevel: 100000, lastUpdated: new Date().toISOString() },
  { id: 'off-diesel', name: 'Diesel Tank (OFF)', type: FuelType.DIESEL, capacity: 50000, currentLevel: 32000, safeMinLevel: 5000, lastUpdated: new Date().toISOString() },
  { id: 'off-petrol', name: 'Petrol Tank (OFF)', type: FuelType.PETROL, capacity: 20000, currentLevel: 15000, safeMinLevel: 2000, lastUpdated: new Date().toISOString() },
  
  // NEW FUEL FARM
  { id: 'tk101', name: 'TK-101 (NFF)', type: FuelType.JET_A1, capacity: 14500000, currentLevel: 3200000, safeMinLevel: 500000, lastUpdated: new Date().toISOString() },
  { id: 'tk102', name: 'TK-102 (NFF)', type: FuelType.JET_A1, capacity: 14500000, currentLevel: 4100000, safeMinLevel: 500000, lastUpdated: new Date().toISOString() },
  { id: 'tk103', name: 'TK-103 (NFF)', type: FuelType.JET_A1, capacity: 14500000, currentLevel: 2800000, safeMinLevel: 500000, lastUpdated: new Date().toISOString() },
  { id: 'tk106', name: 'Recovery Tank TK-106 (NFF)', type: FuelType.JET_A1, capacity: 100000, currentLevel: 12000, safeMinLevel: 5000, lastUpdated: new Date().toISOString() },
  { id: 'tk201', name: 'Diesel TK-201 (NFF)', type: FuelType.DIESEL, capacity: 500000, currentLevel: 75000, safeMinLevel: 10000, lastUpdated: new Date().toISOString() },
  { id: 'tk202', name: 'Diesel TK-202 (NFF)', type: FuelType.DIESEL, capacity: 500000, currentLevel: 68000, safeMinLevel: 10000, lastUpdated: new Date().toISOString() },
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
  ...Object.entries({
    'RF-02': 58000, 'RF-04': 19000, 'RF-06': 58000, 'RF-07': 58000, 'RF-10': 58000,
    'RF-11': 58000, 'RF-12': 16400, 'RF-14': 20000, 'RF-15': 20000, 'RF-16': 19000, 'RF-17': 19000
  }).map(([id, maxCapacity], idx) => ({
    id, name: id, type: EquipmentType.REFUELLER, status: EquipmentStatus.AVAILABLE, 
    currentVolume: Math.floor(maxCapacity * (0.2 + (idx * 0.07) % 0.6)), maxCapacity, lastUpdated: new Date().toISOString()
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

export const PIT_MAPPING = [
  { pit: 'J120-1', stand: 'A2' },
  { pit: 'J119-1', stand: 'A3' },
  { pit: 'J118-1', stand: 'A4' },
  { pit: 'J117-1', stand: 'A5' },
  { pit: 'J116-1', stand: 'A6' },
  { pit: 'J115-1', stand: 'A7' },
  { pit: 'J115-2', stand: 'A7' },
  { pit: 'J114-1', stand: 'A8' },
  { pit: 'J114-2', stand: 'A8' },
  { pit: 'J113-1', stand: 'A9' },
  { pit: 'J113-2', stand: 'A9' },
  { pit: 'J112R-1', stand: 'ST 1' },
  { pit: 'J112-1', stand: 'ST 1' },
  { pit: 'J112-2', stand: 'ST 1' },
  { pit: 'J112-3', stand: 'ST 1' },
  { pit: 'J112L-1', stand: 'ST 1' },
  { pit: 'J111R-1', stand: 'ST 2' },
  { pit: 'J111-1', stand: 'ST 2' },
  { pit: 'J111-2', stand: 'ST 2' },
  { pit: 'J111-3', stand: 'ST 2' },
  { pit: 'J111L-1', stand: 'ST 2' },
  { pit: 'J110R-1', stand: 'ST 3' },
  { pit: 'J110-2', stand: 'ST 3' },
  { pit: 'J110-1', stand: 'ST 3' },
  { pit: 'J110-3', stand: 'ST 3' },
  { pit: 'J110L-1', stand: 'ST 3' },
  { pit: 'J109R-1', stand: 'ST 4' },
  { pit: 'J109-1', stand: 'ST 4' },
  { pit: 'J109-2', stand: 'ST 4' },
  { pit: 'J109-3', stand: 'ST 4' },
  { pit: 'J109L-1', stand: 'ST 4' },
  { pit: 'J108R-1', stand: 'ST 5' },
  { pit: 'J108L-1', stand: 'ST 5' },
  { pit: 'J108-1', stand: 'ST 5' },
  { pit: 'J108-2', stand: 'ST 5' },
  { pit: 'J108-3', stand: 'ST 5' },
  { pit: 'J107R-1', stand: 'ST 6' },
  { pit: 'J107-1', stand: 'ST 6' },
  { pit: 'J107-2', stand: 'ST 6' },
  { pit: 'J107-3', stand: 'ST 6' },
  { pit: 'J107L-1', stand: 'ST 6' },
  { pit: 'J106R-1', stand: 'ST 7' },
  { pit: 'J106-1', stand: 'ST 7' },
  { pit: 'J106-2', stand: 'ST 7' },
  { pit: 'J106-3', stand: 'ST 7' },
  { pit: 'J106L-1', stand: 'ST 7' },
  { pit: 'J105R-1', stand: 'ST 8' },
  { pit: 'J105-1', stand: 'ST 8' },
  { pit: 'J105-2', stand: 'ST 8' },
  { pit: 'J105-3', stand: 'ST 8' },
  { pit: 'J105L-1', stand: 'ST 8' },
  { pit: 'J104R-1', stand: 'ST 9' },
  { pit: 'J104-1', stand: 'ST 9' },
  { pit: 'J104-2', stand: 'ST 9' },
  { pit: 'J104-3', stand: 'ST 9' },
  { pit: 'J104L-1', stand: 'ST 9' },
  { pit: 'J103-1', stand: 'A10' },
  { pit: 'J103-2', stand: 'A10' },
  { pit: 'J102-1', stand: 'A11' },
  { pit: 'J102-2', stand: 'A11' },
  { pit: 'HP-1', stand: 'EAST' }
];
