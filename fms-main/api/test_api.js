const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';

async function test() {
  const res = await fetch('https://fms-bigquery-api-808402455416.us-central1.run.app/operations-log', {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`
    }
  });
  console.log('GET /operations-log status:', res.status);
  if (res.ok) {
    const data = await res.json();
    console.log('Logs count in BQ:', data.count);
  } else {
    console.log('Error body:', await res.text());
  }
}
test();
