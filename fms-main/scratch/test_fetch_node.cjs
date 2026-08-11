async function testNativeFetch() {
  const regs = ['HS-SXA', 'A6-EEO', 'A6-AOM', '8Q-IAN', '8Q-IAR', '9V-SMF', 'A7-ALC', 'VT-EXN', 'B-18901', 'RA-73148'];

  console.log('=== Testing Native fetch() on Airport-Data.com API ===');
  for (const r of regs) {
    try {
      const url = `https://www.airport-data.com/api/ac_lookups.json?reg=${r}`;
      const res = await fetch(url);
      const data = await res.json();
      const cors = res.headers.get('access-control-allow-origin');
      console.log(`[${r}] -> Status: ${res.status}, CORS: ${cors}`);
      if (data?.data?.[0]) {
        console.log(`   Type: ${data.data[0].type} | ICAO: ${data.data[0].icao} | Model: ${data.data[0].model}`);
      } else {
        console.log('   Data:', data);
      }
    } catch (e) {
      console.error(`[${r}] error:`, e.message);
    }
  }
}

testNativeFetch();
