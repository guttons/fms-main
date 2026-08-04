const http = require('https');
const fs = require('fs');

const url = 'https://fms-bigquery-api-808402455416.us-central1.run.app/external-flights';

console.log('[External Flights] Fetching from Cloud Run...');
http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(`[External Flights] HTTP ${res.statusCode} — Received ${Array.isArray(json) ? json.length : 0} flight jobs!`);
      if (Array.isArray(json) && json.length > 0) {
        fs.writeFileSync('external_flights_data.json', JSON.stringify(json, null, 2));
        console.log('[External Flights] Sample record:', json[0]);
      }
    } catch (e) {
      console.error('[External Flights] Error parsing:', e.message, data.slice(0, 300));
    }
  });
}).on('error', (err) => {
  console.error('[External Flights] Error:', err.message);
});
