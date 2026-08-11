const https = require('https');

function getUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function testGithub() {
  console.log('=== Testing Open Aircraft Database CDNs ===');

  // Test standing data or aircraft JSON
  const urls = [
    'https://cdn.jsdelivr.net/gh/vradarserver/standing-data@main/aircraft.csv',
    'https://raw.githubusercontent.com/datasets/aircraft-country-codes/master/data/aircraft-country-codes.csv',
    'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json'
  ];

  for (const u of urls) {
    const res = await getUrl(u);
    console.log(`URL: ${u} => Status: ${res.status}, Length: ${res.body.length}`);
  }
}

testGithub();
