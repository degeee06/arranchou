import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key must be provided in environment variables prefixed with VITE_.");
  console.log("Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your Vercel project settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
