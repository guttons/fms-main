const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pzyrstehoesmhwkhtoxd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_TABLES = [
  'profiles', 'staff', 'equipment', 'tanks', 'flight_jobs',
  'shift_briefings', 'system_settings', 'operations_log', 'master_db',
  'fin_customers', 'fin_invoices', 'fin_receipts', 'fin_proforma_register',
  'fin_upcoming_payments', 'fin_fuel_requests'
];

async function checkAll() {
  console.log('[Supabase Check] Testing existing tables in Supabase...');
  for (const t of TEST_TABLES) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(` ✅ Table '${t}' exists! (${data.length} sample row)`);
    } else {
      console.log(` ❌ Table '${t}' error: ${error.message} (${error.code})`);
    }
  }
}

checkAll();
