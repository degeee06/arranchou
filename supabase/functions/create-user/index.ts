
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
    
    // 1. PEGAR DADOS DO ADMIN (Para saber qual empresa o novo usuário herdará)
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('id', adminUser.id)
      .single();

    if (adminProfileError || !adminProfile) {
        throw new Error('Não foi possível localizar o perfil do administrador.');
    }

    if (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin') {
      throw new Error('Permissão negada: Apenas administradores podem criar usuários.');
    }

    if (!adminProfile.company_id) {
        throw new Error('Erro: Seu perfil de administrador não possui um company_id vinculado.');
    }

    const { full_name, employee_id, password } = await req.json();
    
    // O domínio do e-mail é o company_id do admin
    const companyDomain = adminProfile.company_id.toLowerCase();
    const email = `employee_${employee_id}@${companyDomain}.app`;
    
    // 2. CRIAR USUÁRIO NA AUTENTICAÇÃO
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, employee_id },
        app_metadata: { 
            role: 'employee',
            company_id: adminProfile.company_id 
        }
    });

    if (createError) throw createError;
    if (!newUser.user) throw new Error('Erro ao criar usuário na autenticação.');

    // 3. FORÇAR GRAVAÇÃO NO PERFIL (Garantia contra falha de Trigger)
    // Isso garante que o company_id e o role sejam salvos na tabela pública
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
          id: newUser.user.id,
          full_name: full_name,
          employee_id: employee_id,
          role: 'employee',
          company_id: adminProfile.company_id
      }, { onConflict: 'id' });

    if (profileUpdateError) {
        console.error('Erro ao forçar gravação do perfil:', profileUpdateError);
        // Não lançamos erro aqui para não travar a criação, mas logamos no console
    }

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
