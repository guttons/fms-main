const fs = require('fs');
const path = require('path');

const cleanData = JSON.parse(fs.readFileSync(path.join(__dirname, 'master_extracted.json'), 'utf8'));

// Standard Scheduled Commercial Passenger & Cargo Airlines
const SCHEDULED_AIRLINES = {
  'MALDIVIAN': { iata: 'Q2', icao: 'DIV', category: 'DOM' },
  'MANTA AIR': { iata: 'NR', icao: 'MNT', category: 'DOM' },
  'VILLA AIR': { iata: 'VP', icao: 'VLA', category: 'DOM' },
  'EMIRATES': { iata: 'EK', icao: 'UAE', category: 'INT' },
  'QATAR AIRWAYS': { iata: 'QR', icao: 'QTR', category: 'INT' },
  'SINGAPORE AIRLINES': { iata: 'SQ', icao: 'SIA', category: 'INT' },
  'ETIHAD AIRWAYS': { iata: 'EY', icao: 'ETD', category: 'INT' },
  'SRILANKAN AIRLINES': { iata: 'UL', icao: 'ALK', category: 'INT' },
  'TURKISH AIRLINES': { iata: 'TK', icao: 'THY', category: 'INT' },
  'BRITISH AIRWAYS': { iata: 'BA', icao: 'BAW', category: 'INT' },
  'AEROFLOT': { iata: 'SU', icao: 'AFL', category: 'INT' },
  'INDIGO': { iata: '6E', icao: 'IGO', category: 'INT' },
  'FLYDUBAI': { iata: 'FZ', icao: 'FDB', category: 'INT' },
  'GULF AIR': { iata: 'GF', icao: 'GFA', category: 'INT' },
  'SAUDIA': { iata: 'SV', icao: 'SVA', category: 'INT' },
  'OMAN AIR': { iata: 'WY', icao: 'OMA', category: 'INT' },
  'EDELWEISS AIR': { iata: 'WK', icao: 'EDW', category: 'INT' },
  'CONDOR': { iata: 'DE', icao: 'CFG', category: 'INT' },
  'AIR FRANCE': { iata: 'AF', icao: 'AFR', category: 'INT' },
  'BATIK AIR MALAYSIA': { iata: 'OD', icao: 'MXD', category: 'INT' },
  'AIRASIA X': { iata: 'D7', icao: 'XAX', category: 'INT' },
  'AIRASIA': { iata: 'AK', icao: 'AXM', category: 'INT' },
  'THAI AIRASIA': { iata: 'FD', icao: 'AIQ', category: 'INT' },
  'CHINA EASTERN AIRLINES': { iata: 'MU', icao: 'CES', category: 'INT' },
  'AIR INDIA': { iata: 'AI', icao: 'AIC', category: 'INT' },
  'VIRGIN ATLANTIC': { iata: 'VS', icao: 'VIR', category: 'INT' },
  'WIZZ AIR': { iata: 'W6', icao: 'WZZ', category: 'INT' },
  'NEOS': { iata: 'NO', icao: 'NOS', category: 'INT' },
  'LOT POLISH AIRLINES': { iata: 'LO', icao: 'LOT', category: 'INT' },
  'SICHUAN AIRLINES': { iata: '3U', icao: 'CSC', category: 'INT' },
  'US-BANGLA AIRLINES': { iata: 'BS', icao: 'UBG', category: 'INT' },
  'UZBEKISTAN AIRWAYS': { iata: 'HY', icao: 'UZB', category: 'INT' },
  'BANGKOK AIRWAYS': { iata: 'PG', icao: 'BKP', category: 'INT' },
  'BEOND': { iata: 'B4', icao: 'BYD', category: 'INT' },
  'FITS AIR': { iata: '8D', icao: 'EXV', category: 'INT' },
  'AIR ARABIA': { iata: 'G9', icao: 'ABY', category: 'INT' },
  'AIR SEYCHELLES': { iata: 'HM', icao: 'SEY', category: 'INT' },
  'CENTRAL AIRLINES': { iata: 'I2', icao: 'HLN', category: 'INT' },
  'CHONGQING AIRLINES': { iata: 'OQ', icao: 'CQN', category: 'INT' },
  'DISCOVER AIRLINES': { iata: '4Y', icao: 'OEW', category: 'INT' },
  'XIAMEN AIR': { iata: 'MF', icao: 'CXA', category: 'INT' },
  'MALAYSIA AIRLINES': { iata: 'MH', icao: 'MAS', category: 'INT' }
};

