// Calibration lookup service
// Provides dip height (mm) to volume (liters) conversion using calibration data
// Data source: fuel - calibration.csv imported to public/data/calibration.json

type CalibrationMap = Record<string, number[]>;

let calibrationCache: CalibrationMap | null = null;
let fetchPromise: Promise<CalibrationMap> | null = null;

// Tank IDs that have calibration data available
export const CALIBRATED_TANK_IDS = new Set([
  'tk101', 'tk102', 'tk103', 'tk106',
  'tk201', 'tk202',
  'tk301', 'tk302',
  'tk4', 'tk6', 'tk7', 'tk8', 'tk9',
  'off-diesel'
]);

async function loadCalibrationData(): Promise<CalibrationMap> {
  if (calibrationCache) return calibrationCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/data/calibration.json')
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load calibration data: ${res.status}`);
      return res.json() as Promise<CalibrationMap>;
    })
    .then(data => {
      calibrationCache = data;
      fetchPromise = null;
      console.log('[Calibration] Loaded calibration data for', Object.keys(data).length, 'tanks');
      return data;
    })
    .catch(err => {
      fetchPromise = null;
      console.error('[Calibration] Failed to load calibration data:', err);
      return {} as CalibrationMap;
    });

  return fetchPromise;
}

/**
 * Look up the volume in liters for a given tank and dip height.
 * The calibration arrays are indexed by dip_mm (index 0 = 0mm, index 1 = 1mm, etc.)
 * If the exact dip value exceeds the array length, the last value is returned.
 * Returns null if no calibration data exists for the tank.
 */
export async function lookupVolume(tankId: string, dipMm: number): Promise<number | null> {
  if (!CALIBRATED_TANK_IDS.has(tankId)) return null;
  
  const data = await loadCalibrationData();
  const tankData = data[tankId];
  if (!tankData || tankData.length === 0) return null;

  const index = Math.max(0, Math.round(dipMm));
  if (index >= tankData.length) {
    return tankData[tankData.length - 1]; // Cap at max calibrated volume
  }
  return tankData[index];
}

/**
 * Synchronous lookup - only works if data is already cached.
 * Returns null if data hasn't been loaded yet or tank has no calibration.
 */
export function lookupVolumeSync(tankId: string, dipMm: number): number | null {
  if (!calibrationCache || !CALIBRATED_TANK_IDS.has(tankId)) return null;
  
  const tankData = calibrationCache[tankId];
  if (!tankData || tankData.length === 0) return null;

  const index = Math.max(0, Math.round(dipMm));
  if (index >= tankData.length) {
    return tankData[tankData.length - 1];
  }
  return tankData[index];
}

/**
 * Preload calibration data (call on page mount).
 */
export function preloadCalibrationData(): void {
  loadCalibrationData();
}

/**
 * Get the maximum dip height (mm) for a given tank.
 * Returns 0 if no calibration data is available.
 */
export function getMaxDipMm(tankId: string): number {
  if (!calibrationCache || !CALIBRATED_TANK_IDS.has(tankId)) return 0;
  const tankData = calibrationCache[tankId];
  return tankData ? tankData.length - 1 : 0;
}

/**
 * Look up the dip height in mm for a given tank and volume in liters.
 * Performs a binary search on the cached calibration array to find the closest match.
 * Fallback to linear calculation if no calibration data is cached or available.
 */
export function lookupDipSync(tankId: string, volumeLiters: number, capacity: number): number {
  if (calibrationCache && CALIBRATED_TANK_IDS.has(tankId)) {
    const tankData = calibrationCache[tankId];
    if (tankData && tankData.length > 0) {
      let low = 0;
      let high = tankData.length - 1;
      let closestIndex = 0;
      let minDiff = Math.abs(tankData[0] - volumeLiters);
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const val = tankData[mid];
        const diff = Math.abs(val - volumeLiters);
        
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = mid;
        }
        
        if (val === volumeLiters) {
          return mid;
        } else if (val < volumeLiters) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return closestIndex;
    }
  }
  // Fallback linear calculation: assumes max dip of 4000mm at full capacity
  return capacity > 0 ? Math.round((volumeLiters / capacity) * 4000) : 0;
}

