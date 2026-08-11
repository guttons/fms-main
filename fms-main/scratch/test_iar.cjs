const https = require('https');

function getJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 200) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function test() {
  console.log('--- Testing 8Q-IAR ---');
  const p1 = await getJson('https://api.planespotters.net/pub/photos/reg/8Q-IAR');
  console.log('Planespotters 8Q-IAR:', p1.status, p1.body?.photos?.[0]?.aircraft, p1.body?.photos?.[0]?.airline);

  const p2 = await getJson('https://api.planespotters.net/pub/photos/reg/8QIAR');
  console.log('Planespotters 8QIAR:', p2.status, p2.body?.photos?.[0]?.aircraft, p2.body?.photos?.[0]?.airline);

  const h1 = await getJson('https://hexdb.io/api/v1/aircraft/reg/8Q-IAR');
  console.log('HexDB 8Q-IAR:', h1.status, h1.body);
}

test();
