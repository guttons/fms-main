import { BriefingShift } from '../context/OperationalDataContext';
import { supabase } from '../supabase';
import { Equipment, EquipmentType, EquipmentStatus, UserRole } from '../types';

export interface StaffDomesticHistory {
  date: string; // YYYY-MM-DD
  shift: BriefingShift;
  team: string; // 'Team 1' | 'Team 2' | 'Team 3'
}

export interface StaffEquipmentHistory {
  date: string;
  shift?: BriefingShift;
  equipmentId?: string;
}

export interface StaffAssignmentHistory {
  staffId: string;
  lastDomestic?: StaffDomesticHistory;
  lastDaily?: StaffEquipmentHistory;
  lastDiesel?: StaffEquipmentHistory;
  lastJetTransfer?: { date: string; shift?: BriefingShift };
  lastStock?: { date: string; shift?: BriefingShift };
}

export interface DomesticTeamAssignment {
  id: string; // 't1', 't2', 't3'
  name: string; // 'Team 1', 'Team 2', 'Team 3'
  op1: string; // RF Operator staffId
  op2: string; // Officer staffId
}

/**
 * Validates staff eligibility for auto-assignment.
 * RULE: Ignore any staff tagged with any status OTHER THAN 'LATE'.
 * (Untagged staff and staff tagged with 'LATE' are eligible).
 */
export function isStaffEligible(staffId?: string, staffStatuses?: Record<string, string>): boolean {
  if (!staffId || staffId.trim() === '') return false;
  const tag = staffStatuses?.[staffId];
  if (!tag || tag.trim() === '') return true;
  return tag.toUpperCase() === 'LATE';
}

/**
 * Returns numeric weight for shift tie-breaking:
 * Night (3) > Evening (2) > Morning (1)
 */
export function getShiftWeight(shift?: string): number {
  if (!shift) return 0;
  const s = shift.toUpperCase();
  if (s.includes('NIGHT')) return 3;
  if (s.includes('EVE') || s.includes('AFTER')) return 2;
  if (s.includes('MORN')) return 1;
  return 0;
}

/**
 * Returns numeric weight for team processing priority:
 * Team 3 (3) > Team 2 (2) > Team 1 (1)
 */
export function getTeamWeight(team?: string): number {
  if (!team) return 0;
  if (team.includes('3')) return 3;
  if (team.includes('2')) return 2;
  if (team.includes('1')) return 1;
  return 0;
}

/**
 * Fetches historical assignments across domestic, equipment, and shift briefing tables.
 */
