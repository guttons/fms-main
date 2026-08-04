const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const keyFilename = path.join(__dirname, 'macl-fms-496808-5809d185855e.json');
const bigquery = new BigQuery({ projectId: 'macl-fms-496808', keyFilename });

async function checkVilla() {
  console.log('[Check Villa Air] Querying operations_log for Villa Air / Flyme...');
  const query = `
    SELECT DISTINCT
      UPPER(TRIM(airline)) AS raw_airline,
      UPPER(TRIM(flight_number)) AS flight_number,
      UPPER(TRIM(aircraft_reg)) AS aircraft_reg,
      UPPER(TRIM(aircraft_type)) AS aircraft_type
    FROM \`macl-fms-496808.fms_data.operations_log\`
    WHERE UPPER(airline) LIKE '%VILLA%' 
       OR UPPER(airline) LIKE '%FLYME%'
       OR UPPER(flight_number) LIKE 'VP%'
    ORDER BY raw_airline, flight_number, aircraft_reg;
  `;

  try {
    const [rows] = await bigquery.query({ query });
    console.log(`[Check Villa Air] Found ${rows.length} rows:`);
    console.table(rows.slice(0, 30));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkVilla();
