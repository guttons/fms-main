import { supabaseService } from './supabaseService';

export interface AircraftLookupResult {
  registration: string;
  aircraftType: string;
  airlineName?: string;
  source: 'LOCAL_DB' | 'PLANESPOTTERS_LIVE' | 'PREFIX_PATTERN' | 'MANUAL';
  photoUrl?: string;
  found: boolean;
}

/**
 * Format registration string consistently (e.g., "8q-iar" -> "8Q-IAR", "a6eeo" -> "A6-EEO", "hssxa" -> "HS-SXA")
 */
export function normalizeRegistration(reg: string): string {
  if (!reg) return '';
  let clean = reg.trim().toUpperCase().replace(/\s+/g, '');
  if (/^8Q[A-Z0-9]{3,}$/.test(clean) && !clean.includes('-')) {
    clean = `8Q-${clean.substring(2)}`;
  } else if (/^A6[A-Z0-9]{3,}$/.test(clean) && !clean.includes('-')) {
    clean = `A6-${clean.substring(2)}`;
  } else if (/^A7[A-Z0-9]{3,}$/.test(clean) && !clean.includes('-')) {
    clean = `A7-${clean.substring(2)}`;
  } else if (/^9V[A-Z0-9]{3,}$/.test(clean) && !clean.includes('-')) {
    clean = `9V-${clean.substring(2)}`;
  } else if (/^4R[A-Z0-9]{3,}$/.test(clean) && !clean.includes('-')) {
    clean = `4R-${clean.substring(2)}`;
  } else if (/^RA[0-9]{5}$/.test(clean) && !clean.includes('-')) {
    clean = `RA-${clean.substring(2)}`;
  } else if (/^HS[A-Z0-9]{3,}$/.test(clean) && !clean.includes('-')) {
    clean = `HS-${clean.substring(2)}`;
  } else if (/^VT[A-Z0-9]{3,}$/.test(clean) && !clean.includes('-')) {
    clean = `VT-${clean.substring(2)}`;
  }
  return clean;
}

/**
 * Simplify all aircraft types to high-level short codes (e.g. ATR, B777, A320)
 */
export function cleanAircraftTypeName(raw: string): string {
  if (!raw) return '';
  const type = raw.trim().toUpperCase();

  // Boeing
  if (type.includes('777') || type.includes('77W') || type.includes('772') || type.includes('TRIPLE SEVEN') || type.includes('B77')) return 'B777';
  if (type.includes('787') || type.includes('789') || type.includes('781') || type.includes('B788') || type.includes('DREAMLINER')) return 'B787';
  if (type.includes('737') || type.includes('738') || type.includes('73M') || type.includes('B73') || type.includes('MAX')) return 'B737';
  if (type.includes('747') || type.includes('B74') || type.includes('JUMBO')) return 'B747';
  if (type.includes('767') || type.includes('B76')) return 'B767';
  if (type.includes('757') || type.includes('B75')) return 'B757';

  // Airbus
  if (type.includes('A320') || type.includes('A20N') || type.includes('320')) return 'A320';
  if (type.includes('A321') || type.includes('A21N') || type.includes('321')) return 'A321';
  if (type.includes('A319') || type.includes('319')) return 'A319';
  if (type.includes('A330') || type.includes('A332') || type.includes('A333') || type.includes('A339') || type.includes('330')) return 'A330';
  if (type.includes('A350') || type.includes('A359') || type.includes('A351') || type.includes('350')) return 'A350';
  if (type.includes('A380') || type.includes('A388') || type.includes('380')) return 'A380';
  if (type.includes('A220') || type.includes('BCS3') || type.includes('CGRAPH')) return 'A220';

  // Turboprops & Regional
  if (type.includes('ATR') || type.includes('AT7') || type.includes('AT4')) return 'ATR';
  if (type.includes('DHC-6') || type.includes('TWIN OTTER') || type.includes('DHC6')) return 'DHC6';
  if (type.includes('DH8') || type.includes('DASH 8') || type.includes('Q400')) return 'DH8D';
  if (type.includes('EMBRAER') || type.includes('E190') || type.includes('E195') || type.includes('E170')) return 'E190';
  if (type.includes('CRJ')) return 'CRJ';

  return raw.trim();
}

