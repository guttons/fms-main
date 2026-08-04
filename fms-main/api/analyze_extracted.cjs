const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'master_extracted.json'), 'utf8'));

console.log(`Loaded ${raw.length} raw BigQuery distinct records.`);

const airlinesMap = new Map();

// Known Domestic airlines
const DOM_AIRLINES = new Set(['MALDIVIAN', 'MALDIVIAN DOMESTIC', 'MANTA AIR', 'FLYME', 'VILLA AIR', 'FLYME / VILLA AIR']);

for (const row of raw) {
  let airline = (row.airline_name || '').trim().toUpperCase();
  let flight = (row.flight_number || '').trim().toUpperCase();
  let reg = (row.aircraft_reg || '').trim().toUpperCase();
  let type = (row.aircraft_type || 'Unknown').trim();
  let intDom = (row.int_dom || '').trim().toUpperCase();

  if (!airline || !flight || !reg) continue;
  
  // Normalize airline names
  if (airline === 'MALDIVIAN DOMESTIC') airline = 'MALDIVIAN';
  if (airline === 'FLYME' || airline === 'VILLA AIR') airline = 'FLYME / VILLA AIR';

  // Filter out seaplane / ground / marine entries
  if (reg.startsWith('8Q-TM') || reg.startsWith('8Q-MA') || type.toUpperCase().includes('TWIN OTTER') || type.toUpperCase().includes('DHC-6')) continue;

  const category = (DOM_AIRLINES.has(airline) || intDom === 'DOM') ? 'DOM' : 'INT';

  if (!airlinesMap.has(airline)) {
    airlinesMap.set(airline, {
      name: airline,
      category,
      flights: new Set(),
      aircrafts: new Map() // reg -> type
    });
  }

  const entry = airlinesMap.get(airline);
  entry.flights.add(flight);
  if (type && type !== 'Unknown') {
    entry.aircrafts.set(reg, type);
  } else if (!entry.aircrafts.has(reg)) {
    entry.aircrafts.set(reg, 'Unknown');
  }
}

console.log(`\n=== Summary of Extracted Master DB (${airlinesMap.size} Airlines) ===`);
const formattedList = [];

for (const [name, data] of airlinesMap.entries()) {
  const flightArray = Array.from(data.flights).sort();
  const aircraftArray = Array.from(data.aircrafts.entries()).map(([aircraft_reg, aircraft_type]) => ({ aircraft_reg, aircraft_type })).sort((a,b) => a.aircraft_reg.localeCompare(b.aircraft_reg));

  console.log(`- ${name} [${data.category}]: ${flightArray.length} flights, ${aircraftArray.length} aircrafts`);

  formattedList.push({
    airline_name: name,
    category: data.category,
    flights: flightArray,
    aircrafts: aircraftArray
  });
}

fs.writeFileSync(path.join(__dirname, 'master_db_clean.json'), JSON.stringify(formattedList, null, 2));
console.log('\nSaved cleaned master DB to api/master_db_clean.json');
