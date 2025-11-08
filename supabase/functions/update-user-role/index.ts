// FIX: Use the npm package specifier for Supabase functions types.
// This is generally more compatible with local development environments and tooling
// than a direct URL reference, and it provides the necessary Deno types.
/// <reference types="@supabase/functions-js" />

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// FIX: Using `serve` from the Deno standard library for broader compatibility than the newer `Deno.serve`.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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
});
