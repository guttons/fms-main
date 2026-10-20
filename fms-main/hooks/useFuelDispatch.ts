import { useState, useEffect, useCallback } from 'react';
import { FlightJob, Alert, UserRole, isDomesticFlight, isAdhocFlight } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { serverTimeService } from '../services/serverTimeService';
import { MOCK_USERS } from '../constants';

export interface DispatchCacheRecord {
  status: 'REQUEST_FUELING' | 'NO_FUEL';
  requestedTime: string;
  requestedAt?: string;
  flightDate?: string;
  acknowledged?: boolean;
  acknowledgedTime?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface DispatchState {
  dispatchStatus: 'REQUEST_FUELING' | 'NO_FUEL' | null;
  isDispatchAcknowledged: boolean;
  dispatchRequestedTime: string;
  dispatchAcknowledgedTime: string;
  dispatchAcknowledgedBy: string;
  latestAlert?: Alert;
}

export interface CrewRecipients {
  operatorId?: string;
  operatorName?: string;
  officerId?: string;
  officerName?: string;
  teamMembers: { id: string; name: string; role?: UserRole }[];
  hasRecipients: boolean;
  summary: string;
}

const formatTimeSafe = (timeVal?: string) => {
  if (!timeVal) return '';
  if (/^\d{1,2}:\d{2}$/.test(timeVal.trim())) return timeVal.trim();
  try {
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  } catch {}
  return timeVal;
};

export const useFuelDispatch = (user?: any) => {
  const { notify } = useNotification();
  const {
    alerts,
    createAlert,
    deleteAlerts,
    staff,
    selectedBriefingDate,
    domesticAssignments,
    flightJobs,
    briefingInfo
  } = useOperationalData();

  const canDispatch = user?.role === UserRole.ITP_MANAGER || user?.role === UserRole.ADMIN;

  // Local cache for flight fuel dispatch status and timings
  const [dispatchCache, setDispatchCache] = useState<Record<string, DispatchCacheRecord>>(() => {
    try {
      const saved = localStorage.getItem('fms_flight_fuel_dispatches');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      const migrated: Record<string, DispatchCacheRecord> = {};
      const todayDate = serverTimeService.getServerDate();

      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          migrated[k] = {
            status: v as any,
            flightDate: todayDate,
            requestedTime: serverTimeService.getServerTimeString(),
            acknowledged: false
          };
        } else if (v && typeof v === 'object') {
          const recDate = (v as any).flightDate || ((v as any).requestedAt && (v as any).requestedAt.length > 10 ? (v as any).requestedAt.split('T')[0] : null);
          if (!recDate || recDate >= todayDate) {
            migrated[k] = v as DispatchCacheRecord;
          }
        }
      }
      return migrated;
    } catch {
      return {};
    }
  });

  // Cross-component cache sync listener
  useEffect(() => {
    const handleCacheSync = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, DispatchCacheRecord>>;
      if (customEvent.detail) {
        setDispatchCache(customEvent.detail);
      }
    };
    window.addEventListener('fms:dispatch-cache', handleCacheSync);
    return () => {
      window.removeEventListener('fms:dispatch-cache', handleCacheSync);
    };
  }, []);

  const updateDispatchCache = useCallback((cleanFlight: string, record: DispatchCacheRecord | null) => {
    setDispatchCache(prev => {
      const next = { ...prev };
      if (record === null) {
        delete next[cleanFlight];
      } else {
        next[cleanFlight] = record;
      }
      try {
        localStorage.setItem('fms_flight_fuel_dispatches', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('fms:dispatch-cache', { detail: next }));
      } catch (e) {
        console.warn('Failed to persist dispatch cache', e);
      }
      return next;
    });
  }, []);

  const getCleanFlight = useCallback((job: FlightJob | any): string => {
    return (job?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
  }, []);

  const getOperationalDate = useCallback((job: FlightJob | any): string => {
    if (job?.date) return job.date.split('T')[0];
    return selectedBriefingDate || serverTimeService.getServerDate();
  }, [selectedBriefingDate]);

  // Resolves the exact staff recipients for this flight
  const resolveRecipients = useCallback((job: FlightJob | any): CrewRecipients => {
    const usersList = staff && staff.length > 0 ? staff : MOCK_USERS;
    const teamMembers: { id: string; name: string; role?: UserRole }[] = [];
    const seenMemberIds = new Set<string>();

    const addMember = (userId?: string, defaultRole: UserRole = UserRole.ITP_OPERATOR) => {
      if (!userId) return;
      const cleanId = String(userId).trim();
      if (!cleanId) return;
      if (
        cleanId.startsWith('--') ||
        cleanId.toLowerCase().includes('unassigned') ||
        cleanId.toLowerCase().includes('no staff') ||
        cleanId.toLowerCase() === 'none' ||
        cleanId.toLowerCase() === 'null' ||
        cleanId.toLowerCase() === 'undefined'
      ) {
        return;
      }
      if (seenMemberIds.has(cleanId.toLowerCase())) return;

      const foundUser = usersList.find(u => 
        u.id === cleanId || 
        u.name.toLowerCase() === cleanId.toLowerCase()
      );
      const name = foundUser?.name || cleanId;
      const role = foundUser?.role || defaultRole;
      seenMemberIds.add(cleanId.toLowerCase());
      if (foundUser?.id) seenMemberIds.add(foundUser.id.toLowerCase());
      if (foundUser?.name) seenMemberIds.add(foundUser.name.toLowerCase());
      teamMembers.push({ id: foundUser?.id || cleanId, name, role });
    };

    // Determine flight category
    const isDomestic = Boolean(
      job?.isDomestic === true ||
      (job?.flightCategory && String(job.flightCategory).toUpperCase() === 'DOMESTIC') ||
      (job?.category && String(job.category).toLowerCase() === 'domestic') ||
      isDomesticFlight(job) ||
      (typeof job?.id === 'string' && (job.id.startsWith('dom-') || job.id.startsWith('d-'))) ||
      (typeof job?.flightNumber === 'string' && /^(Q2|VP|NR)/i.test(job.flightNumber.trim()))
    );

    const isAdhoc = Boolean(
      job?.isAdhoc === true ||
      (job?.flightCategory && String(job.flightCategory).toUpperCase() === 'ADHOC') ||
      (job?.category && String(job.category).toLowerCase() === 'adhoc') ||
      (typeof job?.id === 'string' && (job.id.startsWith('ah-') || job.id.startsWith('ah'))) ||
      isAdhocFlight(job, briefingInfo) ||
      (briefingInfo?.staffAssignments?.adhocFlights || []).some((af: any) => {
        const cleanAf = (af?.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const cleanJob = (job?.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        return cleanAf && cleanJob && cleanAf === cleanJob;
      })
    );

    // 1. Direct assignments on flight (if any)
    if (job?.assignedTo) {
      addMember(job.assignedTo, UserRole.ITP_OPERATOR);
    }
    if (job?.assignedOfficer && (!job?.equipmentUsage || job.equipmentUsage === 'REFUELLER' || isDomestic || isAdhoc)) {
      addMember(job.assignedOfficer, UserRole.ITP_OFFICER);
    }

    // 2. Domestic Squadron Team Assignments
    // Requirement: All domestic team assigned staff receive alerts for domestic flights and ad-hoc flights
    if (isDomestic || isAdhoc) {
      // 2a. Gather all domestic assignments from context / state
      if (Array.isArray(domesticAssignments)) {
        domesticAssignments.forEach((da: any) => {
          const op1 = da.operator1_id || da.op1;
          const op2 = da.operator2_id || da.op2;
          addMember(op1, UserRole.ITP_OPERATOR);
          addMember(op2, UserRole.ITP_OFFICER);
        });
      }

      // 2b. Also gather from briefingInfo.staffAssignments.domesticTeams
      const briefingTeams = briefingInfo?.staffAssignments?.domesticTeams;
      if (Array.isArray(briefingTeams)) {
        briefingTeams.forEach((bt: any) => {
          addMember(bt.op1, UserRole.ITP_OPERATOR);
          addMember(bt.op2, UserRole.ITP_OFFICER);
        });
      }

      // 2c. Also gather from localStorage backups if present
      try {
        const raw = localStorage.getItem('fms_domestic_assignments');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((da: any) => {
              const op1 = da.operator1_id || da.op1;
              const op2 = da.operator2_id || da.op2;
              addMember(op1, UserRole.ITP_OPERATOR);
              addMember(op2, UserRole.ITP_OFFICER);
            });
          }
        }
      } catch (e) {}

      try {
        const rawBriefing = localStorage.getItem(`fms_briefing_info_${selectedBriefingDate}_Morning`) || localStorage.getItem(`fms_briefing_info_${selectedBriefingDate}_Evening`);
        if (rawBriefing) {
          const parsedB = JSON.parse(rawBriefing);
          const bTeams = parsedB?.staffAssignments?.domesticTeams;
          if (Array.isArray(bTeams)) {
            bTeams.forEach((bt: any) => {
              addMember(bt.op1, UserRole.ITP_OPERATOR);
              addMember(bt.op2, UserRole.ITP_OFFICER);
            });
          }
        }
      } catch (e) {}
    } else {
      // Standard International flight fallback if assignedTeam is specified
      const assignedTeamName = job?.assignedTeam;
      if (assignedTeamName && domesticAssignments && domesticAssignments.length > 0) {
        const dbTeam = domesticAssignments.find((da: any) => da.team_name === assignedTeamName);
        if (dbTeam) {
          const tOp1 = dbTeam.operator1_id || dbTeam.op1;
          const tOp2 = dbTeam.operator2_id || dbTeam.op2;
          addMember(tOp1, UserRole.ITP_OPERATOR);
          addMember(tOp2, UserRole.ITP_OFFICER);
        }
      }
    }

    const hasRecipients = teamMembers.length > 0;
    const names = teamMembers.map(m => m.name).filter(Boolean);
    const summary = hasRecipients ? names.join(' & ') : 'Unassigned';

    const operators = teamMembers.filter(m => m.role === UserRole.ITP_OPERATOR);
    const officers = teamMembers.filter(m => m.role === UserRole.ITP_OFFICER);

    const operatorId = operators[0]?.id || teamMembers[0]?.id;
    const operatorName = operators.map(m => m.name).join(', ') || teamMembers.map(m => m.name).join(', ') || undefined;
    const officerId = officers[0]?.id;
    const officerName = officers.map(m => m.name).join(', ') || undefined;

    return {
      operatorId,
      operatorName,
      officerId,
      officerName,
      teamMembers,
      hasRecipients,
      summary
    };
  }, [staff, domesticAssignments, briefingInfo, selectedBriefingDate]);

  // Derives current dispatch status (Request Fueling / No Fuel) for a flight
  const getDispatchState = useCallback((job: FlightJob | any): DispatchState => {
    const cleanFlight = getCleanFlight(job);
    const flightOperationalDate = getOperationalDate(job);

    const relatedAlerts = (alerts || []).filter(a => {
      const aType = a.alertType || '';
      const isDispatchType = aType === 'REQUEST_FUELING' || aType === 'NO_FUEL' ||
        (a.message && (a.message.toLowerCase().includes('requested') || a.message.toLowerCase().includes('no fuel')));
      if (!isDispatchType) return false;

      const alertDate = a.flightDate ||
        (a.timestamp && a.timestamp.length > 10
          ? new Date(a.timestamp).toISOString().split('T')[0]
          : null);
      if (alertDate && flightOperationalDate && alertDate !== flightOperationalDate) {
        return false;
      }

      const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      if (aFlt && aFlt === cleanFlight) return true;
      const msgClean = (a.message || '').replace(/\s+/g, '').toUpperCase();
      return msgClean.includes(cleanFlight);
    }).sort((a, b) => new Date(b.timestamp || b.acknowledgedAt || 0).getTime() - new Date(a.timestamp || a.acknowledgedAt || 0).getTime());

    const latestAlert = relatedAlerts[0];
    const unackAlert = relatedAlerts.find(a => !a.acknowledged);

    const cachedRaw = cleanFlight ? dispatchCache[cleanFlight] : undefined;
    const cachedRecordDate = cachedRaw?.flightDate || (cachedRaw?.requestedAt && cachedRaw.requestedAt.length > 10 ? cachedRaw.requestedAt.split('T')[0] : null);
    const cached = (cachedRaw && (!cachedRecordDate || cachedRecordDate === flightOperationalDate))
      ? cachedRaw
      : undefined;

    let dispatchStatus: 'REQUEST_FUELING' | 'NO_FUEL' | null = null;
    let isDispatchAcknowledged = false;
    let dispatchRequestedTime = '';
    let dispatchAcknowledgedTime = '';
    let dispatchAcknowledgedBy = '';

    if (unackAlert) {
      dispatchStatus = (unackAlert.alertType === 'NO_FUEL' || (unackAlert.message && unackAlert.message.toLowerCase().includes('no fuel')))
        ? 'NO_FUEL'
        : 'REQUEST_FUELING';
      isDispatchAcknowledged = false;
      dispatchRequestedTime = formatTimeSafe(unackAlert.metadata?.requestedTime || unackAlert.metadata?.requestedAt || unackAlert.timestamp) || serverTimeService.getServerTimeString();
    } else if (latestAlert && latestAlert.acknowledged) {
      dispatchStatus = (latestAlert.alertType === 'NO_FUEL' || (latestAlert.message && latestAlert.message.toLowerCase().includes('no fuel')))
        ? 'NO_FUEL'
        : 'REQUEST_FUELING';
      isDispatchAcknowledged = true;
      dispatchRequestedTime = formatTimeSafe(latestAlert.metadata?.requestedTime || latestAlert.metadata?.requestedAt || latestAlert.timestamp) || serverTimeService.getServerTimeString();
      const ackDate = latestAlert.acknowledgedAt || latestAlert.acknowledged_at || latestAlert.metadata?.acknowledgedAt || latestAlert.metadata?.acknowledgedTime || cached?.acknowledgedTime || cached?.acknowledgedAt;
      if (ackDate) {
        dispatchAcknowledgedTime = formatTimeSafe(ackDate);
      }
      if (!dispatchAcknowledgedTime) {
        dispatchAcknowledgedTime = formatTimeSafe(latestAlert.timestamp) || dispatchRequestedTime || '--:--';
      }
      dispatchAcknowledgedBy = latestAlert.acknowledgedBy || latestAlert.metadata?.acknowledgedBy || cached?.acknowledgedBy || 'Crew';
    } else if (cached) {
      dispatchStatus = cached.status;
      isDispatchAcknowledged = !!cached.acknowledged;
      dispatchRequestedTime = formatTimeSafe(cached.requestedTime || cached.requestedAt);
      dispatchAcknowledgedTime = formatTimeSafe(cached.acknowledgedTime || cached.acknowledgedAt);
      if (isDispatchAcknowledged && !dispatchAcknowledgedTime) {
        dispatchAcknowledgedTime = dispatchRequestedTime || '--:--';
      }
      dispatchAcknowledgedBy = cached.acknowledgedBy || '';
    }

    return {
      dispatchStatus,
      isDispatchAcknowledged,
      dispatchRequestedTime,
      dispatchAcknowledgedTime,
      dispatchAcknowledgedBy,
      latestAlert
    };
  }, [alerts, dispatchCache, getCleanFlight, getOperationalDate]);

  // Send Fuel Request or No-Fuel Alert
  const sendFuelAlert = useCallback(async (job: FlightJob | any, alertType: 'REQUEST_FUELING' | 'NO_FUEL'): Promise<boolean> => {
    if (!canDispatch) {
      notify('Access Denied: Only ITP Manager or Admin can dispatch fuel alerts.', 'error');
      return false;
    }

    const cleanFlight = getCleanFlight(job);
    const flightOperationalDate = getOperationalDate(job);
    const recipients = resolveRecipients(job);

    // BLOCK DISPATCH UNTIL SOMEONE IS ASSIGNED
    if (!recipients.hasRecipients) {
      notify(`Cannot Dispatch: No crew assigned to Flight ${job.flightNumber || cleanFlight}. Please assign an operator before dispatching.`, 'warning');
      return false;
    }

    const timeNow = serverTimeService.getServerTimeString();
    const isoNow = serverTimeService.getServerIso();

    // 1. Clear any prior alerts (stale or cancellations) for this flight
    const staleAlerts = (alerts || []).filter(a => {
      const aType = a.alertType || '';
      const isDispatch = aType === 'REQUEST_FUELING' || aType === 'NO_FUEL' || aType === 'ALERT_CANCELLED';
      if (!isDispatch) return false;
      const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      if (aFlt && aFlt === cleanFlight) return true;
      const msgClean = (a.message || '').replace(/\s+/g, '').toUpperCase();
      return msgClean.includes(cleanFlight);
    });

    if (staleAlerts.length > 0) {
      try {
        await deleteAlerts(staleAlerts.map(a => a.id));
      } catch (e) {
        console.warn('Failed to delete old alerts', e);
      }
    }

    // 2. Set cache with requested timestamp and operational flight date
    updateDispatchCache(cleanFlight, {
      status: alertType,
      requestedTime: timeNow,
      requestedAt: isoNow,
      flightDate: flightOperationalDate,
      acknowledged: false
    });

    const alertMeta = {
      aircraftReg: job.aircraftReg,
      stand: job.stand,
      eta: job.eta || job.sta,
      flightNumber: job.flightNumber,
      requestedAt: isoNow,
      requestedTime: timeNow,
      assignedTo: recipients.operatorName || recipients.summary,
      assignedOfficer: recipients.officerName || undefined
    };

    const isRequest = alertType === 'REQUEST_FUELING';
    const severity = isRequest ? 'critical' : 'warning';

    // 3. Dispatch to specific assigned recipients
    try {
      const createPromises: Promise<any>[] = [];

      recipients.teamMembers.forEach(member => {
        const message = isRequest
          ? `HIGH ALERT: Fueling requested for Flight ${job.flightNumber} at Stand ${job.stand || 'TBA'}. Acknowledge to confirm.`
          : `NOTICE: Flight ${job.flightNumber} (Stand ${job.stand || 'TBA'}) requires NO FUEL.`;

        createPromises.push(
          createAlert({
            severity,
            alertType,
            flightNumber: job.flightNumber,
            flightDate: flightOperationalDate,
            message,
            timestamp: isoNow,
            acknowledged: false,
            targetRole: member.role || UserRole.ITP_OPERATOR,
            assignedStaffId: member.id,
            senderId: user?.id,
            senderName: user?.name,
            metadata: alertMeta
          })
        );
      });

      await Promise.all(createPromises);
      notify(
        isRequest
          ? `Fuel Request dispatched for ${job.flightNumber} to ${recipients.summary}.`
          : `No-Fuel confirmation dispatched for ${job.flightNumber} to ${recipients.summary}.`,
        'success'
      );
      return true;
    } catch (err) {
      console.error('Failed to dispatch alert:', err);
      notify('Failed to dispatch alert to crew.', 'error');
      return false;
    }
  }, [alerts, canDispatch, createAlert, deleteAlerts, getCleanFlight, getOperationalDate, notify, resolveRecipients, updateDispatchCache, user?.id, user?.name]);

  // Cancel Fuel Request / No-Fuel Alert
  const cancelFuelAlert = useCallback(async (job: FlightJob | any): Promise<boolean> => {
    if (!canDispatch) {
      notify('Access Denied: Only ITP Manager or Admin can cancel alerts.', 'error');
      return false;
    }

    const cleanFlight = getCleanFlight(job);
    const flightOperationalDate = getOperationalDate(job);
    const recipients = resolveRecipients(job);

    updateDispatchCache(cleanFlight, null);

    try {
      // 1. Delete all existing dispatch alerts for this flight
      const matchingAlerts = (alerts || []).filter(a => {
        const aType = a.alertType || '';
        const isDispatchType = aType === 'REQUEST_FUELING' || aType === 'NO_FUEL' ||
          (a.message && (a.message.toLowerCase().includes('requested') || a.message.toLowerCase().includes('no fuel')));
        if (!isDispatchType) return false;

        const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
        if (aFlt && aFlt === cleanFlight) return true;
        const msgClean = (a.message || '').replace(/\s+/g, '').toUpperCase();
        return msgClean.includes(cleanFlight);
      });

      if (matchingAlerts.length > 0) {
        await deleteAlerts(matchingAlerts.map(a => a.id));
      }

      // 2. Dispatch ALERT_CANCELLED alert so assigned staff gets cancellation notice
      const cancelTime = serverTimeService.getServerTimeString();
      const cancelIso = serverTimeService.getServerIso();
      const alertMeta = {
        aircraftReg: job.aircraftReg,
        stand: job.stand,
        eta: job.eta || job.sta,
        flightNumber: job.flightNumber,
        cancelledAt: cancelTime,
        cancelledBy: user?.name
      };

      if (recipients.hasRecipients) {
        const cancelPromises = recipients.teamMembers.map(member =>
          createAlert({
            severity: 'warning',
            alertType: 'ALERT_CANCELLED',
            flightNumber: job.flightNumber,
            flightDate: flightOperationalDate,
            message: `ALERT CANCELLED: Dispatch alert for Flight ${job.flightNumber} has been cancelled by Manager ${user?.name || ''}.`,
            timestamp: cancelIso,
            acknowledged: false,
            targetRole: member.role || UserRole.ITP_OPERATOR,
            assignedStaffId: member.id,
            senderId: user?.id,
            senderName: user?.name,
            metadata: alertMeta
          })
        );
        await Promise.all(cancelPromises);
      }

      notify(`Cancelled alert for Flight ${job.flightNumber}. Crew notified.`, 'info');
      return true;
    } catch (err) {
      console.error('Failed to cancel alert:', err);
      notify('Failed to cancel alert request.', 'error');
      return false;
    }
  }, [alerts, canDispatch, createAlert, deleteAlerts, getCleanFlight, getOperationalDate, notify, resolveRecipients, updateDispatchCache, user?.id, user?.name]);

  // Handle crew change (before dispatch or active dispatch)
  const handleCrewReassignment = useCallback(async (
    job: FlightJob | any,
    field: 'assignedTo' | 'assignedOfficer',
    previousStaffId: string,
    newStaffId: string
  ) => {
    if (!previousStaffId && !newStaffId) return;
    if (previousStaffId === newStaffId) return;

    const flightNumber = job.flightNumber || 'Flight';
    const flightOperationalDate = getOperationalDate(job);
    const dispatchState = getDispatchState(job);
    const usersList = staff && staff.length > 0 ? staff : MOCK_USERS;

    const prevStaff = usersList.find(s => s.id === previousStaffId || s.name.toLowerCase() === previousStaffId.toLowerCase());
    const prevStaffName = prevStaff?.name || previousStaffId;
    const newStaff = usersList.find(s => s.id === newStaffId || s.name.toLowerCase() === newStaffId.toLowerCase());
    const newStaffName = newStaff?.name || newStaffId;
    const roleTitle = field === 'assignedOfficer' ? 'Officer' : 'Operator';
    const targetRole = field === 'assignedOfficer' ? UserRole.ITP_OFFICER : UserRole.ITP_OPERATOR;
    const nowIso = serverTimeService.getServerIso();

    // CASE A: ACTIVE DISPATCH ALREADY SENT -> AUTO-CANCEL AND RE-SEND
    if (dispatchState.dispatchStatus) {
      const activeStatus = dispatchState.dispatchStatus;

      // 1. Auto-cancel alert for previous staff member
      if (previousStaffId) {
        try {
          await createAlert({
            severity: 'warning',
            alertType: 'ALERT_CANCELLED',
            flightNumber: job.flightNumber,
            flightDate: flightOperationalDate,
            message: `ALERT CANCELLED: Dispatch alert for Flight ${flightNumber} has been reassigned to another crew member by Manager ${user?.name || ''}.`,
            timestamp: nowIso,
            acknowledged: false,
            targetRole,
            assignedStaffId: previousStaffId,
            senderId: user?.id,
            senderName: user?.name,
            metadata: {
              flightNumber: job.flightNumber,
              reassignedAt: nowIso,
              reassignedBy: user?.name,
              reason: 'Crew reassigned'
            }
          });
        } catch (e) {
          console.warn('[Dispatch] Failed to send cancel to previous crew member:', e);
        }
      }

      // 2. If new staff member assigned, re-send the active dispatch alert to them
      if (newStaffId) {
        const timeNow = serverTimeService.getServerTimeString();
        const isRequest = activeStatus === 'REQUEST_FUELING';
        const message = isRequest
          ? `HIGH ALERT: Fueling requested for Flight ${flightNumber} at Stand ${job.stand || 'TBA'}. Acknowledge to confirm.`
          : `NOTICE: Flight ${flightNumber} (Stand ${job.stand || 'TBA'}) requires NO FUEL.`;

        try {
          await createAlert({
            severity: isRequest ? 'critical' : 'warning',
            alertType: activeStatus,
            flightNumber: job.flightNumber,
            flightDate: flightOperationalDate,
            message,
            timestamp: nowIso,
            acknowledged: false,
            targetRole,
            assignedStaffId: newStaffId,
            senderId: user?.id,
            senderName: user?.name,
            metadata: {
              aircraftReg: job.aircraftReg,
              stand: job.stand,
              eta: job.eta || job.sta,
              flightNumber: job.flightNumber,
              requestedAt: nowIso,
              requestedTime: timeNow,
              reassignedTo: newStaffName
            }
          });

          // Refresh cache
          const cleanFlight = getCleanFlight(job);
          updateDispatchCache(cleanFlight, {
            status: activeStatus,
            requestedTime: timeNow,
            requestedAt: nowIso,
            flightDate: flightOperationalDate,
            acknowledged: false
          });

          notify(
            `Crew reassigned for ${flightNumber}. Prior dispatch cancelled for ${prevStaffName} and re-sent to ${newStaffName}.`,
            'info'
          );
        } catch (e) {
          console.error('[Dispatch] Failed to re-send alert to new crew member:', e);
        }
      } else {
        notify(`Flight ${flightNumber} unassigned from ${prevStaffName}. Prior dispatch cancelled.`, 'info');
      }
      return;
    }

    // CASE B: BEFORE DISPATCH -> SEND ASSIGNMENT / UNASSIGNMENT NOTIFICATION TO BOTH PREVIOUS & CURRENT CREW
    try {
      const notifyPromises: Promise<any>[] = [];

      // Notify previous staff member that they have been unassigned
      if (previousStaffId) {
        notifyPromises.push(
          createAlert({
            severity: 'low',
            alertType: 'CREW_UNASSIGNED',
            flightNumber: job.flightNumber,
            flightDate: flightOperationalDate,
            message: `Assignment Update: You have been unassigned from Flight ${flightNumber} (Stand ${job.stand || 'TBA'}).`,
            timestamp: nowIso,
            acknowledged: false,
            targetRole,
            assignedStaffId: previousStaffId,
            senderId: user?.id,
            senderName: user?.name,
            metadata: {
              flightNumber: job.flightNumber,
              stand: job.stand,
              unassignedAt: nowIso,
              updatedBy: user?.name
            }
          })
        );
      }

      // Notify new staff member that they have been assigned
      if (newStaffId) {
        notifyPromises.push(
          createAlert({
            severity: 'medium',
            alertType: 'CREW_ASSIGNED',
            flightNumber: job.flightNumber,
            flightDate: flightOperationalDate,
            message: `Assignment Update: You have been assigned as ${roleTitle} for Flight ${flightNumber} (Stand ${job.stand || 'TBA'}, STD ${job.std || '--:--'}).`,
            timestamp: nowIso,
            acknowledged: false,
            targetRole,
            assignedStaffId: newStaffId,
            senderId: user?.id,
            senderName: user?.name,
            metadata: {
              flightNumber: job.flightNumber,
              stand: job.stand,
              std: job.std,
              assignedAt: nowIso,
              updatedBy: user?.name
            }
          })
        );
      }

      await Promise.all(notifyPromises);
      if (previousStaffId && newStaffId) {
        notify(`Assignment updated for ${flightNumber}. Notifications sent to ${prevStaffName} and ${newStaffName}.`, 'info');
      } else if (newStaffId) {
        notify(`Assigned ${newStaffName} to ${flightNumber}. Notification sent.`, 'info');
      } else if (previousStaffId) {
        notify(`Unassigned ${prevStaffName} from ${flightNumber}. Notification sent.`, 'info');
      }
    } catch (err) {
      console.warn('[Dispatch] Error notifying staff of assignment change:', err);
    }
  }, [canDispatch, createAlert, getCleanFlight, getDispatchState, getOperationalDate, notify, staff, updateDispatchCache, user?.id, user?.name]);

  return {
    canDispatch,
    dispatchCache,
    resolveRecipients,
    getDispatchState,
    sendFuelAlert,
    cancelFuelAlert,
    handleCrewReassignment
  };
};
