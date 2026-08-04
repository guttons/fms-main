const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'services', 'masterDbData.json'), 'utf8'));

console.log(`Total Airlines in dataset: ${data.length}\n`);

const majors = ['MALDIVIAN', 'MANTA AIR', 'FLYME / VILLA AIR', 'EMIRATES', 'QATAR AIRWAYS', 'SINGAPORE AIRLINES', 'TURKISH AIRLINES', 'SRILANKAN AIRLINES', 'INDIGO', 'AEROFLOT', 'BRITISH AIRWAYS', 'SAUDIA', 'FLYDUBAI', 'GULF AIR', 'WIZZ AIR', 'AIRASIA X'];

for (const item of data) {
  if (majors.includes(item.airline_name)) {
    console.log(`✈️ ${item.airline_name} [${item.category}] (IATA: ${item.iata || 'N/A'}, ICAO: ${item.icao || 'N/A'}):`);
    console.log(`   - Flight Numbers (${item.flights.length}): ${item.flights.slice(0, 10).join(', ')}${item.flights.length > 10 ? '...' : ''}`);
    console.log(`   - Aircraft Tail Registrations (${item.aircrafts.length}): ${item.aircrafts.slice(0, 8).map(a => `${a.aircraft_reg} (${a.aircraft_type})`).join(', ')}${item.aircrafts.length > 8 ? '...' : ''}\n`);
  }
}
