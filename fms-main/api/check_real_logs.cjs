const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const keyFilename = path.join(__dirname, 'macl-fms-496808-5809d185855e.json');
const bigquery = new BigQuery({ projectId: 'macl-fms-496808', keyFilename });

async function checkRealLogs() {
  console.log('[Check Real Logs] Querying operations_log for Manta Air and Island Aviation / Maldivian...');
  
  const query = `
    SELECT DISTINCT
      UPPER(TRIM(airline)) AS raw_airline,
      UPPER(TRIM(flight_number)) AS flight_number,
      UPPER(TRIM(aircraft_reg)) AS aircraft_reg,
      UPPER(TRIM(aircraft_type)) AS aircraft_type
    FROM \`macl-fms-496808.fms_data.operations_log\`
    WHERE UPPER(airline) LIKE '%MANTA%' 
       OR UPPER(airline) LIKE '%MALDIVIAN%' 
       OR UPPER(airline) LIKE '%ISLAND AVIATION%'
       OR UPPER(airline) LIKE '%VILLA%'
       OR UPPER(airline) LIKE '%FLYME%'
    ORDER BY raw_airline, flight_number, aircraft_reg;
  `;

  try {
    const [rows] = await bigquery.query({ query });
    console.log(`[Check Real Logs] Fetched ${rows.length} rows for domestic airlines! Sample:`);
    console.table(rows.slice(0, 30));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkRealLogs();
