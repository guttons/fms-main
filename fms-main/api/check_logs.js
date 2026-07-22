const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: 'macl-fms-496808', keyFilename: './macl-fms-496808-5809d185855e.json' });

async function check() {
  const [rows] = await bq.query({ query: "SELECT id, flight_number, airline, co, vehicle_id, delivery_number, log_type, operational_date FROM `macl-fms-496808.fms_data.operations_log` WHERE delivery_number IN ('331778', '331780', '331776', '331755', '331752') OR operational_date = '2026-07-21' LIMIT 20" });
  console.log(rows);
}
check();
