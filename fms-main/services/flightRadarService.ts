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
}

export const flightRadarService = new FlightRadarService();
