const fs = require('fs');
const readline = require('readline');

async function analyze() {
  const fileStream = fs.createReadStream('C:/Users/a-6600/Downloads/ITP JetSales Analysis - DATA.csv');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let marineCount = 0;
  let seaplaneCount = 0;
  let intoPlaneCount = 0;

  const sampleMarine = [];
  const sampleSeaplane = [];
  const sampleIntoPlane = [];

  let header = null;

  for await (const line of rl) {
    if (count === 0) {
      header = line;
      count++;
      continue;
    }
    if (!line.trim()) continue;

    count++;

    // Simple parse (handling quoted commas like "1,036")
    const cols = parseCsvLine(line);
    const customerName = (cols[2] || '').toUpperCase();

    if (customerName.includes('LOCAL SALES') || customerName.includes('OTHERS')) {
      marineCount++;
      if (sampleMarine.length < 3) sampleMarine.push(cols);
    } else if (customerName.includes('SEAPLANE')) {
      seaplaneCount++;
      if (sampleSeaplane.length < 3) sampleSeaplane.push(cols);
    } else {
      intoPlaneCount++;
      if (sampleIntoPlane.length < 3) sampleIntoPlane.push(cols);
    }
  }

  console.log(`Total Rows: ${count - 1}`);
  console.log(`Marine Loading Rows: ${marineCount}`);
  console.log(`Seaplane Rows: ${seaplaneCount}`);
  console.log(`Into-Plane Rows: ${intoPlaneCount}`);

  console.log('\n--- SAMPLE MARINE ---', sampleMarine);
  console.log('\n--- SAMPLE SEAPLANE ---', sampleSeaplane);
  console.log('\n--- SAMPLE INTO-PLANE ---', sampleIntoPlane);
}

function parseCsvLine(text) {
  const result = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = '';
    } else {
      cell += c;
    }
  }
  result.push(cell.trim());
  return result;
}

analyze();