export async function fetchStaffAssignmentHistory(
  knownStaffIds: string[]
): Promise<Map<string, StaffAssignmentHistory>> {
  const historyMap = new Map<string, StaffAssignmentHistory>();

  knownStaffIds.forEach(id => {
    historyMap.set(id, { staffId: id });
  });

  try {
    const [domesticRes, equipmentRes, briefingRes] = await Promise.all([
      supabase
        .from('domestic_assignments')
        .select('*')
        .order('assignment_date', { ascending: false })
        .limit(300),
      supabase
        .from('equipment_assignments')
        .select('*')
        .order('assignment_date', { ascending: false })
        .limit(300),
      supabase
        .from('shift_briefing_info')
        .select('id, date, shift, staff_assignments')
        .order('date', { ascending: false })
        .limit(100)
    ]);

    const dateToShiftMap = new Map<string, BriefingShift>();
    if (briefingRes.data) {
      briefingRes.data.forEach((b: any) => {
        if (b.date && b.shift) {
          dateToShiftMap.set(b.date, b.shift as BriefingShift);
        }

        // Check if briefing stored domesticTeams
        const dTeams = b.staff_assignments?.domesticTeams;
        if (Array.isArray(dTeams) && b.date) {
          dTeams.forEach((t: any) => {
            const shift = (b.shift as BriefingShift) || 'Morning';
            [t.op1, t.op2].filter(Boolean).forEach((sId: string) => {
              const curr = historyMap.get(sId) || { staffId: sId };
              if (!curr.lastDomestic || curr.lastDomestic.date < b.date) {
                curr.lastDomestic = {
                  date: b.date,
                  shift,
                  team: t.name || t.teamName || 'Team 1'
                };
                historyMap.set(sId, curr);
              }
            });
          });
        }

        // Check equipment assignments in briefing
        const eqAssigns = b.staff_assignments?.equipmentAssignments;
        if (eqAssigns && typeof eqAssigns === 'object' && b.date) {
          Object.entries(eqAssigns).forEach(([eqId, assign]: [string, any]) => {
            const shift = (b.shift as BriefingShift) || 'Morning';
            const staffIds = [assign?.op1, assign?.op2].filter(Boolean);
            staffIds.forEach((sId: string) => {
              const curr: StaffAssignmentHistory = historyMap.get(sId) || { staffId: sId };
              if (shift === 'Evening') {
                if (!curr.lastDiesel || curr.lastDiesel.date < b.date) {
                  curr.lastDiesel = { date: b.date, shift, equipmentId: eqId };
                }
              } else {
                if (!curr.lastDaily || curr.lastDaily.date < b.date) {
                  curr.lastDaily = { date: b.date, shift, equipmentId: eqId };
                }
              }
              historyMap.set(sId, curr);
            });
          });
        }

        // Check Jet Transfer task in briefing
        const jt = b.staff_assignments?.jetTransfer;
        if (jt && b.date) {
          const shift = (b.shift as BriefingShift) || 'Morning';
          [jt.op1, jt.op2].filter(Boolean).forEach((sId: string) => {
            const curr: StaffAssignmentHistory = historyMap.get(sId) || { staffId: sId };
            if (!curr.lastJetTransfer || curr.lastJetTransfer.date < b.date) {
              curr.lastJetTransfer = { date: b.date, shift };
              historyMap.set(sId, curr);
            }
          });
        }

        // Check Diesel assignments in briefing
        const dAssigns = b.staff_assignments?.dieselAssignments;
        if (dAssigns && typeof dAssigns === 'object' && b.date) {
          Object.entries(dAssigns).forEach(([eqId, assign]: [string, any]) => {
            const shift = (b.shift as BriefingShift) || 'Evening';
            const staffIds = [assign?.op1, assign?.op2].filter(Boolean);
            staffIds.forEach((sId: string) => {
              const curr: StaffAssignmentHistory = historyMap.get(sId) || { staffId: sId };
              if (!curr.lastDiesel || curr.lastDiesel.date < b.date) {
                curr.lastDiesel = { date: b.date, shift, equipmentId: eqId };
                historyMap.set(sId, curr);
              }
            });
          });
        }

        // Check Stock assignment in briefing
        const stAssign = b.staff_assignments?.stockAssignment;
        if (stAssign?.staffId && b.date) {
          const shift = (b.shift as BriefingShift) || 'Night';
          const sId = stAssign.staffId;
          const curr: StaffAssignmentHistory = historyMap.get(sId) || { staffId: sId };
          if (!curr.lastStock || curr.lastStock.date < b.date) {
            curr.lastStock = { date: b.date, shift };
            historyMap.set(sId, curr);
          }
        }
      });
    }

    // Process domestic_assignments table
    if (domesticRes.data) {
      domesticRes.data.forEach((row: any) => {
        const d = row.assignment_date;
        if (!d) return;
        const shift: BriefingShift = dateToShiftMap.get(d) || 'Morning';
        const team = row.team_name || 'Team 1';

        [row.operator1_id, row.operator2_id, row.op1, row.op2]
          .filter(Boolean)
          .forEach((sId: string) => {
            const curr = historyMap.get(sId) || { staffId: sId };
            if (!curr.lastDomestic || curr.lastDomestic.date < d) {
              curr.lastDomestic = { date: d, shift, team };
              historyMap.set(sId, curr);
            }
          });
      });
    }

    // Process equipment_assignments table
    if (equipmentRes.data) {
      equipmentRes.data.forEach((row: any) => {
        const d = row.assignment_date;
        if (!d) return;
        const shift: BriefingShift = dateToShiftMap.get(d) || (row.shift_type === 'DIESEL' ? 'Evening' : 'Morning');
        const eqId = row.equipment_id;

        [row.operator1_id, row.operator2_id, row.op1, row.op2]
          .filter(Boolean)
          .forEach((sId: string) => {
            const curr = historyMap.get(sId) || { staffId: sId };
            if (row.shift_type === 'DIESEL') {
              if (!curr.lastDiesel || curr.lastDiesel.date < d) {
                curr.lastDiesel = { date: d, shift, equipmentId: eqId };
                historyMap.set(sId, curr);
              }
            } else {
              if (!curr.lastDaily || curr.lastDaily.date < d) {
                curr.lastDaily = { date: d, shift, equipmentId: eqId };
                historyMap.set(sId, curr);
              }
            }
          });
      });
    }
  } catch (err) {
    console.warn('[assignmentEngine] Error fetching assignment history:', err);
  }

  return historyMap;
}