/**
 * Known airline fleet registration patterns for instant offline resolution
 */
const KNOWN_FLEET_PATTERNS: Array<{
  pattern: RegExp;
  aircraftType: string;
  airlineName: string;
}> = [
  // Maldivian Fleet
  { pattern: /^8Q-IA[IN]$/, aircraftType: 'A320', airlineName: 'Maldivian' },
  { pattern: /^8Q-IB[A-Z]$/, aircraftType: 'A321', airlineName: 'Maldivian' },
  { pattern: /^8Q-IA[RSTUVWX]$/, aircraftType: 'ATR', airlineName: 'Maldivian' },
  { pattern: /^8Q-MS[A-Z0-9]$/, aircraftType: 'DHC6', airlineName: 'Maldivian' },

  // Trans Maldivian Airways Seaplanes
  { pattern: /^8Q-TM[A-Z0-9]$/, aircraftType: 'DHC6', airlineName: 'Trans Maldivian Airways' },
  { pattern: /^8Q-TQ[A-Z0-9]$/, aircraftType: 'DHC6', airlineName: 'Trans Maldivian Airways' },
  { pattern: /^8Q-TV[A-Z0-9]$/, aircraftType: 'DHC6', airlineName: 'Trans Maldivian Airways' },

  // Manta Air & Villa Air
  { pattern: /^8Q-RA[A-Z]$/, aircraftType: 'ATR', airlineName: 'Manta Air' },
  { pattern: /^8Q-MA[A-Z]$/, aircraftType: 'DHC6', airlineName: 'Manta Air' },
  { pattern: /^8Q-VA[A-Z]$/, aircraftType: 'ATR', airlineName: 'Villa Air' },

  // Thai Airways & Thai AirAsia
  { pattern: /^HS-SX[A-Z]$/, aircraftType: 'B787', airlineName: 'Thai Airways' },
  { pattern: /^HS-BD[A-Z]$/, aircraftType: 'A320', airlineName: 'Thai AirAsia' },
  { pattern: /^HS-AB[A-Z]$/, aircraftType: 'A320', airlineName: 'Thai AirAsia' },

  // Emirates
  { pattern: /^A6-EE[A-Z]$/, aircraftType: 'A380', airlineName: 'Emirates' },
  { pattern: /^A6-EO[A-Z]$/, aircraftType: 'A380', airlineName: 'Emirates' },
  { pattern: /^A6-EV[A-Z]$/, aircraftType: 'A380', airlineName: 'Emirates' },
  { pattern: /^A6-EU[A-Z]$/, aircraftType: 'A380', airlineName: 'Emirates' },
  { pattern: /^A6-EP[A-Z]$/, aircraftType: 'B777', airlineName: 'Emirates' },
  { pattern: /^A6-EQ[A-Z]$/, aircraftType: 'B777', airlineName: 'Emirates' },
  { pattern: /^A6-EB[A-Z]$/, aircraftType: 'B777', airlineName: 'Emirates' },
  { pattern: /^A6-EC[A-Z]$/, aircraftType: 'B777', airlineName: 'Emirates' },
  { pattern: /^A6-EG[A-Z]$/, aircraftType: 'B777', airlineName: 'Emirates' },
  { pattern: /^A6-EN[A-Z]$/, aircraftType: 'B777', airlineName: 'Emirates' },

  // Air Arabia
  { pattern: /^A6-AO[A-Z]$/, aircraftType: 'A320', airlineName: 'Air Arabia' },
  { pattern: /^A6-AT[A-Z]$/, aircraftType: 'A321', airlineName: 'Air Arabia' },

  // Qatar Airways
  { pattern: /^A7-AL[A-Z]$/, aircraftType: 'A350', airlineName: 'Qatar Airways' },
  { pattern: /^A7-AN[A-Z]$/, aircraftType: 'A350', airlineName: 'Qatar Airways' },
  { pattern: /^A7-BA[A-Z]$/, aircraftType: 'B777', airlineName: 'Qatar Airways' },
  { pattern: /^A7-BE[A-Z]$/, aircraftType: 'B777', airlineName: 'Qatar Airways' },
  { pattern: /^A7-BC[A-Z]$/, aircraftType: 'B787', airlineName: 'Qatar Airways' },
  { pattern: /^A7-BH[A-Z]$/, aircraftType: 'B787', airlineName: 'Qatar Airways' },

  // Singapore Airlines & Air India
  { pattern: /^9V-SM[A-Z]$/, aircraftType: 'A350', airlineName: 'Singapore Airlines' },
  { pattern: /^9V-SH[A-Z]$/, aircraftType: 'A350', airlineName: 'Singapore Airlines' },
  { pattern: /^9V-SC[A-Z]$/, aircraftType: 'B787', airlineName: 'Singapore Airlines' },
  { pattern: /^9V-SW[A-Z]$/, aircraftType: 'B777', airlineName: 'Singapore Airlines' },
  { pattern: /^VT-EX[A-Z]$/, aircraftType: 'A320', airlineName: 'Air India' }
];

