import * as XLSX from 'xlsx/dist/xlsx.full.min.js';
import { InternationalSchedule, ScheduleCrossCheckResult, PredictiveUpliftForecast, FlightJob, FlightLog } from '../types';

export const INITIAL_MOCK_SCHEDULES: InternationalSchedule[] = [
  // ── INTERNATIONAL FLIGHT SCHEDULES ──
  { id: 'intl-sch-101', flightNumber: 'EK657', airlineCode: 'EK', airlineName: 'Emirates', origin: 'DXB', destination: 'MLE', sta: '08:30', std: '10:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-102', flightNumber: 'EK657', airlineCode: 'EK', airlineName: 'Emirates', origin: 'DXB', destination: 'MLE', sta: '07:35', std: '09:05', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-103', flightNumber: 'EK659', airlineCode: 'EK', airlineName: 'Emirates', origin: 'DXB', destination: 'MLE', sta: '09:25', std: '10:55', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-104', flightNumber: 'QR673', airlineCode: 'QR', airlineName: 'Qatar Airways', origin: 'DOH', destination: 'MLE', sta: '08:05', std: '19:50', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-105', flightNumber: 'QR677', airlineCode: 'QR', airlineName: 'Qatar Airways', origin: 'DOH', destination: 'MLE', sta: '07:50', std: '09:40', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-106', flightNumber: 'QR671', airlineCode: 'QR', airlineName: 'Qatar Airways', origin: 'DOH', destination: 'MLE', sta: '08:25', std: '20:45', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320-200', estimatedUpliftLiters: 16500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-107', flightNumber: 'FZ1208', airlineCode: 'FZ', airlineName: 'Fly Dubai', origin: 'DXB', destination: 'MLE', sta: '06:45', std: '10:10', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B737 MAX 8', estimatedUpliftLiters: 17000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-108', flightNumber: 'FZ1026', airlineCode: 'FZ', airlineName: 'Fly Dubai', origin: 'DXB', destination: 'MLE', sta: '07:15', std: '08:15', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B737 MAX 8', estimatedUpliftLiters: 17000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-109', flightNumber: 'SU321', airlineCode: 'SU', airlineName: 'Aeroflot', origin: 'SVO', destination: 'MLE', sta: '09:20', std: '11:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 75000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-110', flightNumber: 'EY379', airlineCode: 'EY', airlineName: 'Etihad Airways', origin: 'AUH', destination: 'MLE', sta: '05:05', std: '09:35', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-10', estimatedUpliftLiters: 42000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-111', flightNumber: 'EY373', airlineCode: 'EY', airlineName: 'Etihad Airways', origin: 'AUH', destination: 'MLE', sta: '07:25', std: '09:10', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-10', estimatedUpliftLiters: 42000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-112', flightNumber: 'SQ437', airlineCode: 'SQ', airlineName: 'Singapore Airlines', origin: 'SIN', destination: 'MLE', sta: '22:10', std: '23:25', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-10', estimatedUpliftLiters: 39000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-113', flightNumber: 'BA060', airlineCode: 'BA', airlineName: 'British Airways', origin: 'LHR', destination: 'MLE', sta: '09:40', std: '11:40', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-200ER', estimatedUpliftLiters: 72000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-114', flightNumber: 'UL102', airlineCode: 'UL', airlineName: 'SriLankan Airlines', origin: 'CMB', destination: 'MLE', sta: '08:15', std: '09:25', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A330-300', estimatedUpliftLiters: 28000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-115', flightNumber: 'G9094', airlineCode: 'G9', airlineName: 'Air Arabia', origin: 'SHJ', destination: 'MLE', sta: '08:10', std: '09:10', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320-200', estimatedUpliftLiters: 16500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-116', flightNumber: 'G9092', airlineCode: 'G9', airlineName: 'Air Arabia', origin: 'SHJ', destination: 'MLE', sta: '13:20', std: '14:20', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320-200', estimatedUpliftLiters: 16500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-117', flightNumber: 'AK075', airlineCode: 'AK', airlineName: 'Air Asia', origin: 'KUL', destination: 'MLE', sta: '09:50', std: '10:45', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 18000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-118', flightNumber: 'AK073', airlineCode: 'AK', airlineName: 'Air Asia', origin: 'KUL', destination: 'MLE', sta: '20:30', std: '21:30', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 18000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-119', flightNumber: 'TK741', airlineCode: 'TK', airlineName: 'Turkish Airlines', origin: 'IST', destination: 'MLE', sta: '07:40', std: '09:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-9', estimatedUpliftLiters: 44000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-120', flightNumber: 'GF144', airlineCode: 'GF', airlineName: 'Gulf Air', origin: 'BAH', destination: 'MLE', sta: '06:35', std: '07:35', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 16000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-121', flightNumber: 'AI2240', airlineCode: 'AI', airlineName: 'Air India', origin: 'DEL', destination: 'MLE', sta: '11:50', std: '12:50', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 14500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-122', flightNumber: 'MH484', airlineCode: 'MH', airlineName: 'Malaysia Airlines', origin: 'KUL', destination: 'MLE', sta: '10:55', std: '12:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B737 MAX 8', estimatedUpliftLiters: 17500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },

  // ── DOMESTIC FLIGHT SCHEDULES ──
  { id: 'dom-sch-101', flightNumber: 'NR418', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DDD', sta: '', std: '07:30', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-102', flightNumber: 'NR400', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DDD', sta: '', std: '11:30', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-103', flightNumber: 'NR402', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DDD', sta: '', std: '14:15', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-104', flightNumber: 'NR404', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DDD', sta: '', std: '17:45', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-105', flightNumber: 'NR420', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DDD', sta: '', std: '22:15', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-106', flightNumber: 'NR538', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DRV', sta: '', std: '10:15', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-107', flightNumber: 'NR530', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DRV', sta: '', std: '12:30', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-108', flightNumber: 'NR534', airlineCode: 'NR', airlineName: 'Manta Air', origin: 'MLE', destination: 'DRV', sta: '', std: '17:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1850, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-109', flightNumber: 'VP606', airlineCode: 'VP', airlineName: 'Flyme', origin: 'MLE', destination: 'VAM', sta: '', std: '13:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-500', estimatedUpliftLiters: 1750, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-110', flightNumber: 'VP610', airlineCode: 'VP', airlineName: 'Flyme', origin: 'MLE', destination: 'VAM', sta: '', std: '17:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-500', estimatedUpliftLiters: 1750, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-111', flightNumber: 'Q2102', airlineCode: 'Q2', airlineName: 'Maldivian', origin: 'MLE', destination: 'GAN', sta: '', std: '12:05', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1950, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-112', flightNumber: 'Q2106', airlineCode: 'Q2', airlineName: 'Maldivian', origin: 'MLE', destination: 'GAN', sta: '', std: '16:45', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'ATR72-600', estimatedUpliftLiters: 1950, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-113', flightNumber: 'Q22108', airlineCode: 'Q2', airlineName: 'Maldivian', origin: 'MLE', destination: 'GAN', sta: '', std: '09:00', daysOfWeek: [4, 7], aircraftType: 'A330-200', estimatedUpliftLiters: 14000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-114', flightNumber: 'Q22143', airlineCode: 'Q2', airlineName: 'Maldivian', origin: 'MLE', destination: 'KDM', sta: '', std: '14:50', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'DH8', estimatedUpliftLiters: 1400, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-115', flightNumber: 'Q2125', airlineCode: 'Q2', airlineName: 'Maldivian', origin: 'MLE', destination: 'FVM', sta: '', std: '18:40', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'DH8', estimatedUpliftLiters: 1400, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' },
  { id: 'dom-sch-116', flightNumber: 'Q2325', airlineCode: 'Q2', airlineName: 'Maldivian', origin: 'MLE', destination: 'DRV', sta: '', std: '21:10', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'DH8', estimatedUpliftLiters: 1400, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: true, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'Summer_Schedule_2026.xlsx' }
];

export const scheduleImportService = {
  /**
   * Generates a sample CSV format for upcoming international schedule uploads
   */
  getSampleCsvTemplate(): string {
    return `flight_number,airline_code,airline_name,origin,destination,sta,std,days_of_week,aircraft_type,estimated_uplift_liters,effective_from,effective_to
EK652,EK,Emirates,DXB,MLE,08:30,10:00,1-2-3-4-5-6-7,B777-300ER,48000,2026-08-01,2026-10-31
QR672,QR,Qatar Airways,DOH,MLE,15:15,16:45,1-3-5-7,A350-900,42000,2026-08-01,2026-10-31
SQ438,SQ,Singapore Airlines,SIN,MLE,22:10,23:25,1-2-3-4-5-6-7,B787-10,39000,2026-08-01,2026-10-31
BA061,BA,British Airways,LHR,MLE,09:45,11:30,2-4-6,B777-200ER,56000,2026-08-01,2026-10-31
SU320,SU,Aeroflot,SVO,MLE,07:20,09:00,1-3-6,B777-300ER,52000,2026-08-01,2026-10-31`;
  },

  /**
   * MACL Days of Ops positional decoder.
   * MACL uses a 7-digit string where each position represents a day of the week (Mon=1 to Sun=7).
   * If the digit at position N equals N, that day is active; 0 means inactive.
   * Examples:
   *   1234567 → all days [1,2,3,4,5,6,7]
   *   0030507 → Wed/Fri/Sun [3,5,7]
   *   0004060 → Thu/Sat [4,6]
   *   0030000 → Wed only [3]
   *   1000000 → Mon only [1]
   *   0200000 → Tue only [2]
   *   1204060 → Mon/Tue/Thu/Sat [1,2,4,6]
   */
  parseDaysOfOps(raw: any): number[] {
    if (raw === undefined || raw === null) return [1, 2, 3, 4, 5, 6, 7];
    const str = String(raw).trim();
    if (!str) return [1, 2, 3, 4, 5, 6, 7];

    // Handle dash-separated format (e.g., "1-2-3-4-5-6-7" from CSV)
    if (str.includes('-')) {
      const parts = str.split('-').map(p => parseInt(p.trim(), 10)).filter(n => n >= 1 && n <= 7);
      return parts.length > 0 ? parts : [1, 2, 3, 4, 5, 6, 7];
    }

    // MACL 7-digit positional encoding
    const padded = str.padStart(7, '0');
    const days: number[] = [];
    for (let i = 0; i < 7; i++) {
      const ch = parseInt(padded[i], 10);
      if (ch === i + 1) {
        days.push(ch);
      }
    }
    return days.length > 0 ? days : [1, 2, 3, 4, 5, 6, 7];
  },

  /**
   * MACL Military Time decoder (e.g., 925 -> 09:25, 1115 -> 11:15, 810 -> 08:10)
   */
  parseMaclTime(raw: any): string {
    if (raw === undefined || raw === null) return '';
    const str = String(raw).trim();
    if (!str || str === '-' || str === 'N/A') return '';

    if (str.includes(':')) return str;

    const num = parseInt(str.replace(/\D/g, ''), 10);
    if (isNaN(num)) return '';

    const padded = String(num).padStart(4, '0');
    const hh = padded.slice(0, 2);
    const mm = padded.slice(2, 4);
    if (parseInt(hh, 10) < 24 && parseInt(mm, 10) < 60) {
      return `${hh}:${mm}`;
    }
    return str;
  },

  /**
   * MACL Date Range decoder (e.g., "25.10.26-27.03.27" -> { effectiveFrom: "2026-10-25", effectiveTo: "2027-03-27" })
   */
  parseMaclDateRange(raw: any): { effectiveFrom: string; effectiveTo: string } {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultEnd = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

    if (!raw) return { effectiveFrom: todayStr, effectiveTo: defaultEnd };
    const str = String(raw).trim();
    if (!str) return { effectiveFrom: todayStr, effectiveTo: defaultEnd };

    const parts = str.split(/[-–—to]+/i).map(p => p.trim());

    const parseSingleDate = (dStr: string): string | null => {
      if (!dStr) return null;
      // DD.MM.YY or DD.MM.YYYY
      const dotMatch = dStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      if (dotMatch) {
        const dd = dotMatch[1].padStart(2, '0');
        const mm = dotMatch[2].padStart(2, '0');
        let yy = dotMatch[3];
        if (yy.length === 2) yy = `20${yy}`;
        return `${yy}-${mm}-${dd}`;
      }
      // ISO YYYY-MM-DD
      const isoMatch = dStr.match(/^\d{4}-\d{2}-\d{2}$/);
      if (isoMatch) return dStr;
      return null;
    };

    const fromDate = parseSingleDate(parts[0]) || todayStr;
    const toDate = parts.length > 1 ? (parseSingleDate(parts[1]) || defaultEnd) : fromDate;

    return { effectiveFrom: fromDate, effectiveTo: toDate };
  },

  /**
   * Standardizes MACL paired turnaround flight numbers to Departure Flight Number
   * e.g. BA061-0 -> BA060 (Departure leg to LHR)
   * e.g. AK074-5 -> AK075 (Departure leg to KUL)
   * e.g. G9091-2 -> G9092 (Departure leg to SHJ)
   * e.g. EY378-9 -> EY379 (Departure leg to AUH)
   * e.g. SU320-1 -> SU321 (Departure leg to SVO)
   * e.g. QR676-7 -> QR677 (Departure leg to DOH)
   * e.g. AI2239-40 -> AI2240 (Departure leg to DEL)
   */
  parseMaclDepartureFlightNo(rawFlt: string): string {
    const clean = (rawFlt || '').trim().replace(/\s+/g, '').toUpperCase();
    if (clean.includes('-')) {
      const parts = clean.split('-');
      const arr = parts[0];
      const depSuffix = parts[1];
      if (depSuffix && /^\d+$/.test(depSuffix)) {
        const match = arr.match(/^([A-Z0-9]{2,3})(\d+)$/);
        if (match) {
          const code = match[1];
          const arrDigits = match[2];
          const suffixLen = depSuffix.length;
          const depDigits = arrDigits.slice(0, arrDigits.length - suffixLen) + depSuffix;
          return code + depDigits;
        }
      }
      return parts[0]; // Fallback to first flight number
    }
    return clean;
  },

  /**
   * Auto-estimate Jet A-1 fuel uplift in liters based on route distance, seat capacity & aircraft model
   */
  estimateUpliftByRouteAndAircraft(seats: number, acType: string, route: string = '', isDomestic: boolean = false): number {
    const uAC = (acType || '').toUpperCase();
    const uRoute = (route || '').toUpperCase();

    if (isDomestic) {
      if (uAC.includes('A330')) return 14000;
      if (uAC.includes('ATR')) return Math.max(1800, Math.round((seats || 64) * 28));
      if (uAC.includes('DH8') || uAC.includes('DASH')) return Math.max(1300, Math.round((seats || 50) * 26));
      return Math.max(1500, Math.round((seats || 50) * 30));
    }

    // European / Russian / American Long-Haul (> 9 - 11 hrs flight time)
    const isLongHaul = ['LHR', 'LGW', 'CDG', 'FRA', 'ZRH', 'SVO', 'VKO', 'ORY', 'MXP', 'FCO', 'VIE', 'MAN', 'MAD', 'BRU', 'BER'].some(d => uRoute.includes(d));
    if (isLongHaul) {
      if (uAC.includes('777') || uAC.includes('77W') || uAC.includes('772') || uAC.includes('350') || uAC.includes('359') || uAC.includes('340') || uAC.includes('787') || uAC.includes('330')) {
        return seats > 0 ? Math.round(seats * 200) : 72000;
      }
    }

    // Middle East / Far East / China Medium-Haul (4 - 6 hrs flight time)
    const isMediumHaul = ['DXB', 'DOH', 'AUH', 'SHJ', 'KUL', 'SIN', 'PVG', 'CAN', 'HKG', 'ICN', 'NRT', 'IST', 'NQZ', 'ALA', 'CGK', 'BKK'].some(d => uRoute.includes(d));
    if (isMediumHaul) {
      if (uAC.includes('777') || uAC.includes('77W') || uAC.includes('350') || uAC.includes('359') || uAC.includes('787') || uAC.includes('330')) {
        return seats > 0 ? Math.round(seats * 125) : 48000;
      }
      if (uAC.includes('320') || uAC.includes('321') || uAC.includes('32Q') || uAC.includes('737') || uAC.includes('73H') || uAC.includes('73M') || uAC.includes('B73M')) {
        return seats > 0 ? Math.round(seats * 95) : 17500;
      }
    }

    // Regional Short-Haul (1.5 - 3 hrs flight time)
    const isRegional = ['CMB', 'DEL', 'TRV', 'COK', 'MAA', 'BOM', 'BLR', 'GAN', 'DAC'].some(d => uRoute.includes(d));
    if (isRegional) {
      if (uAC.includes('330') || uAC.includes('787')) return seats > 0 ? Math.round(seats * 90) : 28000;
      return seats > 0 ? Math.round(seats * 75) : 14000;
    }

    // Fallback by aircraft model
    if (uAC.includes('777') || uAC.includes('77W') || uAC.includes('350') || uAC.includes('359') || uAC.includes('340') || uAC.includes('787') || uAC.includes('330')) {
      return seats > 0 ? Math.round(seats * 140) : 52000;
    }
    if (uAC.includes('320') || uAC.includes('321') || uAC.includes('32Q') || uAC.includes('737') || uAC.includes('73H')) {
      return seats > 0 ? Math.round(seats * 85) : 16500;
    }
    return 35000;
  },

  /**
   * Normalizes and cleans up airline names (fixing typos like CHINA EASTHERN AIRLINES -> China Eastern Airlines)
   * and standardizes naming to prevent duplicated dropdown entries.
   */
  normalizeAirlineName(raw: string): string {
    if (!raw) return 'International Carrier';
    const clean = raw.trim().replace(/\s+/g, ' ');
    const upper = clean.toUpperCase();

    if (upper.includes('CHINA EASTHERN') || upper.includes('CHINA EASTERN')) return 'China Eastern Airlines';
    if (upper.includes('MAVDIVIAN') || upper.includes('MALDIVIAN')) return 'Maldivian';
    if (upper.includes('BRITISH AIRWAY')) return 'British Airways';
    if (upper.includes('EMIRATE')) return 'Emirates';
    if (upper.includes('ETIHAD')) return 'Etihad Airways';
    if (upper.includes('QATAR')) return 'Qatar Airways';
    if (upper.includes('AEROFLOT')) return 'Aeroflot';
    if (upper.includes('SRILANKAN') || upper.includes('SRI LANKAN')) return 'SriLankan Airlines';
    if (upper.includes('FLY DUBAI') || upper.includes('FLYDUBAI')) return 'Fly Dubai';
    if (upper.includes('AIR ARABIA')) return 'Air Arabia';
    if (upper.includes('AIR ASIA') || upper.includes('AIRASIA')) return 'Air Asia';
    if (upper.includes('MANTA')) return 'Manta Air';
    if (upper.includes('FLYME') || upper.includes('VILLA')) return 'Flyme';
    if (upper.includes('GULF AIR')) return 'Gulf Air';
    if (upper.includes('AIR INDIA')) return 'Air India';
    if (upper.includes('MALAYSIA AIRLINES')) return 'Malaysia Airlines';
    if (upper.includes('SINGAPORE AIRLINES')) return 'Singapore Airlines';
    if (upper.includes('TURKISH AIRLINES')) return 'Turkish Airlines';
    if (upper.includes('CENTRUM AIR')) return 'Centrum Air';
    if (upper.includes('BEIJING CAPITAL')) return 'Beijing Capital Airlines';
    if (upper.includes('BATIK AIR')) return 'Batik Air';
    if (upper.includes('BANGKOK AIRWAYS')) return 'Bangkok Airways';
    if (upper.includes('BELAVIA')) return 'Belavia Airlines';
    if (upper.includes('CHONGQING')) return 'Chongqing Airlines';
    if (upper.includes('CONDOR')) return 'Condor';
    if (upper.includes('EDELWEISS')) return 'Edelweiss Air';
    if (upper.includes('EUROWINGS')) return 'Eurowings';
    if (upper.includes('FITS AIR')) return 'Fits Air';
    if (upper.includes('BEOND')) return 'Beond';
    if (upper.includes('SICHUAN') || upper.includes('SUCHUAN')) return 'Sichuan Airlines';
    if (upper.includes('SAUDIA') || upper.includes('SAUDI')) return 'Saudia';
    if (upper.includes('AIR FRANCE')) return 'Air France';
    if (upper.includes('LUFTHANSA')) return 'Lufthansa';
    if (upper.includes('LOT POLISH')) return 'LOT Polish Airlines';
    if (upper.includes('NEOS')) return 'Neos';
    if (upper.includes('US-BANGLA') || upper.includes('USBANGLA')) return 'US-Bangla Airlines';

    return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  },

  /**
   * Normalizes aircraft ICAO/IATA shorthand codes (e.g. B77W -> B777, A32Q -> A321, A32N -> A320, 7M8 -> B737)
   * into clean standard aircraft model names.
   */
  normalizeAircraftType(raw: string): string {
    if (!raw || raw.toUpperCase().includes('WIDEBODY')) return 'A320';
    const u = raw.trim().toUpperCase();

    // Airbus A321 variations (A32Q, 32Q, A21N, 321N, A321N, A321NEO, A321, 321)
    if (u.includes('A32Q') || u.includes('32Q') || u.includes('A21N') || u.includes('321N') || u.includes('A321N') || u.includes('A321') || u.includes('321')) return 'A321';

    // Airbus A320 variations (A32N, A20N, 32N, 320N, A320N, A320NEO, A320, 320)
    if (u.includes('A32N') || u.includes('A20N') || u.includes('32N') || u.includes('320N') || u.includes('A320N') || u.includes('A320') || u.includes('320')) return 'A320';

    // Boeing 777 variations (B77W, 77W, B773, B772, B777, 773, 772, 777)
    if (u.includes('77W') || u.includes('B773') || u.includes('773') || u.includes('772') || u.includes('777')) return 'B777';

    // Airbus A350 variations (A359, A351, 359, 351, 350, A350)
    if (u.includes('A359') || u.includes('A351') || u.includes('359') || u.includes('351') || u.includes('350')) return 'A350';

    // Boeing 737 variations (7M8, 7M9, 7M7, 738, B738, B737, 737)
    if (u.includes('7M8') || u.includes('7M9') || u.includes('7M7') || u.includes('738') || u.includes('B738') || u.includes('737')) return 'B737';

    // Airbus A330 variations (A332, A333, A339, A330, 332, 333, 339, 330)
    if (u.includes('A332') || u.includes('A333') || u.includes('A339') || u.includes('332') || u.includes('333') || u.includes('339') || u.includes('330')) return 'A330';

    // Boeing 787 variations (B788, B789, B78X, B787, 788, 789, 78X, 787)
    if (u.includes('B788') || u.includes('B789') || u.includes('B78X') || u.includes('B787') || u.includes('788') || u.includes('789') || u.includes('787')) return 'B787';

    // ATR variations (AT76, AT7, ATR, ATR72, ATR-72)
    if (u.includes('AT7') || u.includes('ATR')) return 'ATR72';

    // Dash 8 variations (DH8, DH8D, DASH8, DASH)
    if (u.includes('DH8') || u.includes('DASH')) return 'Dash 8';

    // Embraer variations (E190, E195, EMB)
    if (u.includes('E190') || u.includes('E195') || u.includes('EMB')) return 'Embraer 190';

    return u;
  },

  /**
   * Intelligently estimates aircraft model based on airline IATA code and route length
   * when no explicit master schedule entry is found, avoiding generic "Widebody" fallback.
   */
  getSmartAircraftFallback(flightNo: string, routeStr: string = ''): string {
    const code = (flightNo || '').trim().replace(/[^A-Z0-9]/g, '').slice(0, 2).toUpperCase();
    const route = (routeStr || '').toUpperCase();

    // Specific airline fleet mappings for Velana International Airport operations
    if (code === 'OD') return 'B737'; // Batik Air B737 MAX 8 / B738
    if (code === 'AK' || code === 'FD') return 'A320'; // AirAsia A320
    if (code === '6E') return 'A320'; // IndiGo A320neo / A321neo
    if (code === 'G9' || code === 'FZ' || code === 'BS') return 'B737'; // Air Arabia / Flydubai / US-Bangla B737
    if (code === '8D' || code === 'C6') return 'A320'; // Fits Air / Centrum Air A320
    if (code === 'Q2' || code === 'NR' || code === 'VP') return 'ATR72'; // Domestic Maldivian / Manta / Flyme
    if (code === 'BA' || code === 'EK') return 'B777'; // British Airways / Emirates B777
    if (code === 'SQ' || code === 'EY') return 'B787'; // Singapore Airlines / Etihad B787
    if (code === 'SU') return 'B777'; // Aeroflot B777-300ER
    if (code === 'UL' || code === 'JD' || code === '3U' || code === 'MU') return 'A330'; // SriLankan / Beijing Capital / Sichuan / China Eastern A330
    if (code === 'TK') return 'A350'; // Turkish Airlines A350
    if (code === 'NO') return 'B787'; // Neos B787

    // Route distance heuristic if airline code is unrecognized
    const isLongHaul = ['LHR', 'CDG', 'FRA', 'SVO', 'VKO', 'FCO', 'MXP', 'ZRH'].some(k => route.includes(k));
    if (isLongHaul) return 'B777';

    return 'A320';
  },

  /**
   * Intelligently formats route to show legs to and from MLE only.
   * e.g., XMN-DAC-MLE-DAC-XMN -> DAC-MLE-DAC
   * e.g., LHR-MLE-LHR -> LHR-MLE-LHR
   * e.g., MLE-DDD -> MLE-DDD
   */
  formatMleRoute(rawRoute: string): { routeStr: string; origin: string; destination: string; departureDest: string } {
    if (!rawRoute || !rawRoute.includes('-')) {
      return { routeStr: rawRoute || 'INT-MLE', origin: 'INT', destination: 'MLE', departureDest: 'MLE' };
    }

    const legs = rawRoute.split('-').map(l => l.trim().toUpperCase()).filter(Boolean);
    const mleIdx = legs.indexOf('MLE');

    if (mleIdx === -1) {
      const origin = legs[0] || 'INT';
      const destination = legs[legs.length - 1] || 'MLE';
      return { routeStr: `${origin}-${destination}`, origin, destination, departureDest: destination };
    }

    const prevLeg = mleIdx > 0 ? legs[mleIdx - 1] : null;
    const nextLeg = mleIdx < legs.length - 1 ? legs[mleIdx + 1] : null;

    if (prevLeg && nextLeg) {
      // Round trip via MLE e.g. XMN-DAC-MLE-DAC-XMN -> DAC-MLE-DAC
      return { routeStr: `${prevLeg}-MLE-${nextLeg}`, origin: prevLeg, destination: 'MLE', departureDest: nextLeg };
    } else if (prevLeg) {
      // Inbound flight e.g. DAC-MLE
      return { routeStr: `${prevLeg}-MLE`, origin: prevLeg, destination: 'MLE', departureDest: 'MLE' };
    } else if (nextLeg) {
      // Outbound flight e.g. MLE-DAC
      return { routeStr: `MLE-${nextLeg}`, origin: 'MLE', destination: nextLeg, departureDest: nextLeg };
    }

    return { routeStr: rawRoute, origin: 'INT', destination: 'MLE', departureDest: 'MLE' };
  },

  /**
   * Returns full formatted route display string (e.g. SVO ➔ MLE ➔ SVO)
   */
  getFullRouteDisplay(sch: InternationalSchedule): string {
    const orig = (sch.origin || 'INT').toUpperCase();
    const dest = (sch.destination || 'MLE').toUpperCase();
    if (orig !== 'MLE' && dest === 'MLE') {
      return `${orig} ➔ MLE ➔ ${orig}`;
    }
    if (orig === 'MLE' && dest !== 'MLE') {
      return `MLE ➔ ${dest}`;
    }
    if (orig !== 'MLE' && dest !== 'MLE') {
      return `${orig} ➔ MLE ➔ ${dest}`;
    }
    return `${orig} ➔ ${dest}`;
  },

  /**
   * Checks if a row in SheetJS worksheet is highlighted red (signifying a cancelled flight)
   */
  isRowHighlightedRed(sheet: any, r: number, maxCol: number = 12): boolean {
    if (!sheet) return false;
    for (let c = 0; c < maxCol; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddress];
      if (!cell) continue;

      // Check text for explicit cancellation keywords
      const valStr = String(cell.v || '').toUpperCase();
      if (valStr.includes('CANCEL') || valStr.includes('CANCELLED') || valStr.includes('CNL')) {
        return true;
      }

      // Check cell styling for red background/foreground fills or red font
      if (cell.s) {
        const s = cell.s;
        const fgRgb = s.fgColor?.rgb || s.fill?.fgColor?.rgb || s.fill?.bgColor?.rgb;
        const bgRgb = s.bgColor?.rgb;
        const fontRgb = s.font?.color?.rgb;

        const isRedHex = (rgb: any) => {
          if (!rgb) return false;
          const str = String(rgb).toUpperCase();
          return str.includes('FF0000') || str.includes('C00000') || str.includes('FFC7CE') ||
                 str.includes('FF9999') || str.includes('E6B8B8') || str.includes('E74C3C') ||
                 str.includes('CB4335') || str.includes('B03A2E') || str.includes('922B21') ||
                 str.includes('78281F') || str.includes('F44336') || str.includes('EF5350') ||
                 str.includes('E57373') || str.includes('FF5252') || str.includes('D32F2F');
        };

        if (isRedHex(fgRgb) || isRedHex(bgRgb) || isRedHex(fontRgb) || s.font?.strike) {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Legacy alias for backward compatibility
   */
  estimateUpliftFromSeats(seats: number, acType: string): number {
    return this.estimateUpliftByRouteAndAircraft(seats, acType, '', false);
  },

  /**
   * Native Excel (.xlsx / .xls) reader supporting raw MACL Slot Coordination workbooks.
   * Parses the "Days of OPS" tab (international) and "Domestic" tab exactly as they appear
   * in the SUMMER/WINTER schedule files — no custom template or column rearrangement needed.
   *
   * Days of OPS tab layout:
   *   B=AIRLINE, C=DAYS OF OPS, D=A/C TYPE, E=ROUTE, F=FLT NO, G=STA, H=STD, I=EFFECTIVE, J=SEATS
   *
   * Domestic tab layout:
   *   A=#, C=AIRLINE, D=Days Of Ops, E=A/C TYPE, F=ROUTE, G=FLT NO, H=STA or STD (per sub-table), I=EFFECTIVE, J=SEATS
   *   Each airline has separate arrival (STA) and departure (STD) sub-tables with their own header rows.
   */
  parseScheduleExcel(fileBuffer: ArrayBuffer, fileName: string, uploader: string = 'Admin'): { 
    schedules: InternationalSchedule[]; 
    errors: string[];
    stats: { totalRows: number; parsedCount: number; airlineCount: number; season: string }
  } {
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellStyles: true, cellFormulas: true });
    const schedules: InternationalSchedule[] = [];
    const errors: string[] = [];
    const airlinesSet = new Set<string>();

    // Auto-detect season from filename (e.g., "SUMMER 2026 Ver.08.xlsx", "WINTER 2026-27 Ver.01.xlsx")
    const fileUpper = fileName.toUpperCase();
    let season = 'UNKNOWN';
    if (fileUpper.includes('SUMMER')) season = 'SUMMER';
    else if (fileUpper.includes('WINTER')) season = 'WINTER';
    const yearMatch = fileName.match(/(\d{4})/);
    if (yearMatch) season += ` ${yearMatch[1]}`;

    // Sheet priority: "Days of OPS" and "Domestic" tabs
    let sheetNamesToProcess = workbook.SheetNames.filter(n => 
      n.toLowerCase().includes('days of ops') || n.toLowerCase().includes('domestic')
    );

    if (sheetNamesToProcess.length === 0) {
      // Fallback to all non-cover, non-day-of-week sheets
      sheetNamesToProcess = workbook.SheetNames.filter(n => {
        const lower = n.toLowerCase();
        return !lower.includes('cover') && !['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(lower.trim());
      });
    }

    let totalRowsProcessed = 0;

    // Keywords that indicate a row is a column header, not a data row or airline title
    const HEADER_KEYWORDS = ['AIRLINE', 'DAYS OF OPS', 'DAYS OF OPS', 'A/C TYPE', 'ROUTE', 'FLT NO', 'FLIGHT', 'STA', 'STD', 'EFFECTIVE', 'SEATS'];
    // Keywords that indicate a row is NOT an airline section title
    const NON_TITLE_KEYWORDS = ['AIRLINE', 'SLOT', 'VELANA', 'DAYS OF OPS', 'LAST UPDATED', 'COVER', 'FLT NO', 'ROUTE', 'A/C TYPE', 'STA', 'STD', 'EFFECTIVE', 'SEATS', '#', 'EQUIPMENT'];

    for (const sname of sheetNamesToProcess) {
      const sheet = workbook.Sheets[sname];
      if (!sheet) continue;

      const rawGrid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rawGrid || rawGrid.length === 0) continue;

      const isDomSheet = sname.toLowerCase().includes('domestic');
      let currentAirline = isDomSheet ? 'Domestic Carrier' : 'International Carrier';

      // Per-sub-table column index map — rebuilt each time a header row is detected
      let colIdx: Record<string, number> = {};
      // Track whether current domestic sub-table is STA (arrival) or STD (departure)
      let currentTimeMode: 'sta' | 'std' = 'std';
      let headerFound = false;

      for (let r = 0; r < rawGrid.length; r++) {
        totalRowsProcessed++;
        const row = rawGrid[r].map((c: any) => String(c).trim());
        if (row.every((c: string) => !c)) continue;

        // ─── Step 1: Is this a COLUMN HEADER row? ───
        // A row is a header if it contains 3+ header keywords
        const headerKeywordCount = row.filter((c: string) => {
          const u = c.toUpperCase();
          return HEADER_KEYWORDS.some(kw => u.includes(kw));
        }).length;

        if (headerKeywordCount >= 3) {
          headerFound = true;
          colIdx = {};
          row.forEach((cell: string, idx: number) => {
            const u = cell.toUpperCase();
            if (u.includes('AIRLINE')) colIdx['airline'] = idx;
            if (u.includes('DAYS OF OPS') || u === 'DAYS' || u.includes('DAYS OF OPS')) colIdx['days'] = idx;
            if (u.includes('A/C TYPE') || u.includes('EQUIPMENT') || u.includes('AC TYPE')) colIdx['aircraft'] = idx;
            if (u.includes('ROUTE')) colIdx['route'] = idx;
            if (u.includes('FLT NO') || u.includes('FLIGHT NO')) colIdx['fltNo'] = idx;
            // Track STA and STD as separate indices for international Days of OPS tab
            if (u === 'STA') colIdx['sta'] = idx;
            if (u === 'STD') colIdx['std'] = idx;
            // Also set 'time' for domestic sub-table mode (STA or STD is in same column)
            if (u === 'STA' || u === 'STD') colIdx['time'] = idx;
            if (u.includes('EFFECTIVE')) colIdx['effective'] = idx;
            if (u.includes('SEATS')) colIdx['seats'] = idx;
            if (u.includes('UPLIFT')) colIdx['uplift'] = idx;
          });

          // Detect STA vs STD mode for domestic sub-tables
          const hasSTD = row.some((c: string) => c.toUpperCase() === 'STD');
          const hasSTA = row.some((c: string) => c.toUpperCase() === 'STA');
          if (hasSTD) currentTimeMode = 'std';
          else if (hasSTA) currentTimeMode = 'sta';

          continue;
        }

        // ─── Step 2: Is this an AIRLINE SECTION TITLE row? ───
        // E.g., a row with just "BRITISH AIRWAYS" or "MANTA AIR" in 1-2 cells
        const populatedCells = row.filter((c: string) => c.length > 0);
        const populatedText = populatedCells.join(' ').toUpperCase();
        const isNonTitle = NON_TITLE_KEYWORDS.some(kw => populatedText.includes(kw));
        const isNumericOnly = populatedCells.every((c: string) => /^\d+$/.test(c));
        
        if (populatedCells.length >= 1 && populatedCells.length <= 3 && !isNonTitle && !isNumericOnly) {
          // Check that the longest cell looks like an airline name (all-alpha, > 3 chars)
          const longestCell = populatedCells.reduce((a: string, b: string) => a.length >= b.length ? a : b, '');
          if (longestCell.length > 3 && /[A-Za-z]/.test(longestCell)) {
            currentAirline = this.normalizeAirlineName(longestCell);
            airlinesSet.add(currentAirline);
            continue;
          }
        }

        // ─── Step 3: This should be a DATA ROW — extract flight schedule ───
        if (!headerFound) continue;

        // Skip rows highlighted red (cancelled flights)
        if (this.isRowHighlightedRed(sheet, r, row.length)) {
          continue;
        }

        // Helper to get value from detected column index
        const getCol = (key: string): string => {
          const idx = colIdx[key];
          if (idx !== undefined && row[idx]) return row[idx];
          return '';
        };

        const flightNoRaw = getCol('fltNo');
        if (!flightNoRaw) continue;
        // Skip if the cell still looks like a header keyword
        if (flightNoRaw.toUpperCase().includes('FLT NO') || flightNoRaw.toUpperCase().includes('FLIGHT')) continue;

        const rawAirline = getCol('airline') || currentAirline;
        const airlineNameRow = this.normalizeAirlineName(rawAirline);
        if (airlineNameRow && airlineNameRow.length > 2) {
          airlinesSet.add(airlineNameRow);
        }

        const daysRaw = getCol('days');
        const daysOfWeek = this.parseDaysOfOps(daysRaw);

        const acTypeRaw = getCol('aircraft') || (isDomSheet ? 'ATR72' : 'B777');
        const acType = this.normalizeAircraftType(acTypeRaw);
        const rawRouteStr = getCol('route') || (isDomSheet ? 'MLE-DOM' : 'INT-MLE');

        // ─── Parse Route → format to/from MLE only (e.g. XMN-DAC-MLE-DAC-XMN -> DAC-MLE-DAC) ───
        const routeParsed = this.formatMleRoute(rawRouteStr);
        const route = routeParsed.routeStr;
        const origin = routeParsed.origin;
        const destination = routeParsed.destination;
        const departureDest = routeParsed.departureDest;

        // ─── Parse time based on current sub-table mode (STA vs STD) ───
        let sta = '';
        let std = '';
        if (isDomSheet) {
          // Domestic tab: single time column (STA or STD), mode tracked per sub-table header
          const timeRaw = getCol('time');
          const timeValue = this.parseMaclTime(timeRaw);
          if (currentTimeMode === 'sta') {
            sta = timeValue;
          } else {
            std = timeValue;
          }
        } else {
          // International Days of OPS tab: separate STA and STD columns
          if (colIdx['sta'] !== undefined) {
            sta = this.parseMaclTime(row[colIdx['sta']]);
          }
          if (colIdx['std'] !== undefined) {
            std = this.parseMaclTime(row[colIdx['std']]);
          }
        }

        // ─── Parse Effective Period ───
        const effectiveRaw = getCol('effective');
        let effectiveFrom = season.includes('SUMMER') ? '2026-03-29' : '2026-10-25';
        let effectiveTo = season.includes('SUMMER') ? '2026-10-24' : '2027-03-27';
        if (effectiveRaw && effectiveRaw !== '-' && effectiveRaw.trim() !== '') {
          const parsed = this.parseMaclDateRange(effectiveRaw);
          effectiveFrom = parsed.effectiveFrom;
          effectiveTo = parsed.effectiveTo;
        }

        // ─── Parse Seats ───
        const seatsRaw = getCol('seats');
        const seats = parseInt(seatsRaw, 10) || 0;

        // ─── Standardize flight number (MACL paired → departure flight no) ───
        const flightNumber = this.parseMaclDepartureFlightNo(flightNoRaw);
        const airlineCode = flightNumber.replace(/\d+/g, '').slice(0, 2).toUpperCase() || flightNumber.slice(0, 2).toUpperCase();

        // ─── Detect Domestic Flight ───
        const isDomAirline = ['MANTA', 'FLYME', 'MALDIVIAN', 'MAVDIVIAN', 'VILLA'].some(name => airlineNameRow.toUpperCase().includes(name));
        const isDomCode = ['NR', 'VP', 'Q2'].some(code => flightNumber.startsWith(code));
        const isDomestic = isDomSheet || isDomAirline || isDomCode;

        // ─── Estimate Fuel Uplift using route-distance-aware calculator ───
        const upliftRaw = getCol('uplift');
        let estimatedUplift = upliftRaw ? parseFloat(upliftRaw) : 0;
        if (!estimatedUplift || isNaN(estimatedUplift)) {
          // Use departure destination for fuel estimation (e.g., LHR for long-haul)
          const routeForEstimation = departureDest || destination || route;
          estimatedUplift = this.estimateUpliftByRouteAndAircraft(seats, acType, routeForEstimation, isDomestic);
        }

        const item: InternationalSchedule = {
          id: `intl-sch-xl-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
          flightNumber,
          airlineCode,
          airlineName: airlineNameRow,
          origin,
          destination,
          sta: sta || '',
          std: std || '',
          daysOfWeek,
          aircraftType: acType,
          estimatedUpliftLiters: estimatedUplift,
          effectiveFrom,
          effectiveTo,
          isActive: true,
          isDomestic,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploader,
          sourceFilename: fileName
        };

        schedules.push(item);
      }
    }

    // Deduplicate schedules by flightNumber + daysOfWeek + effectiveFrom
    const uniqueMap = new Map<string, InternationalSchedule>();
    for (const sch of schedules) {
      const key = `${sch.flightNumber}-${sch.daysOfWeek.join(',')}-${sch.effectiveFrom}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, sch);
      }
    }

    const deduplicated = Array.from(uniqueMap.values());

    return {
      schedules: deduplicated,
      errors,
      stats: {
        totalRows: totalRowsProcessed,
        parsedCount: deduplicated.length,
        airlineCount: airlinesSet.size,
        season
      }
    };
  },

  /**
   * Parse CSV content into InternationalSchedule items with validation
   */
  parseScheduleCsv(csvContent: string, fileName: string, uploader: string = 'Admin'): { schedules: InternationalSchedule[]; errors: string[] } {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      return { schedules: [], errors: ['File is empty or missing header row'] };
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\"\']/g, ''));
    const schedules: InternationalSchedule[] = [];
    const errors: string[] = [];

    const getColIndex = (names: string[]) => {
      for (const name of names) {
        const idx = header.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const fnIdx = getColIndex(['flight_number', 'flightnumber', 'flight_no', 'flightno']);
    const codeIdx = getColIndex(['airline_code', 'airlinecode', 'iata']);
    const nameIdx = getColIndex(['airline_name', 'airlinename', 'airline']);
    const origIdx = getColIndex(['origin', 'from', 'src']);
    const destIdx = getColIndex(['destination', 'to', 'dest']);
    const staIdx = getColIndex(['sta', 'arr_time', 'arrival']);
    const stdIdx = getColIndex(['std', 'dep_time', 'departure']);
    const daysIdx = getColIndex(['days_of_week', 'days', 'days_week', 'frequency']);
    const acIdx = getColIndex(['aircraft_type', 'aircrafttype', 'ac_type', 'equipment']);
    const upIdx = getColIndex(['estimated_uplift_liters', 'estimated_uplift', 'uplift', 'fuel_liters']);
    const fromIdx = getColIndex(['effective_from', 'effectivefrom', 'start_date']);
    const toIdx = getColIndex(['effective_to', 'effectiveto', 'end_date']);

    if (fnIdx === -1) {
      return { schedules: [], errors: ['Missing required column: "flight_number"'] };
    }

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(c => c.trim().replace(/[\"\']/g, ''));
      if (row.length <= 1) continue;

      const flightNo = row[fnIdx];
      if (!flightNo) {
        errors.push(`Row ${i + 1}: Missing flight number`);
        continue;
      }

      let daysOfWeek = this.parseDaysOfOps(daysIdx !== -1 ? row[daysIdx] : '1234567');
      const estimatedUplift = upIdx !== -1 && row[upIdx] ? parseFloat(row[upIdx]) || 40000 : 40000;
      const todayStr = new Date().toISOString().split('T')[0];
      const nextMonthStr = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

      const item: InternationalSchedule = {
        id: `intl-sch-${Date.now()}-${i}`,
        flightNumber: flightNo.toUpperCase(),
        airlineCode: codeIdx !== -1 && row[codeIdx] ? row[codeIdx].toUpperCase() : flightNo.slice(0, 2).toUpperCase(),
        airlineName: nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : 'International Carrier',
        origin: origIdx !== -1 && row[origIdx] ? row[origIdx].toUpperCase() : 'INT',
        destination: destIdx !== -1 && row[destIdx] ? row[destIdx].toUpperCase() : 'MLE',
        sta: staIdx !== -1 && row[staIdx] ? row[staIdx] : '12:00',
        std: stdIdx !== -1 && row[stdIdx] ? row[stdIdx] : '13:30',
        daysOfWeek,
        aircraftType: this.normalizeAircraftType(acIdx !== -1 && row[acIdx] ? row[acIdx] : 'Widebody Heavy'),
        estimatedUpliftLiters: estimatedUplift,
        effectiveFrom: fromIdx !== -1 && row[fromIdx] ? row[fromIdx] : todayStr,
        effectiveTo: toIdx !== -1 && row[toIdx] ? row[toIdx] : nextMonthStr,
        isActive: true,
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploader,
        sourceFilename: fileName
      };

      schedules.push(item);
    }

    return { schedules, errors };
  },

  /**
   * Cross-check daily flight jobs against uploaded international/domestic schedules
   */
  crossCheckDailyFlights(
    dateStr: string,
    dailyJobs: FlightJob[],
    schedules: InternationalSchedule[]
  ): ScheduleCrossCheckResult[] {
    const targetDate = new Date(dateStr);
    const jsDay = targetDate.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const activeSchedules = schedules.filter(sch => {
      if (sch.isActive === false) return false;
      
      const normFrom = sch.effectiveFrom ? sch.effectiveFrom.split('T')[0] : '';
      const normTo = sch.effectiveTo ? sch.effectiveTo.split('T')[0] : '';
      
      if (normFrom && normFrom.length === 10 && dateStr < normFrom) return false;
      if (normTo && normTo.length === 10 && dateStr > normTo) return false;
      
      return sch.daysOfWeek && sch.daysOfWeek.length > 0 ? sch.daysOfWeek.includes(dayOfWeek) : true;
    });

    const results: ScheduleCrossCheckResult[] = [];
    const matchedJobIds = new Set<string>();

    const cleanNo = (no?: string) => (no || '').replace(/[\s\-\/]/g, '').toUpperCase();

    const isFlightMatching = (schFlt: string, jobFlt: string): boolean => {
      const cleanA = cleanNo(schFlt);
      const cleanB = cleanNo(jobFlt);
      if (!cleanA || !cleanB) return false;
      if (cleanA === cleanB) return true;

      const depA = cleanNo(this.parseMaclDepartureFlightNo(schFlt));
      const depB = cleanNo(this.parseMaclDepartureFlightNo(jobFlt));
      if (depA && depB && depA === depB) return true;

      // Check airline code + turnaround leg pair (+/- 1 digit)
      const codeA = cleanA.slice(0, 2);
      const codeB = cleanB.slice(0, 2);
      if (codeA === codeB) {
        const numA = parseInt(cleanA.slice(2), 10);
        const numB = parseInt(cleanB.slice(2), 10);
        if (!isNaN(numA) && !isNaN(numB) && Math.abs(numA - numB) <= 1) {
          return true;
        }
      }
      return false;
    };

    for (const sch of activeSchedules) {
      const matchingJob = dailyJobs.find(j => isFlightMatching(sch.flightNumber, j.flightNumber));

      if (matchingJob) {
        matchedJobIds.add(matchingJob.id);
        const actualSta = matchingJob.sta || 'N/A';
        const actualStd = matchingJob.std || 'N/A';
        const actualAc = matchingJob.aircraftType || 'N/A';

        let timeVarianceMins = 0;
        if (sch.sta && matchingJob.sta && matchingJob.sta !== 'N/A') {
          const [sH, sM] = sch.sta.split(':').map(Number);
          const [aH, aM] = matchingJob.sta.split(':').map(Number);
          if (!isNaN(sH) && !isNaN(aH)) {
            timeVarianceMins = (aH * 60 + (aM || 0)) - (sH * 60 + (sM || 0));
          }
        }

        const isRetimed = Math.abs(timeVarianceMins) > 15;
        const isAcSwap = sch.aircraftType && actualAc !== 'N/A' && 
          cleanNo(sch.aircraftType) !== cleanNo(actualAc);

        let status: 'MATCHED' | 'RETIMED' | 'AIRCRAFT_SWAP' = 'MATCHED';
        let notes = 'Flight schedule confirmed and operating as scheduled.';

        if (isAcSwap && isRetimed) {
          status = 'AIRCRAFT_SWAP';
          notes = `Aircraft type changed from ${sch.aircraftType} to ${actualAc} and retimed by ${timeVarianceMins} mins.`;
        } else if (isAcSwap) {
          status = 'AIRCRAFT_SWAP';
          notes = `Aircraft type changed from ${sch.aircraftType} to ${actualAc}.`;
        } else if (isRetimed) {
          status = 'RETIMED';
          notes = `Flight retimed by ${timeVarianceMins > 0 ? '+' : ''}${timeVarianceMins} mins (Scheduled: ${sch.sta}, Actual/ETA: ${matchingJob.sta}).`;
        }

        results.push({
          id: `xcheck-${sch.id}-${dateStr}`,
          date: dateStr,
          flightNumber: sch.flightNumber,
          airlineName: sch.airlineName,
          status,
          scheduledSta: sch.sta,
          actualSta,
          scheduledStd: sch.std,
          actualStd,
          scheduledAircraft: sch.aircraftType,
          actualAircraft: actualAc,
          scheduledUplift: sch.estimatedUpliftLiters,
          timeVarianceMins,
          notes
        });
      } else {
        results.push({
          id: `xcheck-missing-${sch.id}-${dateStr}`,
          date: dateStr,
          flightNumber: sch.flightNumber,
          airlineName: sch.airlineName,
          status: 'CANCELLED_OR_MISSING',
          scheduledSta: sch.sta,
          actualSta: 'Not in FIDS',
          scheduledStd: sch.std,
          actualStd: 'Not in FIDS',
          scheduledAircraft: sch.aircraftType,
          actualAircraft: 'N/A',
          scheduledUplift: sch.estimatedUpliftLiters,
          notes: `Scheduled ${sch.airlineName} flight ${sch.flightNumber} is expected today but not registered in daily dispatch.`
        });
      }
    }

    const unMatchedIntlJobs = dailyJobs.filter(j => 
      !matchedJobIds.has(j.id) && (!j.isDomestic && j.isDomestic !== true)
    );

    for (const job of unMatchedIntlJobs) {
      results.push({
        id: `xcheck-adhoc-${job.id}-${dateStr}`,
        date: dateStr,
        flightNumber: job.flightNumber,
        airlineName: this.normalizeAirlineName(job.flightNumber.slice(0, 2)),
        status: 'UNSCHEDULED_ADDITION',
        scheduledSta: 'Unscheduled',
        actualSta: job.sta || 'N/A',
        scheduledStd: 'Unscheduled',
        actualStd: job.std || 'N/A',
        scheduledAircraft: 'None',
        actualAircraft: job.aircraftType || 'N/A',
        notes: `Unscheduled or ad-hoc international flight operating on ${dateStr}.`
      });
    }

    return results;
  },

  /**
   * Generatively predict future uplift forecasts over N days into the future,
   * combining imported upcoming schedules (international & domestic) with historical fuelling logs
   */
  generatePredictiveUpliftForecast(
    startDateStr: string,
    daysCount: number,
    schedules: InternationalSchedule[],
    historicalLogs: FlightLog[],
    categoryFilter: 'ALL' | 'INT' | 'DOM' = 'ALL'
  ): PredictiveUpliftForecast[] {
    const forecast: PredictiveUpliftForecast[] = [];
    const cleanNo = (no?: string) => (no || '').replace(/\s+/g, '').toUpperCase();

    const isSchDomestic = (sch: InternationalSchedule) => {
      if (sch.isDomestic) return true;
      if (['NR', 'VP', 'Q2'].some(code => sch.flightNumber.startsWith(code))) return true;
      return ['MANTA', 'FLYME', 'MALDIVIAN', 'VILLA'].some(name => sch.airlineName.toUpperCase().includes(name));
    };

    const isLogDomestic = (log: FlightLog) => {
      const uAir = (log.airline || '').toUpperCase();
      const uFlt = (log.flightNumber || '').toUpperCase();
      if (['MANTA', 'FLYME', 'MALDIVIAN', 'VILLA'].some(n => uAir.includes(n))) return true;
      return ['NR', 'VP', 'Q2'].some(c => uFlt.startsWith(c));
    };

    // Filter schedules by selected category
    const categorySchedules = schedules.filter(sch => {
      const isDom = isSchDomestic(sch);
      if (categoryFilter === 'INT') return !isDom;
      if (categoryFilter === 'DOM') return isDom;
      return true;
    });

    // Filter historical logs by selected category
    const categoryLogs = historicalLogs.filter(log => {
      const isDom = isLogDomestic(log);
      if (categoryFilter === 'INT') return !isDom;
      if (categoryFilter === 'DOM') return isDom;
      return true;
    });

    const historicalUpliftMap = new Map<string, { totalVolume: number; count: number }>();
    for (const log of categoryLogs) {
      if (!log.volume || log.volume <= 0) continue;
      const fltNo = cleanNo(log.flightNumber);
      const acType = cleanNo(log.aircraftType);
      const airline = cleanNo(log.airline || log.flightNumber.slice(0, 2));

      const addKey = (k: string) => {
        const existing = historicalUpliftMap.get(k) || { totalVolume: 0, count: 0 };
        existing.totalVolume += log.volume;
        existing.count += 1;
        historicalUpliftMap.set(k, existing);
      };

      if (fltNo && acType) addKey(`flt_ac:${fltNo}-${acType}`);
      if (fltNo) addKey(`flt:${fltNo}`);
      if (airline && acType) addKey(`air_ac:${airline}-${acType}`);
      if (acType) addKey(`ac:${acType}`);
    }

    const startDate = new Date(startDateStr);

    for (let i = 0; i < daysCount; i++) {
      const curDate = new Date(startDate.getTime() + i * 86400000);
      const curDateStr = curDate.toISOString().split('T')[0];
      const jsDay = curDate.getDay();
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[jsDay];

      const daysSchedules = categorySchedules.filter(sch => {
        if (!sch.isActive) return false;
        if (sch.effectiveFrom && curDateStr < sch.effectiveFrom) return false;
        if (sch.effectiveTo && curDateStr > sch.effectiveTo) return false;
        return sch.daysOfWeek.includes(dayOfWeek);
      });

      let totalScheduleUplift = 0;
      let totalHistoricalBaseline = 0;
      const airlineMap = new Map<string, { flightCount: number; estimatedUplift: number }>();

      for (const sch of daysSchedules) {
        const schUplift = sch.estimatedUpliftLiters || (sch.isDomestic ? 2000 : 45000);
        totalScheduleUplift += schUplift;

        const fltNo = cleanNo(sch.flightNumber);
        const acType = cleanNo(sch.aircraftType);
        const airline = cleanNo(sch.airlineCode || sch.airlineName);

        const histData = historicalUpliftMap.get(`flt_ac:${fltNo}-${acType}`) ||
                         historicalUpliftMap.get(`flt:${fltNo}`) ||
                         historicalUpliftMap.get(`air_ac:${airline}-${acType}`) ||
                         historicalUpliftMap.get(`ac:${acType}`);

        const histAvg = histData && histData.count > 0 ? (histData.totalVolume / histData.count) : (schUplift * 0.95);
        totalHistoricalBaseline += histAvg;

        const exAirline = airlineMap.get(sch.airlineName) || { flightCount: 0, estimatedUplift: 0 };
        exAirline.flightCount += 1;
        exAirline.estimatedUplift += Math.round(0.65 * histAvg + 0.35 * schUplift);
        airlineMap.set(sch.airlineName, exAirline);
      }

      const blendedEstimateUplift = Math.round(0.65 * totalHistoricalBaseline + 0.35 * totalScheduleUplift);

      const airlineBreakdown = Array.from(airlineMap.entries()).map(([airline, val]) => ({
        airline,
        flightCount: val.flightCount,
        estimatedUplift: val.estimatedUplift
      }));

      forecast.push({
        date: curDateStr,
        dayName,
        scheduledFlightCount: daysSchedules.length,
        predictedScheduleUplift: Math.round(totalScheduleUplift),
        historicalBaselineUplift: Math.round(totalHistoricalBaseline),
        blendedEstimateUplift,
        airlineBreakdown
      });
    }

    return forecast;
  }
};
