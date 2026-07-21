const fs = require('fs');
const readline = require('readline');

async function processHeader() {
  const fileStream = fs.createReadStream('C:/Users/a-6600/Downloads/ITP JetSales Analysis - DATA.csv');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    console.log(`LINE ${count}: ${line}`);
    count++;
    if (count >= 10) break;
  }
}

processHeader();
