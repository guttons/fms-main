const https = require('https');

function getApi(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 200) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function testProxies() {
  const regs = ['A6-EEO', 'A6-AOM', '8Q-IAN', '9V-SMF', 'A7-ALC', '8Q-IAR'];

  console.log('=== Testing Flightradar24 Search JSON ===');
  for (const r of regs) {
    const res = await getApi(`https://api.flightradar24.com/common/v1/search.json?query=${r}`);
    console.log(`[${r}] -> Status: ${res.status}`, res.data?.results?.[0] || res.raw);
  }

  console.log('\n=== Testing AllOrigins Proxy for Planespotters ===');
  for (const r of regs) {
    const target = encodeURIComponent(`https://api.planespotters.net/pub/photos/reg/${r.replace(/-/g, '')}`);
    const res = await getApi(`https://api.allorigins.win/raw?url=${target}`);
    const photo = res.data?.photos?.[0];
    console.log(`[${r}] -> Status: ${res.status}`, photo ? `${photo.aircraft?.typeName} | ${photo.airline?.name}` : res.raw);
  }
}

testProxies();