/**
 * Sorts candidates for domestic group assignment according to the strict fairness rules:
 * 1. Date: Oldest date first (never assigned = top priority)
 * 2. Shift Tie-Breaker: Night (3) > Evening (2) > Morning (1)
 * 3. Team Tie-Breaker: Team 3 candidates first, then Team 2, then Team 1
 */
export function sortDomesticCandidates(
  candidateIds: string[],
  historyMap: Map<string, StaffAssignmentHistory>
): string[] {
  return [...candidateIds].sort((idA, idB) => {
    const histA = historyMap.get(idA)?.lastDomestic;
    const histB = historyMap.get(idB)?.lastDomestic;

    // 1. Never assigned is top priority
    if (!histA && !histB) return idA.localeCompare(idB);
    if (!histA) return -1;
    if (!histB) return 1;

    // 2. Date ascending (older date first)
    const dateComp = histA.date.localeCompare(histB.date);
    if (dateComp !== 0) return dateComp;

    // 3. Shift tie-breaker: Night > Evening > Morning
    const shiftComp = getShiftWeight(histB.shift) - getShiftWeight(histA.shift);
    if (shiftComp !== 0) return shiftComp;

    // 4. Team tie-breaker: Team 3 > Team 2 > Team 1
    const teamComp = getTeamWeight(histB.team) - getTeamWeight(histA.team);
    if (teamComp !== 0) return teamComp;

    return idA.localeCompare(idB);
  });
}

/**
 * Allocates sorted candidates into Team 1, Team 2, Team 3 according to cyclic rotation:
 * - Candidate previously in Team 3 -> First available slot in Team 2 (then 1, then 3)
 * - Candidate previously in Team 2 -> First available slot in Team 1 (then 3, then 2)
 * - Candidate previously in Team 1 -> First available slot in Team 3 (then 2, then 1)
 * - Candidate never assigned -> First available slot in Team 1 (then 2, then 3)
 */
export function allocateCyclicTeamSlots(
  sortedStaffIds: string[],
  historyMap: Map<string, StaffAssignmentHistory>,
  targetTeamNames: string[] = ['Team 1', 'Team 2', 'Team 3']
): Record<string, string> {
  const teamSlots: Record<string, string> = {};
  targetTeamNames.forEach(tName => {
    teamSlots[tName] = '';
  });

  const getTargetPreference = (prevTeam?: string): string[] => {
    let order: string[];
    if (prevTeam?.includes('3')) order = ['Team 2', 'Team 1', 'Team 3'];
    else if (prevTeam?.includes('2')) order = ['Team 1', 'Team 3', 'Team 2'];
    else if (prevTeam?.includes('1')) order = ['Team 3', 'Team 2', 'Team 1'];
    else order = ['Team 1', 'Team 2', 'Team 3'];

    return order.filter(t => targetTeamNames.includes(t));
  };

  for (const staffId of sortedStaffIds) {
    const prevTeam = historyMap.get(staffId)?.lastDomestic?.team;
    const preferences = getTargetPreference(prevTeam);

    for (const targetTeam of preferences) {
      if (teamSlots[targetTeam] === '') {
        teamSlots[targetTeam] = staffId;
        break;
      }
    }
  }

  return teamSlots;
}

