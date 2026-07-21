const { BigQuery } = require('@google-cloud/bigquery');
const PROJECT_ID = 'macl-fms-496808';
const DATASET_ID = 'fms_data';
const TABLE_ID = 'operations_log';
const KEY_FILE = './macl-fms-496808-5809d185855e.json';

const bigquery = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_FILE });

async function testSingleInsert() {
  console.log('Testing single insert to BigQuery...');
  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
  
  const testRows = [
    {
      id: 'test-row-1',
      log_type: 'FLIGHT',
      flight_number: 'Q2152',
      aircraft_reg: '8QIAS',
      aircraft_type: 'DASH8',
      stand: '1',
      vehicle_id: 'RF12',
      status: 'COMPLETED',
      delivery_number: '198126',
      volume: 1036,
      panel_check: true,
      walk_around_check: true,
      appearance_check: true,
      water_check: true,
      timestamp_arrived: '2022-02-01T05:24:00.000Z',
      timestamp_start: '2022-02-01T05:26:00.000Z',
      timestamp_final_end: '2022-02-01T05:31:00.000Z',
      tactical_operator: 'NASEEM',
      co: 'MALDIVIAN',
      is_domestic: true,
      airline: 'MALDIVIAN',
      operational_date: '2022-02-01',
      officer: 'REEHAN',
      payment_type: 'CREDIT',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  try {
    const res = await table.insert(testRows);
    console.log('Insert SUCCESS:', res);
  } catch (err) {
    console.error('Insert ERROR:', err);
    if (err.errors) {
      console.error('Row Errors:', JSON.stringify(err.errors));
    }
  }
}

testSingleInsert();
