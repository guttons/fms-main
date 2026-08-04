const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const keyFilename = path.join(__dirname, 'macl-fms-496808-5809d185855e.json');
const bigquery = new BigQuery({ projectId: 'macl-fms-496808', keyFilename });

async function checkDom2026() {
  console.log('[DOM 2026] Querying operations_log for domestic flights from 01-Jan-2026...');
  
  const query = `
    SELECT DISTINCT
      UPPER(TRIM(airline)) AS raw_airline,
      UPPER(TRIM(flight_number)) AS flight_number,
      UPPER(TRIM(aircraft_reg)) AS aircraft_reg,
      UPPER(TRIM(aircraft_type)) AS aircraft_type,
      operational_date
    FROM \`macl-fms-496808.fms_data.operations_log\`
    WHERE operational_date >= '2026-01-01'
      AND (
        UPPER(airline) LIKE '%MANTA%' 
        OR UPPER(airline) LIKE '%MALDIVIAN%' 
        OR UPPER(airline) LIKE '%ISLAND AVIATION%'
        OR UPPER(airline) LIKE '%VILLA%'
        OR UPPER(airline) LIKE '%FLYME%'
        OR int_dom = 'DOM'
        OR is_domestic = true
      )
    ORDER BY raw_airline, flight_number, aircraft_reg;
  `;

  try {
    const [rows] = await bigquery.query({ query });
    console.log(`[DOM 2026] Found ${rows.length} unique domestic flight records from 01 Jan 2026:`);
    console.table(rows.slice(0, 35));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkDom2026();
