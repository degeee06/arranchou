
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
    const supabaseClient = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user: adminUser } } = await supabaseClient.auth.getUser();
    if (!adminUser) throw new Error('Não autorizado.');

    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // PEGAR DADOS DO ADMIN (EMPRESA)
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', adminUser.id)
      .single();

    if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin')) {
      throw new Error('Permissão negada.');
    }

    const { full_name, employee_id, password } = await req.json();
    
    // O domínio do e-mail é o company_id do admin
    const companyDomain = adminProfile.company_id.toLowerCase();
    const email = `employee_${employee_id}@${companyDomain}.app`;
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, employee_id },
        app_metadata: { 
            role: 'employee',
            company_id: adminProfile.company_id // HERANÇA CRÍTICA
        }
    });

    if (createError) throw createError;

    // OBS: O trigger no banco deve inserir company_id na tabela profiles
    // SQL Sugerido: NEW.company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id');

    return new Response(JSON.stringify({ success: true, user: newUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