export const aircraftLookupService = {
  /**
   * Main function to look up aircraft type by registration
   */
  async lookupAircraftByRegistration(rawReg: string): Promise<AircraftLookupResult> {
    const normReg = normalizeRegistration(rawReg);
    if (!normReg || normReg.length < 3) {
      return { registration: '', aircraftType: '', found: false, source: 'MANUAL' };
    }

    // Step 1: Check Local Master Database / Supabase Cache
    try {
      const masterList = await supabaseService.getAircraftMaster();
      const localMatch = masterList.find(
        a => normalizeRegistration(a.aircraftReg) === normReg && a.aircraftType && a.aircraftType !== 'Unknown'
      );

      if (localMatch) {
        const shortType = cleanAircraftTypeName(localMatch.aircraftType);
        return {
          registration: normReg,
          aircraftType: shortType,
          airlineName: localMatch.airlineName,
          source: 'LOCAL_DB',
          found: true
        };
      }
    } catch (e) {
      // Ignore
    }

    // Step 2: Check Specific Fleet Registration Pattern Rules
    for (const entry of KNOWN_FLEET_PATTERNS) {
      if (entry.pattern.test(normReg)) {
        const shortType = cleanAircraftTypeName(entry.aircraftType);
        this.cacheResolvedAircraft(normReg, shortType, entry.airlineName);
        return {
          registration: normReg,
          aircraftType: shortType,
          airlineName: entry.airlineName,
          source: 'PREFIX_PATTERN',
          found: true
        };
      }
    }

    // Step 3: Direct API lookup (with silent fail to prevent browser console CORS noise)
    try {
      const directResult = await this.queryDirectPlanespotters(normReg);
      if (directResult.found && directResult.aircraftType) {
        this.cacheResolvedAircraft(normReg, directResult.aircraftType, directResult.airlineName || 'Unknown');
        return directResult;
      }
    } catch (e) {
      // Ignore
    }

    return {
      registration: normReg,
      aircraftType: '',
      found: false,
      source: 'MANUAL'
    };
  },

  /**
   * Direct Planespotters lookup cleanly wrapped in try-catch
   */
  async queryDirectPlanespotters(reg: string): Promise<AircraftLookupResult> {
    const norm = normalizeRegistration(reg);
    const cleanNoDash = norm.replace(/-/g, '');

    try {
      const url = `https://api.planespotters.net/pub/photos/reg/${cleanNoDash}`;
      const res = await fetch(url, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.photos && data.photos.length > 0) {
          const photo = data.photos[0];
          const rawType = photo.aircraft?.typeName || photo.aircraft?.model || photo.aircraft?.type || '';
          if (rawType) {
            return {
              registration: norm,
              aircraftType: cleanAircraftTypeName(rawType),
              airlineName: photo.airline?.name || '',
              photoUrl: photo.thumbnail_large?.src || photo.thumbnail?.src || '',
              source: 'PLANESPOTTERS_LIVE',
              found: true
            };
          }
        }
      }
    } catch (e) {
      // Ignore
    }

    return { registration: norm, aircraftType: '', found: false, source: 'PLANESPOTTERS_LIVE' };
  },

  /**
   * Save resolved aircraft details into local DB cache
   */
  async cacheResolvedAircraft(reg: string, aircraftType: string, airlineName: string): Promise<void> {
    try {
      await supabaseService.addAircraftMaster(
        'auto_lookup',
        airlineName || 'Unknown Airline',
        reg,
        aircraftType
      );
    } catch (e) {
      // Ignore
    }
  }
};
