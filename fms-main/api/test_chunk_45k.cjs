const fs = require('fs');
const readline = require('readline');
const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = 'macl-fms-496808';
const DATASET_ID = 'fms_data';
const TABLE_ID = 'operations_log';
const KEY_FILE = './macl-fms-496808-5809d185855e.json';

const bigquery = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_FILE });

const monthMap = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function parseDateToYYYYMMDD(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const str = dateStr.trim();
  if (str.includes('T')) return str.split('T')[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const mStr = parts[1].toLowerCase();
    const yStr = parts[2];
    if (monthMap[mStr]) {
      const year = yStr.length === 2 ? `20${yStr}` : yStr;
      const month = monthMap[mStr];
      return `${year}-${month}-${d}`;
    }
  }
  return str;
}

function parseTimeToISO(dateISO, timeStr) {
  if (!dateISO || !timeStr || !timeStr.trim()) return null;
  const cleanTime = timeStr.trim();
  if (cleanTime === '-' || cleanTime.toUpperCase() === 'N/A' || cleanTime === '0:00' || cleanTime === '00:00') {
    return null;
  }
  const parts = cleanTime.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parts[2] ? parseInt(parts[2], 10) : 0;
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return `${dateISO}T${hh}:${mm}:${ss}.000Z`;
  }
  return null;
}

function parseVolume(val) {
  if (!val || val === '-' || val.toUpperCase() === 'VOID') return null;
  const clean = val.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parseNumber(val) {
  if (!val || val === '-' || val.toUpperCase() === 'N/A') return null;
  const clean = val.replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

async function testChunk45k() {
  const csvPath = 'C:\\Users\\a-6600\\Downloads\\ITP JetSales Analysis - DATA.csv';
  console.log('Testing CSV parsing rows 45,000 to 50,000...');

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  let lineCount = 0;
  const chunkRows = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) { headers = parseCSVLine(line); continue; }

    lineCount++;
    if (lineCount < 45000) continue;
    if (lineCount >= 50000) break;

    const cols = parseCSVLine(line);
    const rec = {};
    headers.forEach((h, idx) => rec[h] = cols[idx] || '');

    const deliveryNo = rec['DELIVERY NO'] || '';
    const dateISO = parseDateToYYYYMMDD(rec['DATE']);
    const customerUpper = (rec['CUSTOMER NAME'] || '').toUpperCase();
    const intDomRaw = (rec['INT_DOM'] || rec['OR DOMESTIC'] || '').toUpperCase();
    const isDomestic = intDomRaw.includes('DOM');

    let logType = 'FLIGHT';
    if (customerUpper.includes('LOCAL SALES') || customerUpper.includes('OTHERS')) {
      logType = 'MARINE';
    } else if (customerUpper.includes('SEAPLANE')) {
      logType = 'SEAPLANE';
    }

    chunkRows.push({
      id: deliveryNo ? `hist-${logType.toLowerCase()}-${deliveryNo}` : `hist-gen-${lineCount}`,
      log_type:              logType,
      flight_number:         logType === 'FLIGHT' ? (rec['FLIGHT'] || null) : (logType === 'SEAPLANE' ? `SEAPLANE-${deliveryNo}` : `VESSEL-${rec['OPERATOR NAME'] || deliveryNo}`),
      aircraft_reg:          logType === 'FLIGHT' ? (rec['AIRCRAFT REG'] || null) : null,
      aircraft_type:         logType === 'FLIGHT' ? (rec['AIRCRAFT TYPE'] || null) : null,
      stand:                 logType === 'FLIGHT' ? (rec['STAND'] || null) : null,
      vehicle_id:            rec['RF_NO'] || null,
      status:                'COMPLETED',
      delivery_number:       deliveryNo || null,
      volume:                parseVolume(rec['VOLUME']),
      panel_check:           true,
      walk_around_check:     true,
      appearance_check:      true,
      water_check:           true,
      timestamp_arrived:     parseTimeToISO(dateISO, rec['ARRIVED']),
      timestamp_position:    parseTimeToISO(dateISO, rec['ARRIVED']),
      timestamp_start:       parseTimeToISO(dateISO, rec['STARTED']),
      timestamp_final_end:   parseTimeToISO(dateISO, rec['ENDED']),
      timestamp_clearance:   parseTimeToISO(dateISO, rec['ENDED']),
      tactical_operator:     rec['RF OPERATOR'] || null,
      co:                    rec['CUSTOMER NAME'] || null,
      is_domestic:           logType === 'FLIGHT' ? isDomestic : true,
      airline:               rec['CUSTOMER NAME'] || null,
      operational_date:      dateISO,
      pit_number:            rec['PIT NO'] || null,
      is_adhoc:              false,
      psi:                   parseNumber(rec['Psi']),
      lpm:                   parseNumber(rec['LPM']),
      officer:               rec['OFFICER'] || null,
      operator_name:         rec['OPERATOR NAME'] || null,
      payment_type:          rec['OR CREDIT'] || null,
      is_deleted:            false,
      created_at:            dateISO ? `${dateISO}T00:00:00.000Z` : new Date().toISOString(),
      updated_at:            new Date().toISOString(),
    });
  }

  console.log(`Parsed ${chunkRows.length} rows (45k-50k). Trying insert into BigQuery...`);
  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
  
  try {
    const res = await table.insert(chunkRows, { skipInvalidRows: true, ignoreUnknownValues: true });
    console.log('Chunk 45k-50k insert SUCCESS!', res[0]);
  } catch (err) {
    console.error('Chunk 45k-50k insert FAILED:', err ? err.message : err);
    if (err && err.errors) {
      console.error('Error Details:', JSON.stringify(err.errors.slice(0, 5), null, 2));
    }
  }
}

testChunk45k();
