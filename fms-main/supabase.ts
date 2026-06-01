import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] Warning: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured. ' +
    'Please add them to your .env file. Falling back to placeholder client to prevent startup crash.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
