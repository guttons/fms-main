const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

const bigquery = new BigQuery({ projectId: 'macl-fms-496808' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pzyrstehoesmhwkhtoxd.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMasterDBExtraction() {
  console.log('[BigQuery Master DB Sync] Querying historical operational logs...');

  const query = `
    SELECT DISTINCT
      TRIM(airline) AS airline_name,
      TRIM(flight_number) AS flight_number,
      TRIM(aircraft_reg) AS aircraft_reg,
      TRIM(aircraft_type) AS aircraft_type
    FROM \`macl-fms-496808.fms_data.operations_log\`
    WHERE airline IS NOT NULL AND TRIM(airline) != ''
      AND flight_number IS NOT NULL AND TRIM(flight_number) != ''
      AND aircraft_reg IS NOT NULL AND TRIM(aircraft_reg) != ''
    ORDER BY airline_name, flight_number, aircraft_reg;
  `;

  try {
    const [rows] = await bigquery.query({ query });
    console.log(`[BigQuery Master DB Sync] Retrieved ${rows.length} raw historical combinations.`);

    const airlineMap = new Map(); // name -> id
    const flightSet = new Set(); // "airlineId|flightNumber"
    const aircraftMap = new Map(); // "aircraftReg" -> { aircraftType, airlineId, airlineName }

    // 1. Process Airlines
    for (const row of rows) {
      const airlineName = row.airline_name.toUpperCase();
      if (!airlineMap.has(airlineName)) {
        airlineMap.set(airlineName, null);
      }
    }

    console.log(`[BigQuery Master DB Sync] Found ${airlineMap.size} unique airlines.`);

    // Upsert Airlines to Supabase
    for (const [name] of airlineMap.entries()) {
      const { data, error } = await supabase.from('airlines').upsert({ name, is_active: true }, { onConflict: 'name' }).select('id').single();
      if (error) {
        console.warn(`[Supabase] Failed upsert airline ${name}:`, error.message);
      } else if (data) {
        airlineMap.set(name, data.id);
      }
    }

    // 2. Process Flights & Aircrafts
    let flightCount = 0;
    let aircraftCount = 0;

    for (const row of rows) {
      const airlineName = row.airline_name.toUpperCase();
      const airlineId = airlineMap.get(airlineName);
      if (!airlineId) continue;

      const flightNumber = row.flight_number.toUpperCase();
      const flightKey = `${airlineId}|${flightNumber}`;
      if (!flightSet.has(flightKey)) {
        flightSet.add(flightKey);
        const { error } = await supabase.from('flight_master').upsert({
          airline_id: airlineId,
          airline_name: airlineName,
          flight_number: flightNumber,
          is_active: true
        }, { onConflict: 'airline_name,flight_number' });
        if (!error) flightCount++;
      }

      const aircraftReg = row.aircraft_reg.toUpperCase();
      const aircraftType = row.aircraft_type ? row.aircraft_type.trim() : 'Unknown';
      if (!aircraftMap.has(aircraftReg)) {
        aircraftMap.set(aircraftReg, { aircraftType, airlineId, airlineName });
        const { error } = await supabase.from('aircraft_master').upsert({
          airline_id: airlineId,
          airline_name: airlineName,
          aircraft_reg: aircraftReg,
          aircraft_type: aircraftType,
          is_active: true
        }, { onConflict: 'aircraft_reg' });
        if (!error) aircraftCount++;
      }
    }

    console.log(`[BigQuery Master DB Sync] Complete! Inserted/Synced ${airlineMap.size} Airlines, ${flightCount} Flights, ${aircraftCount} Aircraft Registrations.`);
  } catch (err) {
    console.error('[BigQuery Master DB Sync] Error:', err);
  }
}

if (require.main === module) {
  runMasterDBExtraction();
}

module.exports = { runMasterDBExtraction };
