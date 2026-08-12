import { useEffect, useRef, useState } from 'react';
import { FlightJob, Alert, UserRole } from '../types';

interface UseEtaMonitorParams {
  flightJobs: FlightJob[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  createAlert: (alert: Omit<Alert, 'id'>) => Promise<boolean>;
  staff: any[];
}

export const useEtaMonitor = ({
  flightJobs,
  currentUserId,
  currentUserName,
  currentUserRole,
  createAlert,
  staff
}: UseEtaMonitorParams) => {
  const sentAlertsRef = useRef<Set<string>>(new Set());
  const [monitoredFlightCount, setMonitoredFlightCount] = useState(0);

  useEffect(() => {
    const checkETAs = () => {
      let count = 0;
      const now = new Date();
      const currentJobIds = new Set<string>();

      flightJobs.forEach(job => {
        if (job.status === 'COMPLETED' || job.status === 'CANCELED') return;
        
        currentJobIds.add(job.id);

        const isAssignedToMe = (
          job.assignedTo === currentUserId ||
          (job.assignedTo && job.assignedTo.toLowerCase() === currentUserName.toLowerCase()) ||
          job.assignedOfficer === currentUserId ||
          (job.assignedOfficer && job.assignedOfficer.toLowerCase() === currentUserName.toLowerCase())
        );

        if (!isAssignedToMe) return;
        
        count++;

        const timeStr = job.eta || job.sta;
        if (!timeStr) return;

        const [hoursStr, minutesStr] = timeStr.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);
        if (isNaN(hours) || isNaN(minutes)) return;

        const targetTime = new Date(now);
        targetTime.setHours(hours, minutes, 0, 0);

        // If the time has already passed (e.g., flight was yesterday or earlier today)
        if (targetTime.getTime() < now.getTime()) {
           // check if we are within the small window still, otherwise skip
           if (now.getTime() - targetTime.getTime() > 60000) {
               return; 
           }
        }

        const diffMs = targetTime.getTime() - now.getTime();
        const diffMins = diffMs / 60000;

        const key15 = `${job.id}-15`;
        const key5 = `${job.id}-5`;

        if (diffMins >= 14 && diffMins <= 16 && !sentAlertsRef.current.has(key15)) {
          sentAlertsRef.current.add(key15);
          createAlert({
            alertType: 'ETA_15MIN',
            severity: 'medium',
            targetRole: currentUserRole,
            message: `[ETA_ALERT:15MIN] Flight ${job.flightNumber} arriving in ~15 minutes at Stand ${job.stand}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            flightNumber: job.flightNumber,
            assignedStaffId: currentUserId,
            metadata: {
              aircraftReg: job.aircraftReg,
              stand: job.stand,
              eta: timeStr
            }
          });
        }

        if (diffMins >= 4 && diffMins <= 6 && !sentAlertsRef.current.has(key5)) {
          sentAlertsRef.current.add(key5);
          createAlert({
            alertType: 'ETA_5MIN',
            severity: 'critical',
            targetRole: currentUserRole,
            message: `[ETA_ALERT:5MIN] Flight ${job.flightNumber} arriving in ~5 minutes at Stand ${job.stand}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            flightNumber: job.flightNumber,
            assignedStaffId: currentUserId,
            metadata: {
              aircraftReg: job.aircraftReg,
              stand: job.stand,
              eta: timeStr
            }
          });
        }
      });

      setMonitoredFlightCount(count);

      // Cleanup alerts for jobs that no longer exist or are completed
      const newSent = new Set<string>();
      sentAlertsRef.current.forEach(key => {
        const jobId = key.split('-')[0];
        if (currentJobIds.has(jobId)) {
          newSent.add(key);
        }
      });
      sentAlertsRef.current = newSent;
    };

    checkETAs();
    const interval = setInterval(checkETAs, 30000);

    return () => clearInterval(interval);
  }, [flightJobs, currentUserId, currentUserName, currentUserRole, createAlert, staff]);

  return { monitoredFlightCount };
};
