import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzyrstehoesmhwkhtoxd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Querying supabase equipment...');
  const { data, error } = await supabase.from('equipment').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Equipment list:', data.map(d => ({ id: d.id, name: d.name, type: d.type, status: d.status })));
  }
}

check();
