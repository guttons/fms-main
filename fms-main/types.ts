
export enum UserRole {
  ADMIN = 'ADMIN',
  ITP_MANAGER = 'ITP_MANAGER',
  DEPOT_MANAGER = 'DEPOT_MANAGER',
  ITP_OFFICER = 'ITP_OFFICER',
  ITP_OPERATOR = 'ITP_OPERATOR',
  ITP_HD_OPERATOR = 'ITP_HD_OPERATOR',
  ITP_SUPERVISOR = 'ITP_SUPERVISOR',
  DEPOT_OPERATOR = 'DEPOT_OPERATOR',
  EXECUTIVE = 'EXECUTIVE',
  COMMERCIAL = 'COMMERCIAL',
  FINANCE = 'FINANCE',
  FUEL_MANAGEMENT = 'FUEL_MANAGEMENT',
  CUSTOMER = 'CUSTOMER'
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
  currentStatus?: 'ONLINE' | 'ON_JOB' | 'IDLE' | 'OFFLINE' | 'ON_BREAK';
  currentJobId?: string;
  currentVehicleId?: string;
  lastActiveAt?: string;
  currentLocation?: { lat: number; lng: number; accuracy: number; updatedAt: string; };
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
  assignedTo?: string; // User ID
  assignedOfficer?: string; // Officer User ID for Refueller
  equipmentUsage?: 'HYDRANT' | 'REFUELLER';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | string;
  vehicleId?: string;
  remarks?: string;
  deliveryNumber?: string;
  pitNumber?: string;
  route?: string;
  isAdhoc?: boolean;
  isDomestic?: boolean;
  date?: string;
  isVirtual?: boolean;
  type?: 'arrival' | 'departure';
  fidsStatus?: string;
  landed_alert_sent?: boolean;
  eta_alert_15_sent?: boolean;
  eta_alert_5_sent?: boolean;
  tobt?: string;                 // Target Off-Block Time (DEP STD change)
  frtAirline?: string;           // Fuel Request Time - Airline
  frtAocc?: string;              // Fuel Request Time - AOCC
  frtFor?: string;               // Fuel Requested For Time
  timestampClearance?: string;   // Ramp clearance / safety zone exit
  co?: string;
  operatorName?: string;
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
  logType?: 'FLIGHT' | 'SEAPLANE' | 'FILLING_STATION' | 'MARINE' | 'BRIDGING';
  
  // Timing & Planning Milestones
  std?: string;                   // Scheduled Time of Departure
  tobt?: string;                  // Target Off-Block Time
  frtAirline?: string;            // Fuel Request Time - Airline
  frtAocc?: string;               // Fuel Request Time - AOCC
  frtFor?: string;                // Fuel Requested For Time

  // Granular Timestamps
  timestampArrived?: string;      // Arrived at Stand
  timestampPosition?: string;     // Positioned at Aircraft
  timestampStart?: string;        // Commenced Pumping (INITIAL SET)
  timestampInitialEnd?: string;   // Initial Stop (INITIAL END)
  timestampFinalStart?: string;   // Top-up Start (FINAL SET - Optional)
  timestampFinalEnd?: string;     // Final Stop / Completed (FINAL END / FUEL END)
  timestampClearance?: string;    // Documents signed, leaving safety zone (CLEARANCE)

  // Metering
  meterOpen?: number;
  meterClose?: number;
  volume: number;
  psi?: number;
  lpm?: number;
  
  // QC (JIG Compliance)
  panelCheck: boolean;        // Panel Closed?
  walkAroundCheck: boolean;   // Walk Around Done?
  appearanceCheck: boolean;   // Clear & Bright?
  waterCheck: boolean;        // Water/Sediments Free?
  remarks?: string;
  co?: string;
  isAdhoc?: boolean;
  route?: string;
  isDomestic?: boolean;
  intDom?: string;
  airline?: string;
  officer?: string;
  operatorName?: string;
  tacticalOperator?: string;
  destination?: string;
  paymentType?: string;
  created_at?: string;
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
  co?: string;
}

export interface ForecastScenario {
  id: string;
  name: string; // Nominal, Upper, Lower
  description: string;
  data: { day: string; stockLevel: number; threshold: number }[];
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'critical' | 'warning';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledged_at?: string;
  acknowledgedBy?: string;
  targetRole?: UserRole;
  alertType?: string;
  flightNumber?: string;
  assignedStaffId?: string;
  metadata?: any;
  senderId?: string;
  senderName?: string;
}

