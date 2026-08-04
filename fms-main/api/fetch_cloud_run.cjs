const http = require('https');
const fs = require('fs');

const url = 'https://fms-bigquery-api-808402455416.us-central1.run.app/master-db-records';

console.log('[Cloud Run Fetch] Requesting master records from Cloud Run...');
http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(`[Cloud Run Fetch] HTTP ${res.statusCode} — Received ${json.count || (json.records && json.records.length) || 0} records.`);
      fs.writeFileSync('cloud_run_master.json', JSON.stringify(json, null, 2));
    } catch (e) {
      console.error('[Cloud Run Fetch] Raw response:', data.slice(0, 500));
    }
  });
}).on('error', (err) => {
  console.error('[Cloud Run Fetch] Error:', err.message);
});