function normalizeName(rawName) {
  let name = (rawName || '').toUpperCase().trim();
  name = name.replace(/^\(INT\)\s*/, '').replace(/^\(DOM\)\s*/, '');
  if (name.includes('ISLAND AVIATION') || name.includes('IAS') || name === 'MALDIVIAN DOMESTIC') return 'MALDIVIAN';
  if (name.includes('FLYME') || name.includes('FLY ME') || name.includes('VILLA')) return 'VILLA AIR';
  if (name.includes('MANTA')) return 'MANTA AIR';
  if (name.includes('SRI LANKAN') || name === 'SRILANKAN') return 'SRILANKAN AIRLINES';
  if (name.includes('TUKISH')) return 'TURKISH AIRLINES';
  if (name.includes('AIRASIA X')) return 'AIRASIA X';
  if (name.includes('AIRASIA')) return 'AIRASIA';
  if (name.includes('THAI AIR ASIA')) return 'THAI AIRASIA';
  return name;
}

function isDisqualifiedAirline(name) {
  const u = (name || '').toUpperCase();
  if (u.includes('EXTRA') || u.includes('ADHOC')) return true;
  if (u.includes('LOCAL SALES') || u.includes('OTHERS')) return true;
  if (u.includes('MALDIVES AIRPORTS') || u.includes('MACL')) return true;
  return false;
}

function isAdhocOrExtraFlight(flightNum) {
  if (!flightNum) return true;
  const f = flightNum.toUpperCase().trim();
  
  if (f === 'N/A' || f === 'NULL' || f === 'FALSE' || f === 'TRUE') return true;
  if (f.startsWith('SEAPLANE') || f.startsWith('VESSEL') || f.startsWith('GROUND') || f.startsWith('LOAD')) return true;

  const ADHOC_KEYWORDS = ['EXTRA', 'ADHOC', 'CHARTER', 'FERRY', 'TEST', 'DEMO', 'COMMISSION', 'VIP', 'TRAINING', 'CHECK', 'LOCAL', 'DUMMY', 'CANCEL', 'DELIVERY', 'POSITIONING', 'SPECIAL', 'SPEC'];
  for (const kw of ADHOC_KEYWORDS) {
    if (f.includes(kw)) return true;
  }

  if (/[0-9]{3,}[A-Z]$/.test(f)) return true;

  return false;
}

function formatTailNumber(reg) {
  let r = (reg || '').toUpperCase().replace(/[\s\.]/g, '');
  if (!r || r === 'N/A' || r.length < 3 || r === 'FALSE' || r === 'NULL') return null;

  if (r.startsWith('8Q') && !r.startsWith('8Q-')) r = '8Q-' + r.slice(2);
  else if (r.startsWith('8AR') || r.startsWith('81R') || r.startsWith('87R')) r = '8Q-R' + r.slice(3);
  else if (r.startsWith('8AIA') || r.startsWith('81IA')) r = '8Q-IA' + r.slice(4);
  else if (r.startsWith('8QVA')) r = '8Q-VA' + r.slice(4);
  else if (r.startsWith('A6') && !r.startsWith('A6-')) r = 'A6-' + r.slice(2);
  else if (r.startsWith('A7') && !r.startsWith('A7-')) r = 'A7-' + r.slice(2);
  else if (r.startsWith('TC') && !r.startsWith('TC-')) r = 'TC-' + r.slice(2);
  else if (r.startsWith('9V') && !r.startsWith('9V-')) r = '9V-' + r.slice(2);
  else if (r.startsWith('4R') && !r.startsWith('4R-')) r = '4R-' + r.slice(2);
  else if (r.startsWith('VT') && !r.startsWith('VT-')) r = 'VT-' + r.slice(2);
  else if (r.startsWith('RA') && !r.startsWith('RA-')) r = 'RA-' + r.slice(2);
  else if (r.startsWith('G') && !r.startsWith('G-') && r.length === 5) r = 'G-' + r.slice(1);
  else if (r.startsWith('HZ') && !r.startsWith('HZ-')) r = 'HZ-' + r.slice(2);
  else if (r.startsWith('HB') && !r.startsWith('HB-')) r = 'HB-' + r.slice(2);
  else if (r.startsWith('A9C') && !r.startsWith('A9C-')) r = 'A9C-' + r.slice(3);
  else if (r.startsWith('9M') && !r.startsWith('9M-')) r = '9M-' + r.slice(2);
  return r;
}

