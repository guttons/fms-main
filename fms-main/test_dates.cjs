const fs = require('fs');
const readline = require('readline');

async function testDates() {
  const fileStream = fs.createReadStream('C:/Users/a-6600/Downloads/ITP JetSales Analysis - DATA.csv');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const dateSamples = new Set();
  let count = 0;

  for await (const line of rl) {
    if (count === 0) { count++; continue; }
    if (!line.trim()) continue;
    count++;

    const cols = parseCsvLine(line);
    const dateVal = cols[1];
    if (dateVal) dateSamples.add(dateVal);

    if (dateSamples.size >= 50 && count > 10000) break;
  }

  console.log('Sample Dates:', Array.from(dateSamples).slice(0, 30));
}

function parseCsvLine(text) {
  const result = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { result.push(cell.trim()); cell = ''; }
    else cell += c;
  }
  result.push(cell.trim());
  return result;
}

testDates();
