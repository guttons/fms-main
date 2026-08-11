const https = require('https');
const http = require('http');

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'], data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'], raw: data.substring(0, 150) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function testCorsFree() {
  const regs = ['HS-SXA', 'A6-EEO', 'A6-AOM', '8Q-IAN', '8Q-IAR', '9V-SMF'];

  console.log('=== Testing Airport-Data.com API ===');
  for (const r of regs) {
    const res = await fetchUrl(`http://www.airport-data.com/api/ac_lookups.json?reg=${r}`);
    console.log(`[${r}] -> Status: ${res.status}, CORS: ${res.cors}`, res.data?.data?.[0] || res.raw);
  }

  console.log('\n=== Testing HexDB API ===');
  for (const r of regs) {
    const res = await fetchUrl(`https://hexdb.io/api/v1/aircraft/reg/${r}`);
    console.log(`[${r}] -> Status: ${res.status}, CORS: ${res.cors}`, res.data?.Model || res.data?.Type || res.raw);
  }
}

testCorsFree();
