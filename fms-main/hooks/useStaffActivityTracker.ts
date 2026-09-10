import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../supabase';
import { User } from '../types';

interface UseStaffActivityTrackerParams {
  user: User | null;
  isAuthenticated: boolean;
  skipLifecycle?: boolean;
}

/**
 * Approximate apron / stand zone detection for Velana International Airport (MLE)
 */
export const detectAirportZone = (lat: number, lng: number): string => {
  // MLE roughly spans lat: 4.183 to 4.205, lng: 73.523 to 73.538
  const isMLE = lat >= 4.180 && lat <= 4.210 && lng >= 73.520 && lng <= 73.545;
  if (!isMLE) {
    return `Field Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }

  // Seaplane / TMA Terminal North
  if (lat >= 4.1960) {
    return 'Seaplane Terminal / Waterdrome';
  }
  // North Apron (Stands 1 - 5)
  if (lat >= 4.1920 && lat < 4.1960) {
    return 'North Apron (Stands 1–5)';
  }
  // Main Terminal International Apron (Stands 6 - 11)
  if (lat >= 4.1890 && lat < 4.1920 && lng <= 73.5310) {
    return 'Main Apron (Stands 6–11)';
  }
  // Fuel Depot & Bowser Loading Station (East side)
  if (lat >= 4.1870 && lat < 4.1920 && lng > 73.5310) {
    return 'Depot / Refueller Loading Station';
  }
  // South Apron (Stands 12 - 20)
  if (lat < 4.1890) {
    return 'South Apron (Stands 12–20)';
  }

  return 'MLE Apron Area';
};

// Remote staff tracking enabled now that migrations are applied in Supabase
export const ENABLE_REMOTE_STAFF_TRACKING = true;

export const useStaffActivityTracker = ({ user, isAuthenticated, skipLifecycle = false }: UseStaffActivityTrackerParams) => {
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const statusRef = useRef<string>('ONLINE');
  const currentLocationRef = useRef<any>(null);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  /**
   * Logs an activity to localStorage (and staff_activity_log table if remote tracking is enabled)
   */
  const logActivity = useCallback(async (type: string, data: any = {}) => {
    if (!user) return;
    try {
      // Always store locally for timeline and audit
      const localLogsKey = `fms_staff_activity_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(localLogsKey) || '[]');
      const newEntry = {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staff_id: user.id,
        activity_type: type,
        activity_data: data,
        created_at: new Date().toISOString()
      };
      localStorage.setItem(localLogsKey, JSON.stringify([newEntry, ...existing.slice(0, 49)]));

      if (!ENABLE_REMOTE_STAFF_TRACKING) return;

      const { error } = await supabase.from('staff_activity_log').insert([{ 
        staff_id: user.id, 
        activity_type: type, 
        activity_data: data 
      }]);
      if (error) {
        console.warn('[Staff Tracker] Failed to log activity to Supabase:', error.message || error);
      }
    } catch (error) {
      console.warn('[Tracker] Failed to log activity:', error);
    }
  }, [user]);

  /**
   * Updates the staff member's live status and optional job/vehicle assignments
   */
  const updateStatus = useCallback(async (status: string, jobId?: string, vehicleId?: string) => {
    if (!user) return;
    statusRef.current = status;
    try {
      // Always persist current status to localStorage for instant local access
      localStorage.setItem(`fms_staff_status_${user.id}`, status);

      // Broadcast real-time presence immediately to all connected devices
      if (presenceChannelRef.current) {
        presenceChannelRef.current.track({
          id: user.id,
          name: user.name,
          role: user.role,
          status,
          location: currentLocationRef.current,
          lastActive: new Date().toISOString()
        }).catch(() => {});
      }

      if (!ENABLE_REMOTE_STAFF_TRACKING) return;

      const updates: any = { 
        current_status: status, 
        last_active_at: new Date().toISOString() 
      };
      if (jobId !== undefined) updates.current_job_id = jobId;
      if (vehicleId !== undefined) updates.current_vehicle_id = vehicleId;

      const { error } = await supabase.from('staff')
        .update(updates)
        .or(`id.eq.${user.id},employee_id.eq.${user.id}`);

      if (error) {
        console.warn('[Staff Tracker] Failed to update status in Supabase:', error.message || error);
      }
    } catch (error) {
      console.warn('[Tracker] Failed to update status:', error);
    }
  }, [user]);

  /**
   * Handles saving a received position
   */
  const handlePositionSuccess = useCallback(async (position: GeolocationPosition) => {
    if (!user) return;
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = Math.round(position.coords.accuracy);
    const zone = detectAirportZone(lat, lng);

    const locationData = {
      lat,
      lng,
      accuracy,
      zone,
      timestamp: new Date().toISOString()
    };

    setCurrentLocation(locationData);
    currentLocationRef.current = locationData;
    setIsTrackingLocation(true);
    setShowLocationPrompt(false);
    setIsRequestingLocation(false);

    // Broadcast updated location on presence channel
    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({
        id: user.id,
        name: user.name,
        role: user.role,
        status: statusRef.current,
        location: locationData,
        lastActive: new Date().toISOString()
      }).catch(() => {});
    }

    try {
      // Save to localStorage for instant local access
      localStorage.setItem(`fms_staff_location_${user.id}`, JSON.stringify(locationData));

      // Update staff record in Supabase if remote tracking is enabled
      if (ENABLE_REMOTE_STAFF_TRACKING) {
        const { error } = await supabase.from('staff').update({ 
          current_location: locationData,
          last_active_at: new Date().toISOString() 
        }).or(`id.eq.${user.id},employee_id.eq.${user.id}`);

        if (error) {
          console.warn('[Staff Tracker] Failed to sync location to Supabase:', error.message || error);
        } else {
          logActivity('LOCATION_SHARED', { zone, accuracy });
        }
      }
    } catch (err) {
      console.warn('[Tracker] Failed to sync location to database:', err);
    }
  }, [user, logActivity]);

  /**
   * Starts GPS location tracking using Geolocation API
   */
  const startLocationTracking = useCallback(() => {
    if (!user || !('geolocation' in navigator)) {
      setShowLocationPrompt(false);
      return;
    }

    setIsRequestingLocation(true);

    // Initial immediate fix
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionSuccess(position);

        // Then start continuous watch
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }

        let lastUpdate = Date.now();
        watchIdRef.current = navigator.geolocation.watchPosition(
          (watchPos) => {
            const now = Date.now();
            // Debounce position updates to every 20 seconds
            if (now - lastUpdate >= 20000) {
              lastUpdate = now;
              handlePositionSuccess(watchPos);
            }
          },
          (error) => {
            console.warn('[Tracker] Watch position error:', error);
          },
          { 
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 20000
          }
        );
      },
      (error) => {
        console.warn('[Tracker] Initial location permission denied or error:', error);
        setIsRequestingLocation(false);
        setIsTrackingLocation(false);
      },
      { 
        enableHighAccuracy: true,
        timeout: 15000 
      }
    );
  }, [user, handlePositionSuccess]);

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

  /**
   * Dismiss the prompt for this session
   */
  const dismissLocationPrompt = useCallback(() => {
    setShowLocationPrompt(false);
    sessionStorage.setItem('fms_location_prompt_dismissed', 'true');
  }, []);

  // Check and prompt on login / authentication
  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect to Realtime Presence channel
      const channel = supabase.channel('fms_staff_presence', {
        config: { presence: { key: user.id } }
      });
      presenceChannelRef.current = channel;

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            name: user.name,
            role: user.role,
            status: statusRef.current,
            location: currentLocationRef.current,
            lastActive: new Date().toISOString()
          }).catch(() => {});
        }
      });

      if (!skipLifecycle) {
        // On mount/login
        logActivity('LOGIN');
        updateStatus('ONLINE');

        // Heartbeat every 60 seconds to update last_active_at and presence
        intervalRef.current = setInterval(async () => {
          if (presenceChannelRef.current) {
            presenceChannelRef.current.track({
              id: user.id,
              name: user.name,
              role: user.role,
              status: statusRef.current,
              location: currentLocationRef.current,
              lastActive: new Date().toISOString()
            }).catch(() => {});
          }

          if (ENABLE_REMOTE_STAFF_TRACKING) {
            const { error } = await supabase.from('staff')
              .update({ last_active_at: new Date().toISOString() })
              .or(`id.eq.${user.id},employee_id.eq.${user.id}`);
            if (error) {
              console.warn('[Staff Tracker] Heartbeat update failed:', error.message || error);
            }
          }
        }, 60 * 1000);
      }

      // Check if location permission is already granted or if we should prompt
      if ('geolocation' in navigator) {
        if ('permissions' in navigator) {
          navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
            if (result.state === 'granted') {
              startLocationTracking();
            } else if (result.state === 'prompt') {
              const dismissed = sessionStorage.getItem('fms_location_prompt_dismissed');
              if (!dismissed) {
                // Prompt user to share location
                setShowLocationPrompt(true);
              }
            }
          }).catch(() => {
            // Fallback: prompt if not dismissed
            const dismissed = sessionStorage.getItem('fms_location_prompt_dismissed');
            if (!dismissed) setShowLocationPrompt(true);
          });
        } else {
          // Geolocation supported without permissions API
          const dismissed = sessionStorage.getItem('fms_location_prompt_dismissed');
          if (!dismissed) setShowLocationPrompt(true);
        }
      }

      // Handle beforeunload
      const handleBeforeUnload = () => {
        if (presenceChannelRef.current) {
          presenceChannelRef.current.untrack().catch(() => {});
        }
        if (!skipLifecycle && ENABLE_REMOTE_STAFF_TRACKING) {
          supabase.from('staff_activity_log').insert([{ 
            staff_id: user.id, 
            activity_type: 'LOGOUT', 
            activity_data: {} 
          }]).then();
          
          supabase.from('staff').update({ 
            current_status: 'OFFLINE', 
            last_active_at: new Date().toISOString() 
          }).or(`id.eq.${user.id},employee_id.eq.${user.id}`).then();
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Cleanup on unmount/logout
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        window.removeEventListener('beforeunload', handleBeforeUnload);
        
        if (presenceChannelRef.current) {
          presenceChannelRef.current.untrack().catch(() => {});
          supabase.removeChannel(presenceChannelRef.current);
          presenceChannelRef.current = null;
        }

        if (!skipLifecycle) {
          logActivity('LOGOUT');
          updateStatus('OFFLINE');
        }
      };
    }
  }, [isAuthenticated, user, skipLifecycle, logActivity, updateStatus, startLocationTracking]);

  return {
    logActivity,
    updateStatus,
    startLocationTracking,
    stopLocationTracking,
    isTrackingLocation,
    showLocationPrompt,
    setShowLocationPrompt,
    dismissLocationPrompt,
    isRequestingLocation,
    currentLocation
  };
};