/**
 * Sorts candidates for Daily Equipment Inspection:
 * 1. Date: Oldest date first (never assigned = top priority)
 * 2. Shift Tie-Breaker: Night > Evening > Morning
 */
export function sortDailyCandidates(
  candidateIds: string[],
  historyMap: Map<string, StaffAssignmentHistory>
): string[] {
  return [...candidateIds].sort((idA, idB) => {
    const histA = historyMap.get(idA)?.lastDaily;
    const histB = historyMap.get(idB)?.lastDaily;

    if (!histA && !histB) return idA.localeCompare(idB);
    if (!histA) return -1;
    if (!histB) return 1;

    const dateComp = histA.date.localeCompare(histB.date);
    if (dateComp !== 0) return dateComp;

    const shiftComp = getShiftWeight(histB.shift) - getShiftWeight(histA.shift);
    if (shiftComp !== 0) return shiftComp;

    return idA.localeCompare(idB);
  });
}

/**
 * Sorts candidates for Evening Diesel operations:
 * 1. Date: Oldest date first (never assigned = top priority)
 * Note: No shift tie-breaker needed as diesel operations are almost always conducted in the evening shift.
 */
export function sortDieselCandidates(
  candidateIds: string[],
  historyMap: Map<string, StaffAssignmentHistory>
): string[] {
  return [...candidateIds].sort((idA, idB) => {
    const histA = historyMap.get(idA)?.lastDiesel;
    const histB = historyMap.get(idB)?.lastDiesel;

    if (!histA && !histB) return idA.localeCompare(idB);
    if (!histA) return -1;
    if (!histB) return 1;

    const dateComp = histA.date.localeCompare(histB.date);
    if (dateComp !== 0) return dateComp;

    return idA.localeCompare(idB);
  });
}

/**
 * Sorts candidates for Jet Transfer operations:
 * 1. Date: Oldest date first (never assigned = top priority)
 * 2. Shift Tie-Breaker: Night > Evening > Morning
 */
export function sortJetTransferCandidates(
  candidateIds: string[],
  historyMap: Map<string, StaffAssignmentHistory>
): string[] {
  return [...candidateIds].sort((idA, idB) => {
    const histA = historyMap.get(idA)?.lastJetTransfer;
    const histB = historyMap.get(idB)?.lastJetTransfer;

    if (!histA && !histB) return idA.localeCompare(idB);
    if (!histA) return -1;
    if (!histB) return 1;

    const dateComp = histA.date.localeCompare(histB.date);
    if (dateComp !== 0) return dateComp;

    const shiftComp = getShiftWeight(histB.shift) - getShiftWeight(histA.shift);
    if (shiftComp !== 0) return shiftComp;

    return idA.localeCompare(idB);
  });
}

/**
 * Sorts candidates for Night Shift Stock Duty:
 * 1. Date: Oldest date first (never assigned = top priority)
 * 2. Shift Tie-Breaker: Night > Evening > Morning
 */
export function sortStockCandidates(
  candidateIds: string[],
  historyMap: Map<string, StaffAssignmentHistory>
): string[] {
  return [...candidateIds].sort((idA, idB) => {
    const histA = historyMap.get(idA)?.lastStock;
    const histB = historyMap.get(idB)?.lastStock;

    if (!histA && !histB) return idA.localeCompare(idB);
    if (!histA) return -1;
    if (!histB) return 1;

    const dateComp = histA.date.localeCompare(histB.date);
    if (dateComp !== 0) return dateComp;

    const shiftComp = getShiftWeight(histB.shift) - getShiftWeight(histA.shift);
    if (shiftComp !== 0) return shiftComp;

    return idA.localeCompare(idB);
  });
}

