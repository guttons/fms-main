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
    envVars[key] = val.replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Anon Key in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetJobs() {
  try {
    console.log("1. Deleting all flight jobs from DB...");
    const { error: jobErr } = await supabase.from('flight_jobs').delete().neq('id', '');
    if (jobErr) {
      console.error("Failed to delete flight jobs:", jobErr);
    } else {
      console.log("Successfully deleted all flight jobs.");
    }

    console.log("2. Resetting frozen flights in all briefings...");
    const { data: briefings, error: fetchErr } = await supabase.from('shift_briefing_info').select('*');
    if (fetchErr) {
      console.error("Failed to fetch briefings:", fetchErr);
      return;
    }

    for (const b of briefings || []) {
      if (b.staff_assignments && b.staff_assignments.frozenFlights) {
        console.log(`Resetting frozen flights for briefing ${b.id}`);
        const updatedStaff = {
          ...b.staff_assignments,
          frozenFlights: null
        };
        const { error: updateErr } = await supabase
          .from('shift_briefing_info')
          .update({ staff_assignments: updatedStaff })
          .eq('id', b.id);
        
        if (updateErr) {
          console.error(`Failed to update briefing ${b.id}:`, updateErr);
        }
      }
    }
    console.log("Reset operation complete.");
  } catch (err) {
    console.error("Execution error:", err);
  }
}

resetJobs();
