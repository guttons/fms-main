class FlightRadarService {
  private readonly baseUrl = 'https://www.flightradar24.com';
  private readonly mleLat = 4.1918;
  private readonly mleLon = 73.5291;

  public cleanFlightNumber(flightNumber: string): string {
    return (flightNumber || '').replace(/[\s\-_]/g, '').toUpperCase();
  }

  public getEmbedUrl(options: { zoom?: number; flightNumber?: string } = {}): string {
    const { zoom = 9, flightNumber } = options;
    if (flightNumber) {
      const clean = this.cleanFlightNumber(flightNumber);
      // Try flight-specific simple embed if provided
      return `${this.baseUrl}/simple_index.php?lat=${this.mleLat}&lon=${this.mleLon}&z=${zoom}&airport=MLE&flight=${clean.toLowerCase()}`;
    }
    // MLE coordinates: 4.1918, 73.5291
    return `${this.baseUrl}/simple_index.php?lat=${this.mleLat}&lon=${this.mleLon}&z=${zoom}&airport=MLE`;
  }

  public getFlightWebUrl(flightNumber?: string): string {
    if (flightNumber) {
      const clean = this.cleanFlightNumber(flightNumber);
      // Direct live flight tracking on the Flightradar24 map (not historical data table)
      return `${this.baseUrl}/${clean}`;
    }
    return `${this.baseUrl}/4.19,73.53/9`;
  }

  public getFlightSearchUrl(flightNumber: string): string {
    const clean = this.cleanFlightNumber(flightNumber);
    return `${this.baseUrl}/${clean}`;
  }

  public getFlightAppDeepLink(flightNumber?: string): string {
    if (flightNumber) {
      const clean = this.cleanFlightNumber(flightNumber);
      return `flightradar24://flight/${clean.toLowerCase()}`;
    }
    return `flightradar24://map?lat=${this.mleLat}&lon=${this.mleLon}&z=9`;
  }

  public getFlightAwareUrl(flightNumber?: string): string {
    if (flightNumber) {
      const clean = this.cleanFlightNumber(flightNumber);
      return `https://www.flightaware.com/live/flight/${clean}`;
    }
    return `https://www.flightaware.com/live/airport/VRMM`;
  }

  public getRadarBoxUrl(flightNumber?: string): string {
    if (flightNumber) {
      const clean = this.cleanFlightNumber(flightNumber);
      // Direct live tracking on the RadarBox map
      return `https://www.radarbox.com/flight/${clean}`;
    }
    return `https://www.radarbox.com/airport/VRMM`;
  }

  public buildMapUrl(lat: number = this.mleLat, lon: number = this.mleLon, zoom: number = 9): string {
    return `${this.baseUrl}/simple_index.php?lat=${lat}&lon=${lon}&z=${zoom}&airport=MLE`;
  }

  /**
   * Resolves the inbound/arrival flight number for an international flight job.
   * If the flight is an outbound turnaround (e.g. FZ 1025, EK 657, QR 677),
   * FlightRadar24 tracks the aircraft approaching Male under its INBOUND callsign (e.g. FZ 1024, EK 656, QR 676).
   */
  public resolveInboundFlightNumber(
    job: { flightNumber?: string; aircraftReg?: string; type?: string; route?: string; inboundFlightNumber?: string },
    externalFlights?: any[],
    internationalSchedules?: any[]
  ): string {
    if (!job || !job.flightNumber) return '';
    const raw = job.flightNumber.trim();
    if (job.inboundFlightNumber) return job.inboundFlightNumber;
    if (job.type === 'arrival') return raw;

    const clean = raw.replace(/\s+/g, '').toUpperCase();
    const match = clean.match(/^([A-Z0-9]{2,3})(\d+)$/);
    const code = match ? match[1] : '';
    const depNum = match ? parseInt(match[2], 10) : null;

    // 1. Search live external arrivals (FIS FIDS feed from Male Airport)
    if (externalFlights && externalFlights.length > 0) {
      const arrivals = externalFlights.filter((f: any) => f.type === 'arrival' || (f.origin && f.originCode !== 'MLE'));

      // 1a. Match by aircraft registration (highest confidence)
      if (job.aircraftReg && !job.aircraftReg.startsWith('8Q-') && job.aircraftReg !== 'TBA' && job.aircraftReg !== '---') {
        const cleanReg = job.aircraftReg.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const byReg = arrivals.find((f: any) => {
          const fReg = (f.aircraftReg || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
          return fReg && fReg === cleanReg;
        });
        if (byReg && byReg.flightNumber) {
          return byReg.flightNumber;
        }
      }

      // 1b. Match by airline code and turnaround flight number
      if (code && depNum !== null) {
        const sameAirline = arrivals.filter((f: any) => {
          const fCode = (f.airlineCode || f.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
          return fCode.startsWith(code);
        });

        // Departure usually odd -> Inbound is (depNum - 1) e.g. FZ 1025 -> FZ 1024, EK 657 -> EK 656
        const diffMinus1 = sameAirline.find((f: any) => {
          const num = parseInt(f.flightNumber.replace(/\D/g, ''), 10);
          return num === depNum - 1;
        });
        if (diffMinus1 && diffMinus1.flightNumber) return diffMinus1.flightNumber;

        // British Airways / some carriers: BA 060 dep -> BA 061 arr
        const diffPlus1 = sameAirline.find((f: any) => {
          const num = parseInt(f.flightNumber.replace(/\D/g, ''), 10);
          return num === depNum + 1;
        });
        if (diffPlus1 && diffPlus1.flightNumber) return diffPlus1.flightNumber;

        // Same flight number turnaround (e.g. UL 102 -> UL 102)
        const sameNum = sameAirline.find((f: any) => {
          const num = parseInt(f.flightNumber.replace(/\D/g, ''), 10);
          return num === depNum;
        });
        if (sameNum && sameNum.flightNumber) return sameNum.flightNumber;

        if (sameAirline.length > 0 && sameAirline[0].flightNumber) {
          return sameAirline[0].flightNumber;
        }
      }
    }

    // 2. Search international schedules for paired notations (e.g. "BA061-0", "QR676-7", "SU320/321")
    if (internationalSchedules && internationalSchedules.length > 0) {
      const sch = internationalSchedules.find((s: any) => {
        const sClean = (s.flightNumber || '').replace(/[\s\-\/]/g, '').toUpperCase();
        return sClean.includes(clean) || clean.includes(sClean);
      });
      if (sch && sch.flightNumber) {
        const rawSch = sch.flightNumber.trim();
        const sep = rawSch.includes('-') ? '-' : (rawSch.includes('/') ? '/' : '');
        if (sep) {
          const parts = rawSch.split(sep);
          if (parts[0]) return parts[0].trim();
        }
      }
    }

    // 3. Smart airline turnaround fallback rule
    if (code && depNum !== null) {
      if (depNum % 2 === 1) {
        // Odd departure: inbound is depNum - 1 (e.g. FZ 1025 -> FZ 1024, EK 657 -> EK 656)
        return `${code} ${depNum - 1}`;
      } else {
        // Even departure: check if BA
        if (code === 'BA') return `BA ${depNum + 1}`;
        return `${code} ${depNum - 1}`;
      }
    }

    return raw;
  }
}

export const flightRadarService = new FlightRadarService();
