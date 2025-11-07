
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  // In a real app, you'd want to handle this more gracefully.
  // For this project, we'll log an error.
  console.error("Supabase URL and Anon Key must be provided in environment variables.");
  console.log("Please create a .env.local file with SUPABASE_URL and SUPABASE_ANON_KEY.");
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey);
