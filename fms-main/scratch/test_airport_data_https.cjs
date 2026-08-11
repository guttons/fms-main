const https = require('https');

function fetchHttps(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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

async function testHttps() {
  const regs = ['HS-SXA', 'A6-EEO', 'A6-AOM', '8Q-IAN', '8Q-IAR', '9V-SMF', 'A7-ALC', 'VT-EXN', 'B-18901', 'RA-73148'];

  console.log('=== Testing HTTPS Airport-Data.com API ===');
  for (const r of regs) {
    const res = await fetchHttps(`https://www.airport-data.com/api/ac_lookups.json?reg=${r}`);
    console.log(`[${r}] -> Status: ${res.status}, CORS: ${res.cors}`);
    if (res.data?.data?.[0]) {
      const item = res.data.data[0];
      console.log(`   Type: ${item.type} | ICAO: ${item.icao} | Model: ${item.model} | Image: ${item.image || 'none'}`);
    } else {
      console.log('   Raw:', res.raw);
    }
  }
}

testHttps();
