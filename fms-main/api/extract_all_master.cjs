const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const keyFilename = path.join(__dirname, 'macl-fms-496808-5809d185855e.json');
const bigquery = new BigQuery({ projectId: 'macl-fms-496808', keyFilename });

async function queryMasterDB() {
  console.log('[Extract Master DB] Querying BigQuery (DOM including FLY ME (DOM) from 01-Jan-2026, INT from full log history)...');
  
  const query = `
    SELECT DISTINCT
      UPPER(TRIM(airline)) AS airline_name,
      UPPER(TRIM(flight_number)) AS flight_number,
      UPPER(TRIM(aircraft_reg)) AS aircraft_reg,
      TRIM(aircraft_type) AS aircraft_type,
      int_dom
    FROM \`macl-fms-496808.fms_data.operations_log\`
    WHERE airline IS NOT NULL AND TRIM(airline) != ''
      AND flight_number IS NOT NULL AND TRIM(flight_number) != ''
      AND aircraft_reg IS NOT NULL AND TRIM(aircraft_reg) != ''
      AND (
        ( (UPPER(airline) LIKE '%MANTA%' OR UPPER(airline) LIKE '%MALDIVIAN%' OR UPPER(airline) LIKE '%ISLAND AVIATION%' OR UPPER(airline) LIKE '%VILLA%' OR UPPER(airline) LIKE '%FLYME%' OR UPPER(airline) LIKE '%FLY ME%' OR int_dom = 'DOM' OR is_domestic = true) AND operational_date >= '2026-01-01' )
        OR
        ( NOT (UPPER(airline) LIKE '%MANTA%' OR UPPER(airline) LIKE '%MALDIVIAN%' OR UPPER(airline) LIKE '%ISLAND AVIATION%' OR UPPER(airline) LIKE '%VILLA%' OR UPPER(airline) LIKE '%FLYME%' OR UPPER(airline) LIKE '%FLY ME%' OR int_dom = 'DOM' OR is_domestic = true) )
      )
    ORDER BY airline_name, flight_number, aircraft_reg;
  `;

  try {
    const [rows] = await bigquery.query({ query });
    console.log(`[Extract Master DB] Successfully fetched ${rows.length} distinct records!`);
    fs.writeFileSync(path.join(__dirname, 'master_extracted.json'), JSON.stringify(rows, null, 2));
    console.log('[Extract Master DB] Saved output to master_extracted.json!');
  } catch (err) {
    console.error('[Extract Master DB] Query error:', err.message);
  }
}

queryMasterDB();
