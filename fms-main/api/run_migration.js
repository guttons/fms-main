const fs = require('fs');
const readline = require('readline');
const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = 'macl-fms-496808';
const DATASET_ID = 'fms_data';
const TABLE_ID = 'operations_log';

const KEY_FILE = './macl-fms-496808-5809d185855e.json';
const bigquery = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_FILE });

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function parseTime(dateStr, timeStr) {
  if (!dateStr || !timeStr || !timeStr.trim() || timeStr.trim() === '-') return null;
  const cleanTime = timeStr.trim();
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${dateStr}T${hh}:${mm}:${ss}.000Z`;
}

function parseVolume(val) {
  if (!val || val === '-' || val.toUpperCase() === 'VOID') return null;
  const clean = val.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parseNumber(val) {
  if (!val || val === '-') return null;
  const clean = val.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

async function run() {
  const csvPath = 'C:\\Users\\a-6600\\OneDrive - Maldives Airports Company Ltd\\Documents\\fms-main\\native_sales_table.csv';
  console.log(`Reading CSV from ${csvPath}...`);

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let lineCount = 0;
  let rowsToInsert = [];
  let totalInserted = 0;
  let totalErrors = 0;
  const BATCH_SIZE = 500;

  const dataset = bigquery.dataset(DATASET_ID);
  const table = dataset.table(TABLE_ID);

  const now = new Date().toISOString();

  for await (const line of rl) {
    if (!line.trim()) continue;
    
    if (!headers) {
      headers = parseCSVLine(line).map(h => h.trim());
      console.log('CSV Headers:', headers);
      continue;
    }

    lineCount++;
    const cols = parseCSVLine(line);
    
    const rec = {};
    headers.forEach((h, idx) => {
      rec[h] = cols[idx] ? cols[idx].trim() : '';
    });

    const deliveryNo = rec.DELIVERY_NO || '';
    const id = deliveryNo ? `hist-${deliveryNo}` : `hist-gen-${lineCount}-${Math.random().toString(36).slice(2, 7)}`;
    const dateStr = rec.DATE ? rec.DATE.split('T')[0] : null;
    const intDomRaw = (rec.INT_DOM || rec.OR_DOMESTIC || '').toUpperCase();
    const isDomestic = intDomRaw.includes('DOM');

    const row = {
      id,
      log_type:              'FLIGHT',
      flight_number:         rec.FLIGHT || null,
      aircraft_reg:          rec.AIRCRAFT_REG || null,
      aircraft_type:         rec.AIRCRAFT_TYPE || null,
      stand:                 rec.STAND || null,
      operator_id:           null,
      vehicle_id:            rec.RF_NO || null,
      status:                'COMPLETED',
      delivery_number:       deliveryNo || null,
      meter_open:            null,
      meter_close:           null,
      volume:                parseVolume(rec.VOLUME),
      panel_check:           true,
      walk_around_check:     true,
      appearance_check:      true,
      water_check:           true,
      timestamp_arrived:     parseTime(dateStr, rec.ARRIVED),
      timestamp_position:    parseTime(dateStr, rec.ARRIVED),
      timestamp_start:       parseTime(dateStr, rec.STARTED),
      timestamp_initial_end: null,
      timestamp_final_start: null,
      timestamp_final_end:   parseTime(dateStr, rec.ENDED),
      timestamp_clearance:   parseTime(dateStr, rec.ENDED),
      remarks:               rec.CUSTOMER_NAME ? `Customer: ${rec.CUSTOMER_NAME}` : null,
      tactical_operator:     rec.RF_OPERATOR || null,
      route:                 null,
      co:                    rec.CUSTOMER_NAME || null,
      is_domestic:           isDomestic,
      airline:               rec.CUSTOMER_NAME || null,
      operational_date:      dateStr,
      pit_number:            rec.PIT_NO || null,
      is_adhoc:              false,
      psi:                   parseNumber(rec.Psi),
      lpm:                   parseNumber(rec.LPM),
      officer:               rec.OFFICER || null,
      operator_name:         rec.OPERATOR_NAME || null,
      destination:           null,
      payment_type:          rec.OR_CREDIT || null,
      is_deleted:            false,
      created_at:            dateStr ? `${dateStr}T00:00:00.000Z` : now,
      updated_at:            now,
    };

    rowsToInsert.push(row);

    if (rowsToInsert.length >= BATCH_SIZE) {
      const chunk = [...rowsToInsert];
      rowsToInsert = [];
      try {
        await table.insert(chunk, { skipInvalidRows: true, ignoreUnknownValues: true });
        totalInserted += chunk.length;
        if (totalInserted % 5000 === 0 || lineCount <= 2000) {
          console.log(`[Progress] Processed ${lineCount} lines | Inserted ${totalInserted} rows into BigQuery`);
        }
      } catch (err) {
        console.error(`[Error] Insert batch failed at line ${lineCount}:`, err.message, err.errors ? err.errors.slice(0, 3) : '');
        totalErrors += chunk.length;
      }
    }
  }

  // Flush remaining rows
  if (rowsToInsert.length > 0) {
    const chunk = [...rowsToInsert];
    try {
      await table.insert(chunk, { skipInvalidRows: true, ignoreUnknownValues: true });
      totalInserted += chunk.length;
    } catch (err) {
      console.error(`[Error] Final insert batch failed:`, err.message);
      totalErrors += chunk.length;
    }
  }

  console.log(`\n==================================================`);
  console.log(`MIGRATION FINISHED!`);
  console.log(`Total CSV lines processed: ${lineCount}`);
  console.log(`Successfully inserted into BigQuery: ${totalInserted}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`==================================================`);
}

run().catch(console.error);
