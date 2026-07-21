const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ 
  projectId: 'macl-fms-496808', 
  keyFilename: './macl-fms-496808-5809d185855e.json' 
});

async function run() {
  const [rows] = await bigquery.query({ 
    query: 'SELECT log_type, COUNT(*) as cnt FROM `macl-fms-496808.fms_data.operations_log` GROUP BY log_type' 
  });
  console.log('Breakdown by log_type in BigQuery:', rows);
}

run().catch(console.error);
