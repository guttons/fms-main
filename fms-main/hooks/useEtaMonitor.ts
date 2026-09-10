import { useEffect, useRef, useState } from 'react';
import { FlightJob, Alert, UserRole } from '../types';

interface UseEtaMonitorParams {
  flightJobs: FlightJob[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  createAlert: (alert: Omit<Alert, 'id'>) => Promise<boolean>;
  staff: any[];
  updateFlightJob?: (id: string, updates: Partial<FlightJob>) => Promise<void>;
}

const getStoredEtaAlerts = (dateStr: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`fms_sent_eta_${dateStr}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveStoredEtaAlert = (dateStr: string, key: string) => {
  try {
    const set = getStoredEtaAlerts(dateStr);
    set.add(key);
    localStorage.setItem(`fms_sent_eta_${dateStr}`, JSON.stringify(Array.from(set)));
  } catch {}
};

import { getWatchedFlightIds } from '../services/watchedFlightsService';

export const useEtaMonitor = ({
  flightJobs,
  currentUserId,
  currentUserName,
  currentUserRole,
  createAlert,
  staff,
  updateFlightJob
}: UseEtaMonitorParams) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const sentAlertsRef = useRef<Set<string>>(getStoredEtaAlerts(todayStr));
  const [monitoredFlightCount, setMonitoredFlightCount] = useState(0);

  useEffect(() => {
    const checkETAs = () => {
      let count = 0;
      const now = new Date();

      // Reload each cycle so toggles take effect within 30s
      const watchedFlightNumbers = getWatchedFlightIds(currentUserId);

      flightJobs.forEach(job => {
        if (job.status === 'COMPLETED' || job.status === 'CANCELED') return;

        const isAssignedToMe = (
          job.assignedTo === currentUserId ||
          (job.assignedTo && job.assignedTo.toLowerCase() === currentUserName.toLowerCase()) ||
          job.assignedOfficer === currentUserId ||
          (job.assignedOfficer && job.assignedOfficer.toLowerCase() === currentUserName.toLowerCase())
        );

        const isWatchedByMe = watchedFlightNumbers.has(job.flightNumber);

        if (!isAssignedToMe && !isWatchedByMe) return;

        count++;

        const timeStr = job.eta || job.sta;
        if (!timeStr) return;

        const [hoursStr, minutesStr] = timeStr.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);
        if (isNaN(hours) || isNaN(minutes)) return;

        const targetTime = new Date(now);
        targetTime.setHours(hours, minutes, 0, 0);

        if (targetTime.getTime() < now.getTime()) {
          if (now.getTime() - targetTime.getTime() > 60000) return;
        }

        const diffMs = targetTime.getTime() - now.getTime();
        const diffMins = diffMs / 60000;

        const jobKey = job.id || job.flightNumber;
        const key15 = `${jobKey}-15`;
        const key5 = `${jobKey}-5`;

        if (diffMins <= 15.5 && diffMins > 5.5 && !job.eta_alert_15_sent && !sentAlertsRef.current.has(key15)) {
          sentAlertsRef.current.add(key15);
          saveStoredEtaAlert(todayStr, key15);
          if (updateFlightJob && job.id && !job.id.startsWith('live-')) {
            updateFlightJob(job.id, { eta_alert_15_sent: true }).catch(console.warn);
          }
          createAlert({
            alertType: 'ETA_15MIN',
            severity: 'medium',
            targetRole: currentUserRole,
            message: `[ETA_ALERT:15MIN] Flight ${job.flightNumber} arriving in ~15 minutes${job.stand ? ` at Stand ${job.stand}` : ''}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            flightNumber: job.flightNumber,
            assignedStaffId: currentUserId,
            metadata: {
              aircraftReg: job.aircraftReg,
              stand: job.stand,
              eta: timeStr,
              isWatchedFlight: isWatchedByMe && !isAssignedToMe
            }
          });
        }

        if (diffMins <= 5.5 && diffMins >= -1 && !job.eta_alert_5_sent && !sentAlertsRef.current.has(key5)) {
          sentAlertsRef.current.add(key5);
          saveStoredEtaAlert(todayStr, key5);
          if (updateFlightJob && job.id && !job.id.startsWith('live-')) {
            updateFlightJob(job.id, { eta_alert_5_sent: true }).catch(console.warn);
          }
          createAlert({
            alertType: 'ETA_5MIN',
            severity: 'critical',
            targetRole: currentUserRole,
            message: `[ETA_ALERT:5MIN] Flight ${job.flightNumber} arriving in ~5 minutes${job.stand ? ` at Stand ${job.stand}` : ''}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            flightNumber: job.flightNumber,
            assignedStaffId: currentUserId,
            metadata: {
              aircraftReg: job.aircraftReg,
              stand: job.stand,
              eta: timeStr,
              isWatchedFlight: isWatchedByMe && !isAssignedToMe
            }
          });
        }
      });

      setMonitoredFlightCount(count);
    };

    checkETAs();
    const interval = setInterval(checkETAs, 30000);
    return () => clearInterval(interval);
  }, [flightJobs, currentUserId, currentUserName, currentUserRole, createAlert, staff, updateFlightJob, todayStr]);

  return { monitoredFlightCount };
};
