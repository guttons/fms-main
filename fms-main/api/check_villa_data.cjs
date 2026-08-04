const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'services', 'masterDbData.json'), 'utf8'));

const v = data.find(d => d.airline_name === 'VILLA AIR');
console.log('✈️ VILLA AIR Extracted BigQuery Data:');
console.log('   - Flight Numbers:', v.flights);
console.log('   - Aircraft Registrations:', v.aircrafts);
