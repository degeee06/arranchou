import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Substitua com as suas próprias credenciais do Supabase.
// Você pode encontrá-las em Project Settings > API no seu painel do Supabase.
const supabaseUrl = "https://byxpywgopefpdicbymol.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5eHB5d2dvcGVmcGRpY2J5bW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDY3MjIsImV4cCI6MjA3NzUyMjcyMn0.TEghGxiGht2o-DptBLai2Zq1C_9h02l3_G0dFdg3n68";

export const isSupabaseConfigured = 
    supabaseUrl !== "https://byxpywgopefpdicbymol.supabase.co" && 
    supabaseAnonKey !== "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5eHB5d2dvcGVmcGRpY2J5bW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDY3MjIsImV4cCI6MjA3NzUyMjcyMn0.TEghGxiGht2o-DptBLai2Zq1C_9h02l3_G0dFdg3n68";

if (!isSupabaseConfigured) {
    console.warn("Supabase credentials are not set. Please update supabase.ts with your project's URL and anon key.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
