import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envVars[key] = val;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Anon Key in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  try {
    console.log("Listing tables via SQL select...");
    // Let's run a query to information_schema
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .limit(1);
    
    console.log("Equipment check ok.");

    // Let's query information_schema if possible using an RPC or SQL
    // Supabase JS doesn't allow direct raw SQL unless there is an RPC.
    // Let's check if there is an error by querying a non-existent table to see if it lists tables, or if we can see.
    // Alternatively, we can try to fetch from 'attendance_logs' or similar to see if it exists.
    const { error: attError } = await supabase.from('attendance_logs').select('*').limit(1);
    console.log("attendance_logs table check error (if 404/not found, it doesn't exist):", attError?.message);

    const { error: briefingHistoryError } = await supabase.from('briefing_history').select('*').limit(1);
    console.log("briefing_history table check error:", briefingHistoryError?.message);
  } catch (err) {
    console.error("Execution error:", err);
  }
}

inspect();