/**
 * Core auto-assignment for Domestic Groups (Morning: 3 teams, Evening: 2 teams, Night: 1 team).
 */
export function runAutoAssignDomestic(params: {
  activeOperators: string[];
  activeOfficers: string[];
  staffStatuses?: Record<string, string>;
  attendees?: string[];
  historyMap: Map<string, StaffAssignmentHistory>;
  targetTeamNames?: string[];
}): DomesticTeamAssignment[] {
  const { 
    activeOperators, 
    activeOfficers, 
    staffStatuses, 
    attendees, 
    historyMap, 
    targetTeamNames = ['Team 1', 'Team 2', 'Team 3'] 
  } = params;

  // Filter eligible staff (Untagged or LATE only)
  let eligibleOps = (activeOperators || []).filter(id => isStaffEligible(id, staffStatuses));
  let eligibleOffs = (activeOfficers || []).filter(id => isStaffEligible(id, staffStatuses));

  // If attendees marked, prefer attendees
  if (attendees && attendees.length > 0) {
    const presentOps = eligibleOps.filter(id => attendees.includes(id));
    if (presentOps.length > 0) eligibleOps = presentOps;

    const presentOffs = eligibleOffs.filter(id => attendees.includes(id));
    if (presentOffs.length > 0) eligibleOffs = presentOffs;
  }

  // Deduplicate
  eligibleOps = Array.from(new Set(eligibleOps));
  eligibleOffs = Array.from(new Set(eligibleOffs));

  // Sort candidates by fairness hierarchy
  const sortedOps = sortDomesticCandidates(eligibleOps, historyMap);
  const sortedOffs = sortDomesticCandidates(eligibleOffs, historyMap);

  // Allocate into cyclic slots
  const opSlotAllocations = allocateCyclicTeamSlots(sortedOps, historyMap, targetTeamNames);
  const offSlotAllocations = allocateCyclicTeamSlots(sortedOffs, historyMap, targetTeamNames);

  return targetTeamNames.map((name, idx) => ({
    id: `t${name.replace(/\D/g, '') || (idx + 1)}`,
    name,
    op1: opSlotAllocations[name] || '',
    op2: offSlotAllocations[name] || ''
  }));
}

/**
 * Core auto-assignment for Jet Transfer task.
 * STRICT RULE: Excludes anyone assigned to Domestic teams!
 * Assigned fairly among Operators (op1) and Officers (op2).
 */
export function runAutoAssignJetTransfer(params: {
  activeOperators: string[];
  activeOfficers: string[];
  domesticAssignees: Set<string>;
  staffStatuses?: Record<string, string>;
  attendees?: string[];
  historyMap: Map<string, StaffAssignmentHistory>;
}): { op1: string; op2: string } {
  const { activeOperators, activeOfficers, domesticAssignees, staffStatuses, attendees, historyMap } = params;

  let eligibleOps = (activeOperators || [])
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  let eligibleOffs = (activeOfficers || [])
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  if (attendees && attendees.length > 0) {
    const presentOps = eligibleOps.filter(id => attendees.includes(id));
    if (presentOps.length > 0) eligibleOps = presentOps;

    const presentOffs = eligibleOffs.filter(id => attendees.includes(id));
    if (presentOffs.length > 0) eligibleOffs = presentOffs;
  }

  eligibleOps = Array.from(new Set(eligibleOps));
  eligibleOffs = Array.from(new Set(eligibleOffs));

  const sortedOps = sortJetTransferCandidates(eligibleOps, historyMap);
  const sortedOffs = sortJetTransferCandidates(eligibleOffs, historyMap);

  return {
    op1: sortedOps[0] || '',
    op2: sortedOffs[0] || ''
  };
}

/**
 * Core auto-assignment for Night Shift Stock Duty.
 * Assigns strictly 1 Officer or Hydrant Ops Officer.
 * Excludes staff committed to Domestic Squadron.
 */