const mergedMap = new Map();

for (const row of cleanData) {
  const name = normalizeName(row.airline_name);
  
  if (isDisqualifiedAirline(name)) continue;

  const meta = SCHEDULED_AIRLINES[name];
  if (!meta) continue;

  const rawFlight = (row.flight_number || '').trim().toUpperCase();
  if (isAdhocOrExtraFlight(rawFlight)) continue;

  const reg = formatTailNumber(row.aircraft_reg);
  const type = (row.aircraft_type || 'Unknown').trim();

  if (reg && (reg.startsWith('8Q-TM') || reg.startsWith('8Q-MA') || type.toUpperCase().includes('TWIN OTTER') || type.toUpperCase().includes('DHC-6'))) continue;

  if (!mergedMap.has(name)) {
    mergedMap.set(name, {
      airline_name: name,
      category: meta.category,
      iata: meta.iata,
      icao: meta.icao,
      flights: new Set(),
      aircrafts: new Map()
    });
  }

  const existing = mergedMap.get(name);
  existing.flights.add(rawFlight);
  if (reg) {
    if (type && type !== 'Unknown') {
      existing.aircrafts.set(reg, type);
    } else if (!existing.aircrafts.has(reg)) {
      existing.aircrafts.set(reg, 'Unknown');
    }
  }
}

// Add full Villa Air domestic fleet registrations (8Q-VAV, 8Q-VAW, 8Q-VAX, 8Q-VAY, 8Q-VAZ)
const villaData = mergedMap.get('VILLA AIR');
if (villaData) {
  const villaFleet = ['8Q-VAV', '8Q-VAW', '8Q-VAX', '8Q-VAY', '8Q-VAZ'];
  for (const reg of villaFleet) {
    if (!villaData.aircrafts.has(reg)) villaData.aircrafts.set(reg, 'ATR');
  }
}

const finalOutput = [];
for (const [name, data] of mergedMap.entries()) {
  if (data.aircrafts.size === 0) continue;

  finalOutput.push({
    airline_name: name,
    category: data.category,
    iata: data.iata,
    icao: data.icao,
    flights: Array.from(data.flights).sort(),
    aircrafts: Array.from(data.aircrafts.entries()).map(([aircraft_reg, aircraft_type]) => ({ aircraft_reg, aircraft_type })).sort((a,b) => a.aircraft_reg.localeCompare(b.aircraft_reg))
  });
}

// Sort: Domestic first, then International
finalOutput.sort((a, b) => {
  if (a.category !== b.category) return a.category === 'DOM' ? -1 : 1;
  return a.airline_name.localeCompare(b.airline_name);
});

const destPath = path.join(__dirname, '..', 'services', 'masterDbData.json');
fs.writeFileSync(destPath, JSON.stringify(finalOutput, null, 2));

console.log(`Successfully compiled ${finalOutput.length} scheduled airlines (VILLA AIR extracted from FLY ME (DOM) BigQuery logs) into services/masterDbData.json!`);
