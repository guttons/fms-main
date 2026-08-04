const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const keyFilename = path.join(__dirname, 'macl-fms-496808-5809d185855e.json');
const bigquery = new BigQuery({ projectId: 'macl-fms-496808', keyFilename });

async function checkManta() {
  const query = `
    SELECT DISTINCT
      UPPER(TRIM(airline)) AS raw_airline,
      UPPER(TRIM(flight_number)) AS flight_number,
      UPPER(TRIM(aircraft_reg)) AS aircraft_reg,
      UPPER(TRIM(aircraft_type)) AS aircraft_type
    FROM \`macl-fms-496808.fms_data.operations_log\`
    WHERE UPPER(airline) LIKE '%MANTA%'
    ORDER BY flight_number, aircraft_reg;
  `;

  try {
    const [rows] = await bigquery.query({ query });
    console.log(`[MANTA AIR] Found ${rows.length} rows:`);
    console.table(rows);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkManta();
