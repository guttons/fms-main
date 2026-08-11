const https = require('https');

function getApiWithHeaders(url, extraHeaders = {}) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.planespotters.net',
        'Referer': 'https://www.planespotters.net/',
        ...extraHeaders
      }
    }, (res) => {
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

async function run() {
  const reg = 'HS-SXA';
  console.log('Testing Planespotters with Origin & Referer headers...');
  const res1 = await getApiWithHeaders(`https://api.planespotters.net/pub/photos/reg/${reg.replace(/-/g, '')}`);
  console.log('Result:', res1.status, res1.data?.photos?.[0]?.aircraft, res1.data?.photos?.[0]?.airline);

  console.log('Testing Planespotters via AllOrigins with Referer...');
  const target = encodeURIComponent(`https://api.planespotters.net/pub/photos/reg/${reg.replace(/-/g, '')}`);
  const res2 = await getApiWithHeaders(`https://api.allorigins.win/raw?url=${target}`);
  console.log('Result AllOrigins:', res2.status, res2.data?.photos?.[0]?.aircraft, res2.data?.photos?.[0]?.airline);
}

run();
