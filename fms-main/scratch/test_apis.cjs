const https = require('https');

function getApi(url, headers = {}) {
  return new Promise((resolve) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      }
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 300) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function testAll() {
  const testRegs = ['A6-AOM', 'A6-EEO', '8Q-IAN', '8Q-IAR', '9V-SMF', 'A7-ALC', 'VT-EXN', 'B-18901'];

  console.log('=== Testing Planespotters ===');
  for (const r of testRegs) {
    const cleanNoDash = r.replace(/-/g, '');
    const res = await getApi(`https://api.planespotters.net/pub/photos/reg/${cleanNoDash}`);
    if (res.data?.photos?.length > 0) {
      const p = res.data.photos[0];
      console.log(`[${r}] ->`, p.aircraft?.typeName || p.aircraft?.model, '| Airline:', p.airline?.name);
    } else {
      console.log(`[${r}] -> Status: ${res.status}`, res.raw || 'No photos');
    }
  }

  console.log('\n=== Testing HexDB ===');
  for (const r of testRegs) {
    const res = await getApi(`https://hexdb.io/api/v1/aircraft/reg/${r}`);
    console.log(`[${r}] -> Status: ${res.status}`, res.data?.Model || res.data?.Type || res.raw);
  }

  console.log('\n=== Testing Flightradar24 Find API ===');
  for (const r of testRegs) {
    const res = await getApi(`https://www.flightradar24.com/v1/search/web/find?query=${r}&limit=5`);
    console.log(`[${r}] -> Status: ${res.status}`, res.data?.results?.[0]?.detail || res.raw);
  }
}

testAll();
