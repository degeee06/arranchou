
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
    const serviceKey = DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Cliente Admin para gerenciar usuários
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 1. Validar quem está chamando (deve ser admin ou super_admin)
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, DenoEnv.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser();
    if (callerError || !caller) throw new Error('Não autorizado.');

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
      throw new Error('Permissão negada.');
    }

    const { full_name, employee_id, password } = await req.json();
    const companyId = callerProfile.company_id;
    const email = `employee_${employee_id}@${companyId.toLowerCase()}.app`;

    // 2. CRIAR NO AUTH (Etapa Crítica)
    // Se isso falhar, o 'throw' interrompe a execução antes de mexer na tabela profiles
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, employee_id },
      app_metadata: { role: 'employee', company_id: companyId }
    });

    if (authError) {
        console.error("Erro no Auth:", authError);
        throw new Error(`Erro no serviço de Autenticação: ${authError.message}`);
    }

    if (!authData.user) throw new Error('Falha crítica: Usuário retornado como nulo pelo Auth.');

    // 3. CRIAR NO PROFILE (Sincronização)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name,
        employee_id,
        role: 'employee',
        company_id: companyId
      });

    if (profileError) {
      // Se o perfil falhar mas o auth criou, tentamos remover o auth para não deixar órfão
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Erro ao criar perfil: ${profileError.message}`);
    }

    return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
