const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2Vzmhwa3RveGQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3OTMzNzc3NSwiZXhwIjoyMDk0OTEzNzc1fQ.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';

function resolveLogType(log) {
  const num = log.flightNumber || '';
  if (log.logType === 'SEAPLANE' || num.startsWith('SEAPLANE')) return 'SEAPLANE';
  if (log.logType === 'FILLING_STATION' || num.startsWith('GROUND-')) return 'FILLING_STATION';
  if (log.logType === 'MARINE' || num.startsWith('VESSEL-')) return 'MARINE';
  if (log.logType === 'BRIDGING' || num.startsWith('LOAD-')) return 'BRIDGING';

  const cust = ((log.co || log.airline || '')).toUpperCase();
  if (cust.includes('SEAPLANE')) return 'SEAPLANE';
  if (cust.includes('LOCAL SALES') || cust.includes('OTHERS')) return 'MARINE';

  return 'FLIGHT';
}

async function testFrontendFilter() {
  try {
    const res = await fetch('https://fms-bigquery-api-808402455416.us-central1.run.app/operations-log?logType=SEAPLANE&limit=50', {
      headers: { 'Authorization': `Bearer ${ANON_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      const rawLogs = data.logs || [];
      console.log('Raw API returned count:', rawLogs.length);
      const filteredForSeaplane = rawLogs.filter(log => resolveLogType(log) === 'SEAPLANE');
      console.log('Filtered for SEAPLANE tab count:', filteredForSeaplane.length);
      console.log('Seaplane tab entries:', filteredForSeaplane.slice(0, 3));

      const filteredForFlight = rawLogs.filter(log => resolveLogType(log) === 'FLIGHT');
      console.log('Commercial FLIGHT entries in API response (properly filtered out of Seaplane tab):', filteredForFlight.length, filteredForFlight.slice(0, 5).map(l => ({ flight: l.flightNumber, customer: l.airline || l.co })));
    } else {
      console.log('API call failed status:', res.status);
    }
  } catch (err) {
    console.error('Error in test:', err);
  }
}
testFrontendFilter().then(() => console.log('Done'));
