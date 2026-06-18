const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pzyrstehoesmhwkhtoxd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase.from('flight_jobs').select('*').limit(1);
    if (error) {
      console.error('Error fetching flight_jobs:', error);
      return;
    }
    console.log('Fetched row:', data);
    if (data && data.length > 0) {
      console.log('Columns in flight_jobs:', Object.keys(data[0]));
    } else {
      console.log('No data found in flight_jobs to check columns.');
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

run();
