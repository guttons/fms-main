const http = require('http');
const https = require('https');

function getUrl(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getUrl(res.headers.location));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function testHttp() {
  const regs = ['A6-EEO', '8Q-IAI', '9V-SMF', 'A7-ALC', '8Q-TMV'];
  console.log('--- Testing Airport-Data with redirect following ---');
  for (const r of regs) {
    const res = await getUrl(`http://www.airport-data.com/api/ac_lookups/json?reg=${r}`);
    console.log(`[${r}] -> Status: ${res.status}`);
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.data && parsed.data.length > 0) {
        console.log('  Found:', parsed.data[0].aircraft, '| Manufacturer:', parsed.data[0].manufacturer);
      } else {
        console.log('  Payload:', parsed);
      }
    } catch (e) {
      console.log('  Raw body snippet:', res.body?.substring(0, 100));
    }
  }
}

testHttp();
