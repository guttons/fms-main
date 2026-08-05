const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pzyrstehoesmhwkhtoxd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log('[Supabase Check] Checking airlines, flight_master, and aircraft_master tables...');
  
  const { data: aData, error: aErr } = await supabase.from('airlines').select('*').limit(5);
  console.log('airlines table status:', aErr ? `Error: ${aErr.message} (code: ${aErr.code})` : `OK (${aData.length} rows)`);

  const { data: fData, error: fErr } = await supabase.from('flight_master').select('*').limit(5);
  console.log('flight_master table status:', fErr ? `Error: ${fErr.message} (code: ${fErr.code})` : `OK (${fData.length} rows)`);

  const { data: acData, error: acErr } = await supabase.from('aircraft_master').select('*').limit(5);
  console.log('aircraft_master table status:', acErr ? `Error: ${acErr.message} (code: ${acErr.code})` : `OK (${acData.length} rows)`);
}

checkTables();