export function runAutoAssignStock(params: {
  activeOfficers: string[];
  hydrantOpsOfficers: string[];
  domesticAssignees: Set<string>;
  staffStatuses?: Record<string, string>;
  attendees?: string[];
  historyMap: Map<string, StaffAssignmentHistory>;
}): string {
  const { activeOfficers, hydrantOpsOfficers, domesticAssignees, staffStatuses, attendees, historyMap } = params;

  let eligible = Array.from(new Set([...(activeOfficers || []), ...(hydrantOpsOfficers || [])]))
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  if (attendees && attendees.length > 0) {
    const present = eligible.filter(id => attendees.includes(id));
    if (present.length > 0) eligible = present;
  }

  eligible = Array.from(new Set(eligible));
  const sorted = sortStockCandidates(eligible, historyMap);
  return sorted[0] || '';
}

/**
 * Core auto-assignment for Daily Equipment checks (Refuellers and Hydrant Dispensers).
 * STRICT RULE: Excludes anyone assigned to any Domestic Teams!
 * HD assigned strictly from Hydrant Ops Officers.
 * RF assigned from remaining Active Operators (op1) and Active Officers (op2).
 * If existingAssignments is provided (e.g., from Night shift), those assignments are preserved
 * and only the remaining unassigned units are assigned.
 */
export function runAutoAssignDaily(params: {
  equipment: Equipment[];
  activeOperators: string[];
  activeOfficers?: string[];
  hydrantOpsOfficers: string[];
  domesticAssignees: Set<string>;
  staffStatuses?: Record<string, string>;
  attendees?: string[];
  historyMap: Map<string, StaffAssignmentHistory>;
  existingAssignments?: Record<string, { op1: string; op2: string }>;
}): Record<string, { op1: string; op2: string }> {
  const { equipment, activeOperators, activeOfficers = [], hydrantOpsOfficers, domesticAssignees, staffStatuses, attendees, historyMap, existingAssignments } = params;

  // Filter eligible Operators (untagged/LATE, NOT in domestic)
  let eligibleOps = (activeOperators || [])
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  // Filter eligible Officers for RF (untagged/LATE, NOT in domestic)
  let eligibleOffs = (activeOfficers || [])
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  // Filter eligible Hydrant Ops Officers (untagged/LATE, NOT in domestic)
  let eligibleHydrant = (hydrantOpsOfficers || [])
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  if (attendees && attendees.length > 0) {
    const presentOps = eligibleOps.filter(id => attendees.includes(id));
    if (presentOps.length > 0) eligibleOps = presentOps;

    const presentOffs = eligibleOffs.filter(id => attendees.includes(id));
    if (presentOffs.length > 0) eligibleOffs = presentOffs;

    const presentHydrant = eligibleHydrant.filter(id => attendees.includes(id));
    if (presentHydrant.length > 0) eligibleHydrant = presentHydrant;
  }

  eligibleOps = Array.from(new Set(eligibleOps));
  eligibleOffs = Array.from(new Set(eligibleOffs));
  eligibleHydrant = Array.from(new Set(eligibleHydrant));

  const sortedOps = sortDailyCandidates(eligibleOps, historyMap);
  const sortedOffs = sortDailyCandidates(eligibleOffs, historyMap);
  const sortedHydrant = sortDailyCandidates(eligibleHydrant, historyMap);

  // Initialize with existing assignments (e.g. from Night shift)
  const assignments: Record<string, { op1: string; op2: string }> = { ...(existingAssignments || {}) };

  // Separate RF and HD equipment (excluding out-of-service units)
  const rfUnits = (equipment || []).filter(e => e.type === EquipmentType.REFUELLER && e.status !== EquipmentStatus.OUT_OF_SERVICE);
  const hdUnits = (equipment || []).filter(e => e.type === EquipmentType.HYDRANT_DISPENSER && e.status !== EquipmentStatus.OUT_OF_SERVICE);

  // Filter for unassigned units so existing assignments are preserved
  const unassignedRf = rfUnits.filter(unit => !assignments[unit.id] || (!assignments[unit.id].op1 && !assignments[unit.id].op2));
  const unassignedHd = hdUnits.filter(unit => !assignments[unit.id] || !assignments[unit.id].op1);

  // Assign RF units to operators (op1) AND officers (op2)
  unassignedRf.forEach((unit, idx) => {
    const assignedOp = sortedOps.length > 0 ? sortedOps[idx % sortedOps.length] : '';
    const assignedOff = sortedOffs.length > 0 ? sortedOffs[idx % sortedOffs.length] : '';
    assignments[unit.id] = { op1: assignedOp, op2: assignedOff };
  });

  // Assign HD units to hydrant officers (op1), op2 is empty
  unassignedHd.forEach((unit, idx) => {
    const assignedStaff = sortedHydrant.length > 0 ? sortedHydrant[idx % sortedHydrant.length] : '';
    assignments[unit.id] = { op1: assignedStaff, op2: '' };
  });

  return assignments;
}

