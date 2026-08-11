const https = require('https');

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 150) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function testHsSxa() {
  const reg = 'HS-SXA';
  console.log(`=== Testing ${reg} ===`);

  // AllOrigins
  const target = encodeURIComponent(`https://api.planespotters.net/pub/photos/reg/${reg.replace(/-/g, '')}`);
  const url1 = `https://api.allorigins.win/raw?url=${target}`;
  const res1 = await fetchJson(url1);
  console.log('AllOrigins status:', res1.status);
  if (res1.data?.photos?.length > 0) {
    console.log(' Aircraft:', res1.data.photos[0].aircraft?.typeName, '| Airline:', res1.data.photos[0].airline?.name);
  } else {
    console.log(' Response:', res1.data || res1.raw);
  }

  // CodeTabs Proxy
  const url2 = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://api.planespotters.net/pub/photos/reg/${reg.replace(/-/g, '')}`)}`;
  const res2 = await fetchJson(url2);
  console.log('CodeTabs status:', res2.status);
  if (res2.data?.photos?.length > 0) {
    console.log(' Aircraft:', res2.data.photos[0].aircraft?.typeName, '| Airline:', res2.data.photos[0].airline?.name);
  }
}

testHsSxa();
