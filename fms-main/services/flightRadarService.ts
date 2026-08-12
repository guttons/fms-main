class FlightRadarService {
  private readonly baseUrl = 'https://www.flightradar24.com';
  
  public getEmbedUrl(options: { zoom?: number; type?: 'standard' | 'satellite' | 'hybrid' } = {}): string {
    const { zoom = 12 } = options;
    // MLE coordinates: 4.1918, 73.5291
    return `${this.baseUrl}/simple?lat=4.1918&lon=73.5291&z=${zoom}`;
  }

  public getFlightSearchUrl(flightNumber: string): string {
    return `${this.baseUrl}/data/flights/${flightNumber.toLowerCase()}`;
  }

  public getFlightPageUrl(flightNumber: string): string {
    return `${this.baseUrl}/data/flights/${flightNumber.toLowerCase()}`;
  }

  public buildMapUrl(lat: number, lon: number, zoom: number = 10): string {
    return `${this.baseUrl}/simple?lat=${lat}&lon=${lon}&z=${zoom}`;
  }
}

export const flightRadarService = new FlightRadarService();