/**
 * Core auto-assignment for Evening Shift Diesel.
 * Applied strictly to equipment flagged in dieselNeeds (excluding out-of-service units).
 * RF units assigned to 1 Active Operator (op1).
 * HD units assigned to 1 Hydrant Ops Officer (op1).
 */
export function runAutoAssignDiesel(params: {
  equipment: Equipment[];
  dieselNeeds: string[];
  activeOperators: string[];
  activeOfficers?: string[];
  hydrantOpsOfficers: string[];
  domesticAssignees: Set<string>;
  staffStatuses?: Record<string, string>;
  attendees?: string[];
  historyMap: Map<string, StaffAssignmentHistory>;
}): Record<string, { op1: string; op2: string }> {
  const { equipment, dieselNeeds, activeOperators, hydrantOpsOfficers, domesticAssignees, staffStatuses, attendees, historyMap } = params;

  // Filter eligible Operators (untagged/LATE, NOT in domestic)
  let eligibleOps = (activeOperators || [])
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  // Filter eligible Hydrant Ops Officers (untagged/LATE, NOT in domestic)
  let eligibleHydrant = (hydrantOpsOfficers || [])
    .filter(id => isStaffEligible(id, staffStatuses))
    .filter(id => !domesticAssignees.has(id));

  if (attendees && attendees.length > 0) {
    const presentOps = eligibleOps.filter(id => attendees.includes(id));
    if (presentOps.length > 0) eligibleOps = presentOps;

    const presentHydrant = eligibleHydrant.filter(id => attendees.includes(id));
    if (presentHydrant.length > 0) eligibleHydrant = presentHydrant;
  }

  eligibleOps = Array.from(new Set(eligibleOps));
  eligibleHydrant = Array.from(new Set(eligibleHydrant));

  const sortedOps = sortDieselCandidates(eligibleOps, historyMap);
  const sortedHydrant = sortDieselCandidates(eligibleHydrant, historyMap);

  const assignments: Record<string, { op1: string; op2: string }> = {};

  const rfNeedingDiesel = (equipment || []).filter(e => 
    e.type === EquipmentType.REFUELLER && 
    dieselNeeds.includes(e.id) && 
    e.status !== EquipmentStatus.OUT_OF_SERVICE
  );
  const hdNeedingDiesel = (equipment || []).filter(e => 
    e.type === EquipmentType.HYDRANT_DISPENSER && 
    dieselNeeds.includes(e.id) && 
    e.status !== EquipmentStatus.OUT_OF_SERVICE
  );

  // RF on diesel: 1 Operator from Active Operators
  rfNeedingDiesel.forEach((unit, idx) => {
    const assignedOp = sortedOps.length > 0 ? sortedOps[idx % sortedOps.length] : '';
    assignments[unit.id] = { op1: assignedOp, op2: '' };
  });

  // HD on diesel: 1 Officer from Hydrant Ops Officers
  hdNeedingDiesel.forEach((unit, idx) => {
    const assignedStaff = sortedHydrant.length > 0 ? sortedHydrant[idx % sortedHydrant.length] : '';
    assignments[unit.id] = { op1: assignedStaff, op2: '' };
  });

  return assignments;
}
