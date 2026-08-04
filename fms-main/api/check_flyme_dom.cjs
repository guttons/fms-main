const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const keyFilename = path.join(__dirname, 'macl-fms-496808-5809d185855e.json');
const bigquery = new BigQuery({ projectId: 'macl-fms-496808', keyFilename });

async function checkFlymeAirlines() {
  const query = `
    SELECT DISTINCT
      UPPER(TRIM(airline)) AS raw_airline
    FROM \`macl-fms-496808.fms_data.operations_log\`
    WHERE UPPER(airline) LIKE '%FLYME%' 
       OR UPPER(airline) LIKE '%VILLA%'
    ORDER BY raw_airline;
  `;

  try {
    const [rows] = await bigquery.query({ query });
    console.log(`[Flyme Airlines] Raw airline values in BigQuery:`);
    console.table(rows);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkFlymeAirlines();
