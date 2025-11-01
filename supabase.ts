import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Estas são as suas credenciais do Supabase.
// Mantenha-as atualizadas caso mudem no seu painel do Supabase.
const supabaseUrl = "https://byxpywgopefpdicbymol.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5eHB5d2dvcGVmcGRpY2J5bW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDY3MjIsImV4cCI6MjA3NzUyMjcyMn0.TEghGxiGht2o-DptBLai2Zq1C_9h02l3_G0dFdg3n68";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
