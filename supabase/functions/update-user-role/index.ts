// FIX: Replaced the Deno types reference with the recommended npm specifier. This improves stability and helps prevent type resolution errors for the Deno global object (e.g., Deno.env, Deno.serve).
/// <reference types="npm:@supabase/functions-js@2.4.1" />

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, new_role } = await req.json();

    if (!user_id || !new_role || !['admin', 'employee'].includes(new_role)) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos fornecidos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: callerProfile, error: callerError } = await userSupabaseClient
      .from('profiles')
      .select('role')
      .single();

    if (callerError || !callerProfile) {
      throw new Error('Não foi possível verificar as permissões do autor da chamada.');
    }

    if (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin') {
      throw new Error('Permissão negada. Apenas administradores podem alterar cargos.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: new_role })
      .eq('id', user_id);

    if (profileUpdateError) throw profileUpdateError;

    return new Response(JSON.stringify({ message: 'Cargo atualizado com sucesso!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

Deno.serve(handleRequest);