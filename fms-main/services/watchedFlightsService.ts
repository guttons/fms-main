// Watched Flights persistence service (opt-in flight alerts)
export const getWatchedFlightIds = (userId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`fms_watched_flights_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

export const saveWatchedFlightIds = (userId: string, ids: Set<string>): void => {
  try {
    localStorage.setItem(`fms_watched_flights_${userId}`, JSON.stringify(Array.from(ids)));
  } catch {}
};
