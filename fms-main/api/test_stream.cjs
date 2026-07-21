const fs = require('fs');
const readline = require('readline');

async function testStream() {
  console.log('Opening file...');
  const fileStream = fs.createReadStream('C:\\Users\\a-6600\\Downloads\\ITP JetSales Analysis - DATA.csv', { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;
  for await (const line of rl) {
    count++;
    if (count % 20000 === 0) {
      console.log(`Line ${count}`);
    }
  }
  console.log(`Finished! Total lines: ${count}`);
}

testStream().catch(console.error);
