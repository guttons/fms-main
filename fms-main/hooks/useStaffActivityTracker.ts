import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../supabase';
import { User } from '../types';

interface UseStaffActivityTrackerParams {
  user: User | null;
  isAuthenticated: boolean;
}

export const useStaffActivityTracker = ({ user, isAuthenticated }: UseStaffActivityTrackerParams) => {
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Logs a specific activity to the staff_activity_log table
   */
  const logActivity = useCallback(async (type: string, data: any = {}) => {
    if (!user) return;
    try {
      await supabase.from('staff_activity_log').insert([{ 
        staff_id: user.id, 
        activity_type: type, 
        activity_data: data 
      }]);
    } catch (error) {
      console.warn('[Tracker] Failed to log activity:', error);
    }
  }, [user]);

  /**
   * Updates the staff member's live status and optionally job/vehicle assignments
   */
  const updateStatus = useCallback(async (status: string, jobId?: string, vehicleId?: string) => {
    if (!user) return;
    try {
      const updates: any = { 
        current_status: status, 
        last_active_at: new Date().toISOString() 
      };
      if (jobId !== undefined) updates.current_job_id = jobId;
      if (vehicleId !== undefined) updates.current_vehicle_id = vehicleId;

      await supabase.from('staff').update(updates).eq('id', user.id);
    } catch (error) {
      console.warn('[Tracker] Failed to update status:', error);
    }
  }, [user]);

  // Handle lifecycle and heartbeat
  useEffect(() => {
    if (isAuthenticated && user) {
      // On mount/login
      logActivity('LOGIN');
      updateStatus('ONLINE');

      // Heartbeat every 5 minutes to update last_active_at
      intervalRef.current = setInterval(() => {
        supabase.from('staff')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', user.id)
          .then(({ error }) => { if (error) console.warn('[Tracker] Heartbeat failed:', error); });
      }, 5 * 60 * 1000);

      // Handle beforeunload to mark as offline
      const handleBeforeUnload = () => {
        // We use a fire-and-forget promise here since we can't await in beforeunload easily
        supabase.from('staff_activity_log').insert([{ 
          staff_id: user.id, 
          activity_type: 'LOGOUT', 
          activity_data: {} 
        }]).then();
        
        supabase.from('staff').update({ 
          current_status: 'OFFLINE', 
          last_active_at: new Date().toISOString() 
        }).eq('id', user.id).then();
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Cleanup on unmount/logout
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        
        logActivity('LOGOUT');
        updateStatus('OFFLINE');
      };
    }
  }, [isAuthenticated, user, logActivity, updateStatus]);

  /**
   * Starts GPS location tracking using Geolocation API
   */
  const startLocationTracking = useCallback(() => {
    if (!user || !navigator.geolocation) return;
    
    setIsTrackingLocation(true);
    let lastUpdate = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        // Debounce updates to every 30 seconds
        if (now - lastUpdate > 30000) {
          lastUpdate = now;
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          supabase.from('staff').update({ 
            current_location: location,
            last_active_at: new Date().toISOString()
          }).eq('id', user.id).then(({ error }) => { if (error) console.warn('[Tracker] Failed to update location:', error); });
          
          logActivity('LOCATION_UPDATE', location);
        }
      },
      (error) => {
        console.warn('[Tracker] Location tracking error:', error);
        setIsTrackingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  }, [user, logActivity]);

  /**
   * Stops GPS location tracking
   */
  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingLocation(false);
  }, []);

  return {
    logActivity,
    updateStatus,
    startLocationTracking,
    stopLocationTracking,
    isTrackingLocation,
  };
};
