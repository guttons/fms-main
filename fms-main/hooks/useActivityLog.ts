import { useCallback } from 'react';
import { activityLogService, LogActionPayload } from '../services/activityLogService';
import { User, StaffMember } from '../types';

export const useActivityLog = (user?: User | StaffMember | null) => {
  const log = useCallback(
    async (payload: LogActionPayload) => {
      let activeUser = user;
      if (!activeUser) {
        try {
          const raw = localStorage.getItem('fms_logged_in_user');
          if (raw) activeUser = JSON.parse(raw);
        } catch {}
      }
      return activityLogService.logAction(activeUser, payload);
    },
    [user]
  );

  return { log };
};
