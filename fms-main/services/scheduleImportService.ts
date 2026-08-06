import * as XLSX from 'xlsx/dist/xlsx.full.min.js';
import { InternationalSchedule, ScheduleCrossCheckResult, PredictiveUpliftForecast, FlightJob, FlightLog } from '../types';

export const INITIAL_MOCK_SCHEDULES: InternationalSchedule[] = [
  // ── INTERNATIONAL FLIGHT SCHEDULES ──
  { id: 'intl-sch-101', flightNumber: 'EK652', airlineCode: 'EK', airlineName: 'Emirates', origin: 'DXB', destination: 'MLE', sta: '08:30', std: '10:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-102', flightNumber: 'EK656', airlineCode: 'EK', airlineName: 'Emirates', origin: 'DXB', destination: 'MLE', sta: '07:35', std: '09:05', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-103', flightNumber: 'EK658', airlineCode: 'EK', airlineName: 'Emirates', origin: 'DXB', destination: 'MLE', sta: '09:25', std: '10:55', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-104', flightNumber: 'QR672', airlineCode: 'QR', airlineName: 'Qatar Airways', origin: 'DOH', destination: 'MLE', sta: '08:05', std: '19:50', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-105', flightNumber: 'QR676', airlineCode: 'QR', airlineName: 'Qatar Airways', origin: 'DOH', destination: 'MLE', sta: '07:50', std: '09:40', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 48000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-106', flightNumber: 'QR670', airlineCode: 'QR', airlineName: 'Qatar Airways', origin: 'DOH', destination: 'MLE', sta: '08:25', std: '20:45', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320-200', estimatedUpliftLiters: 16500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-107', flightNumber: 'FZ1207', airlineCode: 'FZ', airlineName: 'Fly Dubai', origin: 'DXB', destination: 'MLE', sta: '06:45', std: '10:10', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B737 MAX 8', estimatedUpliftLiters: 17000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-108', flightNumber: 'FZ1025', airlineCode: 'FZ', airlineName: 'Fly Dubai', origin: 'DXB', destination: 'MLE', sta: '07:15', std: '08:15', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B737 MAX 8', estimatedUpliftLiters: 17000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-109', flightNumber: 'SU320-1', airlineCode: 'SU', airlineName: 'Aeroflot', origin: 'SVO', destination: 'MLE', sta: '09:20', std: '11:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-300ER', estimatedUpliftLiters: 52000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-110', flightNumber: 'EY378-9', airlineCode: 'EY', airlineName: 'Etihad Airways', origin: 'AUH', destination: 'MLE', sta: '05:05', std: '09:35', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-10', estimatedUpliftLiters: 42000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-111', flightNumber: 'EY372-3', airlineCode: 'EY', airlineName: 'Etihad Airways', origin: 'AUH', destination: 'MLE', sta: '07:25', std: '09:10', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-10', estimatedUpliftLiters: 42000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-112', flightNumber: 'SQ438', airlineCode: 'SQ', airlineName: 'Singapore Airlines', origin: 'SIN', destination: 'MLE', sta: '22:10', std: '23:25', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-10', estimatedUpliftLiters: 39000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-113', flightNumber: 'BA061-0', airlineCode: 'BA', airlineName: 'British Airways', origin: 'LHR', destination: 'MLE', sta: '09:40', std: '11:40', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B777-200ER', estimatedUpliftLiters: 56000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-114', flightNumber: 'UL101-2', airlineCode: 'UL', airlineName: 'SriLankan Airlines', origin: 'CMB', destination: 'MLE', sta: '08:15', std: '09:25', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A330-300', estimatedUpliftLiters: 32000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-115', flightNumber: 'G9093-4', airlineCode: 'G9', airlineName: 'Air Arabia', origin: 'SHJ', destination: 'MLE', sta: '08:10', std: '09:10', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320-200', estimatedUpliftLiters: 15500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-116', flightNumber: 'G9091-2', airlineCode: 'G9', airlineName: 'Air Arabia', origin: 'SHJ', destination: 'MLE', sta: '13:20', std: '14:20', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320-200', estimatedUpliftLiters: 15500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-117', flightNumber: 'AK074-5', airlineCode: 'AK', airlineName: 'Air Asia', origin: 'KUL', destination: 'MLE', sta: '09:50', std: '10:45', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 18000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-118', flightNumber: 'AK072-3', airlineCode: 'AK', airlineName: 'Air Asia', origin: 'KUL', destination: 'MLE', sta: '20:30', std: '21:30', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 18000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-119', flightNumber: 'TK740-1', airlineCode: 'TK', airlineName: 'Turkish Airlines', origin: 'IST', destination: 'MLE', sta: '07:40', std: '09:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B787-9', estimatedUpliftLiters: 44000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-120', flightNumber: 'GF144', airlineCode: 'GF', airlineName: 'Gulf Air', origin: 'BAH', destination: 'MLE', sta: '06:35', std: '07:35', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 16000, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-121', flightNumber: 'AI2239-40', airlineCode: 'AI', airlineName: 'Air India', origin: 'DEL', destination: 'MLE', sta: '11:50', std: '12:50', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'A320neo', estimatedUpliftLiters: 14500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },
  { id: 'intl-sch-122', flightNumber: 'MH485-4', airlineCode: 'MH', airlineName: 'Malaysia Airlines', origin: 'KUL', destination: 'MLE', sta: '10:55', std: '12:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], aircraftType: 'B737 MAX 8', estimatedUpliftLiters: 17500, effectiveFrom: '2026-03-29', effectiveTo: '2027-03-27', isActive: true, isDomestic: false, uploadedAt: new Date().toISOString(), uploadedBy: 'System Admin', sourceFilename: 'MACL_Slot_Coordination.xlsx' },

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
   * MACL Days of Ops decoder (e.g., 1234567, 1030507, 500, 7, 4000, 200507)
   */
  parseDaysOfOps(raw: any): number[] {
    if (raw === undefined || raw === null) return [1, 2, 3, 4, 5, 6, 7];
    const str = String(raw).trim();
    if (!str) return [1, 2, 3, 4, 5, 6, 7];

    const days: number[] = [];
    for (let d = 1; d <= 7; d++) {
      if (str.includes(String(d))) {
        days.push(d);
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
   * Auto-estimate Jet A-1 fuel uplift in liters based on seat capacity & aircraft model
   */
  estimateUpliftFromSeats(seats: number, acType: string): number {
    const cleanType = (acType || '').toUpperCase();
    if (seats <= 0 || isNaN(seats)) {
      if (cleanType.includes('777') || cleanType.includes('77W') || cleanType.includes('350') || cleanType.includes('359') || cleanType.includes('787') || cleanType.includes('330')) {
        return 48000;
      }
      if (cleanType.includes('320') || cleanType.includes('321') || cleanType.includes('32Q') || cleanType.includes('737') || cleanType.includes('73H')) {
        return 18000;
      }
      return 35000;
    }

    if (cleanType.includes('777') || cleanType.includes('77W') || cleanType.includes('350') || cleanType.includes('359') || cleanType.includes('787') || cleanType.includes('330')) {
      return Math.round(seats * 115);
    }
    if (cleanType.includes('320') || cleanType.includes('321') || cleanType.includes('32Q') || cleanType.includes('737') || cleanType.includes('73H')) {
      return Math.round(seats * 85);
    }
    if (cleanType.includes('ATR') || cleanType.includes('DASH')) {
      return Math.round(seats * 25);
    }
    return Math.round(seats * 95);
  },

  /**
   * Native Excel (.xlsx / .xls) reader supporting raw MACL Slot Coordination workbooks
   */
  parseScheduleExcel(fileBuffer: ArrayBuffer, fileName: string, uploader: string = 'Admin'): { 
    schedules: InternationalSchedule[]; 
    errors: string[];
    stats: { totalRows: number; parsedCount: number; airlineCount: number }
  } {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const schedules: InternationalSchedule[] = [];
    const errors: string[] = [];
    const airlinesSet = new Set<string>();

    // Sheet priority order: "Days of OPS", "Domestic", "MON", "TUE", etc.
    let sheetNamesToProcess = workbook.SheetNames.filter(n => 
      n.toLowerCase().includes('days of ops') || n.toLowerCase().includes('domestic')
    );

    if (sheetNamesToProcess.length === 0) {
      // Fallback to day sheets or all non-cover sheets
      sheetNamesToProcess = workbook.SheetNames.filter(n => !n.toLowerCase().includes('cover'));
    }

    let totalRowsProcessed = 0;

    for (const sname of sheetNamesToProcess) {
      const sheet = workbook.Sheets[sname];
      if (!sheet) continue;

      const rawGrid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rawGrid || rawGrid.length === 0) continue;

      let currentAirline = 'International Carrier';
      let colIdxMap: Record<string, number> = {};
      let headerFound = false;

      for (let r = 0; r < rawGrid.length; r++) {
        totalRowsProcessed++;
        const row = rawGrid[r].map(c => String(c).trim());
        if (row.every(c => !c)) continue;

        // Check if row is a section header (e.g. B8: "AEROFLOT", "AIR ASIA", "EMIRATES")
        const bVal = row[1] || row[0] || '';
        const isHeaderRow = row.some(c => {
          const u = c.toUpperCase();
          return u.includes('AIRLINE') || u.includes('DAYS OF OPS') || u.includes('A/C TYPE') || u.includes('ROUTE') || u.includes('FLT NO');
        });

        if (isHeaderRow) {
          headerFound = true;
          colIdxMap = {};
          row.forEach((cell, idx) => {
            const u = cell.toUpperCase();
            if (u.includes('AIRLINE')) colIdxMap['airline'] = idx;
            else if (u.includes('DAYS OF OPS') || u.includes('DAYS')) colIdxMap['days'] = idx;
            else if (u.includes('A/C TYPE') || u.includes('EQUIPMENT')) colIdxMap['aircraft'] = idx;
            else if (u.includes('ROUTE')) colIdxMap['route'] = idx;
            else if (u.includes('FLT NO') || u.includes('FLIGHT')) colIdxMap['fltNo'] = idx;
            else if (u.includes('STA')) colIdxMap['sta'] = idx;
            else if (u.includes('STD')) colIdxMap['std'] = idx;
            else if (u.includes('EFFECTIVE')) colIdxMap['effective'] = idx;
            else if (u.includes('SEATS')) colIdxMap['seats'] = idx;
            else if (u.includes('UPLIFT')) colIdxMap['uplift'] = idx;
          });
          continue;
        }

        // Section Title Detection (e.g. Row B8: "AEROFLOT")
        if (bVal && !bVal.toUpperCase().includes('AIRLINE') && !bVal.toUpperCase().includes('SLOT') && !bVal.toUpperCase().includes('VELANA') && !bVal.toUpperCase().includes('DAYS OF OPS') && !bVal.toUpperCase().includes('LAST UPDATED') && bVal.length > 2 && row.filter(c => c).length <= 2) {
          currentAirline = bVal;
          airlinesSet.add(currentAirline);
          continue;
        }

        // Extract values using header map or MACL standard column positions
        // Days of OPS: B=Airline(1), C=Days(2), D=AC(3), E=Route(4), F=FltNo(5), G=STA(6), H=STD(7), I=Effective(8), J=Seats(9)
        // Domestic: C=Airline(2), D=Days(3), E=AC(4), F=Route(5), G=FltNo(6), H=Time(7), I=Effective(8), J=Seats(9)
        const isDomSheet = sname.toLowerCase().includes('domestic');

        const getVal = (key: string, defaultIntlCol: number, defaultDomCol: number): string => {
          if (colIdxMap[key] !== undefined && row[colIdxMap[key]]) {
            return row[colIdxMap[key]];
          }
          const col = isDomSheet ? defaultDomCol : defaultIntlCol;
          return row[col] || '';
        };

        const flightNoRaw = getVal('fltNo', 5, 6);
        if (!flightNoRaw || flightNoRaw.toUpperCase().includes('FLT NO') || flightNoRaw.toUpperCase().includes('FLIGHT')) continue;

        const airlineNameRow = getVal('airline', 1, 2) || currentAirline;
        if (airlineNameRow && airlineNameRow.length > 2) {
          airlinesSet.add(airlineNameRow);
        }

        const daysRaw = getVal('days', 2, 3);
        const daysOfWeek = this.parseDaysOfOps(daysRaw);

        const acType = getVal('aircraft', 3, 4) || (isDomSheet ? 'ATR72-600' : 'Widebody');
        const route = getVal('route', 4, 5) || (isDomSheet ? 'MLE-DDD' : 'INT-MLE');

        // Parse Route
        let origin = isDomSheet ? 'MLE' : 'INT';
        let destination = isDomSheet ? 'DOM' : 'MLE';
        if (route.includes('-')) {
          const legs = route.split('-').map(l => l.trim().toUpperCase());
          if (legs.length >= 2) {
            origin = legs[0];
            destination = legs[1];
          }
        }

        const staRaw = getVal('sta', 6, 7);
        const stdRaw = getVal('std', 7, 7);
        const sta = this.parseMaclTime(staRaw);
        const std = this.parseMaclTime(stdRaw);

        const effectiveRaw = getVal('effective', 8, 8);
        
        let effectiveFrom = '2026-03-29';
        let effectiveTo = '2027-03-27';

        if (effectiveRaw && effectiveRaw !== '-' && effectiveRaw.trim() !== '') {
          const parsed = this.parseMaclDateRange(effectiveRaw);
          effectiveFrom = parsed.effectiveFrom;
          effectiveTo = parsed.effectiveTo;
        } else if (!isDomSheet) {
          const parsed = this.parseMaclDateRange(effectiveRaw);
          effectiveFrom = parsed.effectiveFrom;
          effectiveTo = parsed.effectiveTo;
        }

        const seatsRaw = getVal('seats', 9, 9);
        const seats = parseInt(seatsRaw, 10) || 0;

        const upliftRaw = getVal('uplift', -1, -1);
        
        // Standardize flight number
        const flightNumber = flightNoRaw.replace(/\s+/g, '').toUpperCase();
        const airlineCode = flightNumber.slice(0, 2);

        // Detect Domestic Flight
        const isDomAirline = ['MANTA', 'FLYME', 'MALDIVIAN', 'MAVDIVIAN', 'VILLA'].some(name => airlineNameRow.toUpperCase().includes(name));
        const isDomCode = ['NR', 'VP', 'Q2'].some(code => flightNumber.startsWith(code));
        const isDomestic = isDomSheet || isDomAirline || isDomCode;

        // Custom uplift estimation for domestic vs international
        let estimatedUplift = upliftRaw ? parseFloat(upliftRaw) : 0;
        if (!estimatedUplift || isNaN(estimatedUplift)) {
          if (isDomestic) {
            const uAC = acType.toUpperCase();
            if (uAC.includes('A330')) estimatedUplift = 14000;
            else if (uAC.includes('ATR')) estimatedUplift = Math.max(1600, Math.round((seats || 64) * 28));
            else if (uAC.includes('DH8') || uAC.includes('DASH')) estimatedUplift = Math.max(1200, Math.round((seats || 50) * 26));
            else estimatedUplift = Math.max(1500, Math.round((seats || 50) * 30));
          } else {
            estimatedUplift = this.estimateUpliftFromSeats(seats, acType);
          }
        }

        const item: InternationalSchedule = {
          id: `intl-sch-xl-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
          flightNumber,
          airlineCode,
          airlineName: airlineNameRow,
          origin,
          destination,
          sta: sta || '12:00',
          std: std || '13:30',
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
        airlineCount: airlinesSet.size
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
        aircraftType: acIdx !== -1 && row[acIdx] ? row[acIdx] : 'Widebody Heavy',
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
      if (!sch.isActive) return false;
      if (sch.effectiveFrom && dateStr < sch.effectiveFrom) return false;
      if (sch.effectiveTo && dateStr > sch.effectiveTo) return false;
      return sch.daysOfWeek.includes(dayOfWeek);
    });

    const results: ScheduleCrossCheckResult[] = [];
    const matchedJobIds = new Set<string>();
    const cleanNo = (no?: string) => (no || '').replace(/\s+/g, '').toUpperCase();

    for (const sch of activeSchedules) {
      const schNo = cleanNo(sch.flightNumber);
      const matchingJob = dailyJobs.find(j => cleanNo(j.flightNumber) === schNo);

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
        airlineName: job.flightNumber.slice(0, 2) + ' Airlines',
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
