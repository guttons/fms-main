const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ 
  projectId: 'macl-fms-496808', 
  keyFilename: './macl-fms-496808-5809d185855e.json' 
});

async function run() {
  const [rows] = await bigquery.query({ 
    query: 'SELECT COUNT(*) as totalCount FROM `macl-fms-496808.fms_data.operations_log`' 
  });
  console.log('Total operations_log records in BigQuery:', rows[0].totalCount);
}

run().catch(console.error);
