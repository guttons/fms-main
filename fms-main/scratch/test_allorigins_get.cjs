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
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function run() {
  const reg = 'HS-SXA';
  const targetUrl = encodeURIComponent(`https://api.planespotters.net/pub/photos/reg/${reg.replace(/-/g, '')}`);
  const getUrl = `https://api.allorigins.win/get?url=${targetUrl}`;

  console.log('Fetching:', getUrl);
  const res = await fetchJson(getUrl);
  console.log('Status:', res.status);
  if (res.data && res.data.contents) {
    try {
      const parsedContent = JSON.parse(res.data.contents);
      console.log('Parsed contents photo count:', parsedContent.photos?.length);
      if (parsedContent.photos?.length > 0) {
        console.log('Aircraft:', parsedContent.photos[0].aircraft?.typeName, '| Airline:', parsedContent.photos[0].airline?.name);
      } else {
        console.log('Parsed content:', parsedContent);
      }
    } catch (e) {
      console.log('Contents raw:', res.data.contents.substring(0, 200));
    }
  }
}

run();