export interface Vessel {
  id: string;
  name: string;
  imo?: string;
  flag?: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface ShipmentData {
  id: string;
  shipmentNumber: string;
  shipmentNoCode?: string;
  vessel: string;
  arrivalDate: string;
  isConfirmed: boolean;
  isCancelled?: boolean;
  orderQtyMt: number;
  averageSales: number;
  deadStock: number;
}

export interface AirlineMaster {
  id: string;
  name: string;
  iataCode?: string;
  icaoCode?: string;
  category?: 'INT' | 'DOM';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlightMaster {
  id: string;
  airlineId: string;
  airlineName: string;
  flightNumber: string;
  route?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AircraftMaster {
  id: string;
  airlineId: string;
  airlineName: string;
  aircraftReg: string;
  aircraftType: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AirlineHierarchyNode {
  airline: AirlineMaster;
  flights: FlightMaster[];
  aircrafts: AircraftMaster[];
}

export interface InternationalSchedule {
  id: string;
  flightNumber: string;
  airlineCode?: string;
  airlineName: string;
  origin: string;
  destination: string;
  sta: string; // Scheduled Time Arrival HH:mm
  std: string; // Scheduled Time Departure HH:mm
  daysOfWeek: number[]; // 1=Mon, 2=Tue ... 7=Sun
  aircraftType: string;
  estimatedUpliftLiters: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string;   // YYYY-MM-DD
  isActive: boolean;
  isDomestic?: boolean;
  season?: string;
  uploadedAt: string;
  uploadedBy?: string;
  sourceFilename?: string;
}

export type CrossCheckStatus = 'MATCHED' | 'RETIMED' | 'AIRCRAFT_SWAP' | 'UNSCHEDULED_ADDITION' | 'CANCELLED_OR_MISSING';

export interface ScheduleCrossCheckResult {
  id: string;
  date: string;
  flightNumber: string;
  airlineName: string;
  status: CrossCheckStatus;
  isDomestic?: boolean;
  scheduledSta?: string;
  actualSta?: string;
  scheduledStd?: string;
  actualStd?: string;
  scheduledAircraft?: string;
  actualAircraft?: string;
  scheduledUplift?: number;
  timeVarianceMins?: number;
  notes: string;
}

export interface PredictiveUpliftForecast {
  date: string;
  dayName: string;
  scheduledFlightCount: number;
  predictedScheduleUplift: number; // Based on uploaded schedule
  historicalBaselineUplift: number; // Based on historical logs
  blendedEstimateUplift: number;   // Hybrid model estimate
  airlineBreakdown: { airline: string; flightCount: number; estimatedUplift: number }[];
}

export interface StaffActivityEntry {
  id: string;
  staffId: string;
  activityType: 'LOGIN' | 'LOGOUT' | 'JOB_START' | 'JOB_COMPLETE' | 'LOCATION_UPDATE' | 'ALERT_ACKNOWLEDGED' | 'STATUS_CHANGE' | 'HEARTBEAT';
  activityData?: {
    flightNumber?: string;
    vehicleId?: string;
    stand?: string;
    gpsLat?: number;
    gpsLng?: number;
    previousStatus?: string;
    newStatus?: string;
    [key: string]: any;
  };
  createdAt: string;
}

export const isDomesticFlight = (flight: any): boolean => {
  if (!flight) return false;
  const no = (flight.flightNumber || '').replace(/\s+/g, '').toUpperCase();
  if (no.startsWith('VP') || no.startsWith('NR')) return true;
  if (flight.isDomestic === true) return true;
  if (flight.category && String(flight.category).toLowerCase() === 'domestic') return true;
  return false;
};

export const cleanRemarks = (rawRemarks?: string | null): string => {
  if (!rawRemarks) return '';
  const trimmed = String(rawRemarks).trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A' || trimmed.toLowerCase() === 'no operational remarks.') return '';
  // Filter out automated migration string "Customer: ..." which was not entered by users
  if (/^Customer\s*:\s*/i.test(trimmed)) {
    const afterCustomer = trimmed.replace(/^Customer\s*:\s*[^;,|.\n]*/i, '').trim();
    const remaining = afterCustomer.replace(/^[,;|\-\s]+/, '').trim();
    return remaining;
  }
  return trimmed;
};

export type DelaySource = 
  | 'INTERNATIONAL (AOCC/AIRLINE)'
  | 'DOMESTIC (AOCC)'
  | 'INT/DOM (MALDIVIAN)'
  | string;

export interface DelayLog {
  id: string;
  date: string;                     // Operational date YYYY-MM-DD
  delayFrom: DelaySource;           // Dropdown: 'INTERNATIONAL (AOCC/AIRLINE)', 'DOMESTIC (AOCC)', 'INT/DOM (MALDIVIAN)'
  operator: string;                 // Airline / Operator name
  flightNumber: string;             // Flight Number e.g. EK652, Q2 104
  delayCode: string;                // IATA / AOCC Delay Code e.g. 93, 31, 89
  delayReason: string;              // Delay explanation / reason
  remarks?: string;                 // Remarks sent from AOCC / Airline
  fuelTeam?: string;                // Fuel team / crew / vehicle involved
  fuelTeamComment?: string;         // Fuel team's investigation / defense response
  dutyInCharge?: string;            // Duty Officer / Manager in charge
  status?: 'PENDING' | 'RESPONDED' | 'DISPUTED' | 'ACCEPTED';
  flightLogId?: string;             // Linked Flight Log ID for turnaround cross-check
  createdAt?: string;
  updatedAt?: string;
}

