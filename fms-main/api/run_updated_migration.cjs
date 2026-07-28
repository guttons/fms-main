const fs = require('fs');
const readline = require('readline');
const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = 'macl-fms-496808';
const DATASET_ID = 'fms_data';
const TABLE_ID = 'operations_log';
const KEY_FILE = 'c:\\Users\\a-6600\\OneDrive - Maldives Airports Company Ltd\\Documents\\fms-main\\fms-main\\api\\macl-fms-496808-5809d185855e.json';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: KEY_FILE
});

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

function parseCSVDate(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      let day = parts[0].padStart(2, '0');
      const monthStr = parts[1].toLowerCase();
      let year = parts[2];
      if (year.length === 2) {
        year = '20' + year;
      }
      
      const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      const month = months[monthStr.substring(0, 3)];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  return dateStr.split('T')[0];
}

function parseTime(dateStr, timeStr) {
  if (!dateStr || !timeStr || !timeStr.trim() || timeStr.trim() === '-') return null;
  const cleanTime = timeStr.trim();
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
    return null;
  }
  
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
  const csvPath = 'C:\\Users\\a-6600\\OneDrive - Maldives Airports Company Ltd\\Documents\\fms-main\\JETA1-Sales - DATA.csv';
  console.log(`Clearing and updating BigQuery table using CSV: ${csvPath}`);

  const dataset = bigquery.dataset(DATASET_ID);
  const table = dataset.table(TABLE_ID);

  // Clear existing records without deleting the table object
  console.log('Truncating operations_log table...');
  try {
    await bigquery.query({
      query: `TRUNCATE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``
    });
    console.log('Table truncated successfully!');
  } catch (err) {
    console.warn('Truncate failed, attempting delete query...', err.message);
    await bigquery.query({
      query: `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` WHERE TRUE`
    });
    console.log('Table cleared successfully via DELETE!');
  }

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
  const BATCH_SIZE = 2000;

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

    const rowId = rec[""] || `gen-${lineCount}-${Math.random().toString(36).slice(2, 7)}`;
    const id = `hist-${rowId}`;
    const dateStr = parseCSVDate(rec.DATE);

    const customerName = String(rec['CUSTOMER NAME'] || rec.CUSTOMER_NAME || '').trim();
    const intDomRaw = String(rec.INT_DOM || rec.OR_DOMESTIC || '').toUpperCase();
    const isCancelled = customerName.toUpperCase() === 'CANCELLED DELIVERY' || intDomRaw === 'VOID' || String(rec['OR CREDIT'] || rec.OR_CREDIT || '').toUpperCase() === 'VOID';
    const isSeaplane = !isCancelled && intDomRaw === 'SEA';
    const isDomestic = !isCancelled && (intDomRaw === 'DOM' || intDomRaw.includes('DOMESTIC'));
    const finalIntDom = isCancelled ? 'VOID' : (intDomRaw || (isDomestic ? 'DOM' : 'INT'));

    const row = {
      id,
      log_type:              isSeaplane ? 'SEAPLANE' : 'FLIGHT',
      flight_number:         rec.FLIGHT || null,
      aircraft_reg:          rec['AIRCRAFT REG'] || rec.AIRCRAFT_REG || null,
      aircraft_type:         rec['AIRCRAFT TYPE'] || rec.AIRCRAFT_TYPE || null,
      stand:                 rec.STAND || null,
      operator_id:           null,
      vehicle_id:            rec.RF_NO || null,
      status:                'COMPLETED',
      delivery_number:       rowId || null,
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
      remarks:               customerName ? `Customer: ${customerName}` : null,
      tactical_operator:     rec['RF OPERATOR'] || rec.RF_OPERATOR || null,
      route:                 null,
      co:                    customerName || null,
      is_domestic:           isDomestic,
      int_dom:               finalIntDom,
      airline:               rec['CUSTOMER NAME'] || rec.CUSTOMER_NAME || null,
      operational_date:      dateStr,
      pit_number:            rec['PIT NO'] || rec.PIT_NO || null,
      is_adhoc:              false,
      psi:                   parseNumber(rec.Psi),
      lpm:                   parseNumber(rec.LPM),
      officer:               rec.OFFICER || null,
      operator_name:         rec['OPERATOR NAME'] || rec.OPERATOR_NAME || null,
      destination:           null,
      payment_type:          rec['OR CREDIT'] || rec.OR_CREDIT || null,
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
        if (totalInserted % 10000 === 0) {
          console.log(`[Progress] Processed ${lineCount} CSV lines | Inserted ${totalInserted} rows into BigQuery`);
        }
      } catch (err) {
        console.error(`[Error] Insert batch failed around line ${lineCount}:`, err.message, err.errors ? err.errors.slice(0, 3) : '');
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
