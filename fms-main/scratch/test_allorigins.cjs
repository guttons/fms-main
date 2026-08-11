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
          resolve({ status: res.statusCode, error: e.message, raw: data.substring(0, 200) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

function cleanAircraftTypeName(raw) {
  if (!raw) return '';
  const type = raw.trim().toUpperCase();

  if (type.includes('777') || type.includes('77W') || type.includes('772')) return 'B777';
  if (type.includes('787') || type.includes('789') || type.includes('781')) return 'B787';
  if (type.includes('737') || type.includes('738') || type.includes('73M') || type.includes('MAX')) return 'B737';
  if (type.includes('747')) return 'B747';
  if (type.includes('A320') || type.includes('A20N')) return 'A320';
  if (type.includes('A321') || type.includes('A21N')) return 'A321';
  if (type.includes('A319')) return 'A319';
  if (type.includes('A330') || type.includes('A332') || type.includes('A333')) return 'A330';
  if (type.includes('A350') || type.includes('A359') || type.includes('A351')) return 'A350';
  if (type.includes('A380') || type.includes('A388')) return 'A380';
  if (type.includes('A220')) return 'A220';
  if (type.includes('ATR') || type.includes('AT7') || type.includes('AT4')) return 'ATR';
  if (type.includes('DHC-6') || type.includes('TWIN OTTER') || type.includes('DHC6')) return 'DHC6';
  if (type.includes('DH8') || type.includes('DASH 8') || type.includes('Q400')) return 'DH8D';

  return raw.trim();
}

async function queryPlanespottersProxy(reg) {
  const cleanReg = encodeURIComponent(reg.trim().toUpperCase().replace(/-/g, ''));
  const targetUrl = encodeURIComponent(`https://api.planespotters.net/pub/photos/reg/${cleanReg}`);
  const proxyUrl = `https://api.allorigins.win/raw?url=${targetUrl}`;

  const res = await fetchJson(proxyUrl);
  if (res.data && res.data.photos && res.data.photos.length > 0) {
    const photo = res.data.photos[0];
    const rawType = photo.aircraft?.typeName || photo.aircraft?.model || photo.aircraft?.type || '';
    const airlineName = photo.airline?.name || '';
    return {
      reg,
      rawType,
      shortType: cleanAircraftTypeName(rawType),
      airlineName,
      found: true
    };
  }
  return { reg, found: false };
}

async function run() {
  const regs = ['A6-AOM', 'A6-EEO', '8Q-IAN', '8Q-IAR', '9V-SMF', 'A7-ALC', 'VT-EXN', 'B-18901', 'RA-73148'];
  console.log('Testing live lookup via AllOrigins proxy...');
  for (const r of regs) {
    const res = await queryPlanespottersProxy(r);
    console.log(`[${r}] =>`, res);
  }
}

run();
