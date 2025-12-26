
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;
const DenoEnv = (Deno as any).env;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = DenoEnv.get('SUPABASE_URL') ?? '';
    const anonKey = DenoEnv.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Cliente para autenticar o usuário que está chamando
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    
    const { data: { user: adminUser } } = await supabaseClient.auth.getUser();
    if (!adminUser) throw new Error('Usuário não autenticado.');

    // Cliente Admin (Service Role) para ignorar RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verifica se é Super Admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', adminUser.id)
      .single();

    if (!profile || profile.role !== 'super_admin') {
      throw new Error('Apenas o Super Administrador pode alterar os ajustes da unidade.');
    }

    const { company_id, setting_key, setting_value } = await req.json();

    if (company_id !== profile.company_id) {
       throw new Error('Você não tem permissão para alterar dados de outra unidade.');
    }

    // Salva na tabela company_settings
    const { error: upsertError } = await supabaseAdmin
      .from('company_settings')
      .upsert({ 
        company_id, 
        setting_key, 
        setting_value: setting_value.trim()
      }, { onConflict: 'company_id,setting_key' });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
