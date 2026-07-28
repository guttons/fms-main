const ANON_KEY = 'test-bypass-secret-123';

async function test() {
  const url = 'http://localhost:8081/operations-log?startDate=&endDate=&searchTerm=&logType=FLIGHT&flightCategory=ALL&page=1&limit=50&sortField=date&sortOrder=desc';
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    console.log('Response Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Success! Total count:', data.totalCount);
      console.log('First log item:', data.logs && data.logs.length > 0 ? data.logs[0] : 'None');
    } else {
      console.log('Response Error Body:', await res.text());
    }
  } catch (error) {
    console.error('Fetch Error:', error);
  }
}
test();
