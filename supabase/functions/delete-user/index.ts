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
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    const { data: { user: caller } } = await userSupabaseClient.auth.getUser();
    if(!caller) throw new Error('Autor da chamada não autenticado.');

    if (caller.id === user_id) {
      throw new Error('Você não pode remover a si mesmo.');
    }

    const { data: callerProfile, error: callerError } = await userSupabaseClient
      .from('profiles')
      .select('role')
      .single();

    if (callerError || !callerProfile) {
      throw new Error('Não foi possível verificar as permissões do autor da chamada.');
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user_id)
      .single();

    if (targetError || !targetProfile) {
      throw new Error('Usuário alvo não encontrado.');
    }

    if (callerProfile.role === 'admin' && targetProfile.role !== 'employee') {
      throw new Error('Admins só podem remover funcionários.');
    }
    if (callerProfile.role !== 'super_admin' && callerProfile.role !== 'admin') {
      throw new Error('Permissão negada.');
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ message: 'Usuário removido com sucesso.' }), {
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
