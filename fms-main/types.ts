
export enum UserRole {
  ADMIN = 'ADMIN',
  ITP_MANAGER = 'ITP_MANAGER',
  DEPOT_MANAGER = 'DEPOT_MANAGER',
  ITP_OFFICER = 'ITP_OFFICER',
  ITP_OPERATOR = 'ITP_OPERATOR',
  ITP_HD_OPERATOR = 'ITP_HD_OPERATOR',
  DEPOT_OPERATOR = 'DEPOT_OPERATOR',
  EXECUTIVE = 'EXECUTIVE',
  COMMERCIAL = 'COMMERCIAL'
}

export enum EquipmentType {
  REFUELLER = 'Refueller',
  HYDRANT_DISPENSER = 'Hydrant Dispenser',
  DIESEL_TRUCK = 'Diesel Truck',
  HYDRANT_SERVICE = 'Hydrant Service'
}

export enum EquipmentStatus {
  AVAILABLE = 'Available',
  IN_USE = 'In Use',
  MAINTENANCE = 'Maintenance',
  OUT_OF_SERVICE = 'Out of Service',
  REFUELLING = 'Refuelling'
}

export interface MaintenanceDetails {
  jobType: 'MAINTENANCE' | 'BREAKDOWN' | 'ROUTINE SERVICE' | 'MAINTENANCE WORK';
  description: string;
  actionRequiredBy: 'FUEL' | 'PROCUREMENT' | 'MECHANICAL' | 'FUEL MAINTENANCE';
  breakdownDate: string; // YYYY-MM-DD
  expectedReturnDate: string; // YYYY-MM-DD
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  currentVolume: number;
  maxCapacity: number;
  lastUpdated: string;
  maintenanceDetails?: MaintenanceDetails;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: UserRole;
  employeeId: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  joinDate: string;
  avatar?: string;
}

export enum FuelType {
  JET_A1 = 'Jet A-1',
  DIESEL = 'Diesel',
  PETROL = 'Petrol'
}

export interface Tank {
  id: string;
  name: string;
  type: FuelType;
  capacity: number;
  currentLevel: number; // Liters
  safeMinLevel: number;
  lastUpdated: string;
}

export interface FlightJob {
  id: string;
  flightNumber: string;
  aircraftReg: string;
  aircraftType: string;
  stand: string;
  sta?: string;
  eta?: string;
  std?: string;
  assignedTo: string; // User ID
  assignedOfficer?: string; // Officer User ID for Refueller
  equipmentUsage?: 'HYDRANT' | 'REFUELLER';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  vehicleId?: string;
  remarks?: string;
  deliveryNumber?: string;
  pitNumber?: string;
}

export interface FlightLog {
  id: string;
  flightNumber: string;
  aircraftReg: string;
  aircraftType: string;
  stand: string;
  operatorId: string;
  vehicleId: string; // From Mobile_Equipment Table
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  deliveryNumber?: string;
  pitNumber?: string;
  operationalDate?: string;
  
  // Granular Timestamps
  timestampArrived?: string;      // Arrived at Stand
  timestampPosition?: string;     // Positioned at Aircraft
  timestampStart?: string;        // Commenced Pumping
  timestampInitialEnd?: string;   // Initial Stop
  timestampFinalStart?: string;   // Top-up Start (Optional)
  timestampFinalEnd?: string;     // Final Stop / Completed
  timestampClearance?: string;    // Documents signed, leaving safety zone

  // Metering
  meterOpen?: number;
  meterClose?: number;
  volume: number;
  
  // QC (JIG Compliance)
  panelCheck: boolean;        // Panel Closed?
  walkAroundCheck: boolean;   // Walk Around Done?
  appearanceCheck: boolean;   // Clear & Bright?
  waterCheck: boolean;        // Water/Sediments Free?
  remarks?: string;
}

export interface BridgingLog {
  id: string;
  sourceTankId: string;
  vehicleId: string;
  volume: number;
  startTime: string;
  endTime: string;
  visualCheckPassed: boolean;
  cwdCheckPassed: boolean;
  density?: number;
  temperature?: number;
  operatorId: string;
  date?: string;
}

export interface ForecastScenario {
  id: string;
  name: string; // Nominal, Upper, Lower
  description: string;
  data: { day: string; stockLevel: number; threshold: number }[];
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  targetRole?: UserRole;
}
